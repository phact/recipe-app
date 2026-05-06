"""Recipe app backend — FastAPI + SQLite + Tesseract OCR."""
from __future__ import annotations

import io
import re
import sqlite3
import subprocess
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, ImageOps
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "recipes.db"
IMAGES_DIR = BASE_DIR / "uploads"
IMAGES_DIR.mkdir(exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

SECTION_HEADINGS = re.compile(
    r"^\s*(ingredients?|directions?|instructions?|steps?|method|preparation|notes?|yield|serves|servings)\s*:?\s*$",
    re.IGNORECASE,
)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                content     TEXT NOT NULL,
                tags        TEXT NOT NULL DEFAULT '',
                image_path  TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
                title, content, tags,
                content='recipes', content_rowid='id', tokenize='porter'
            );

            CREATE TRIGGER IF NOT EXISTS recipes_ai AFTER INSERT ON recipes BEGIN
                INSERT INTO recipes_fts(rowid, title, content, tags)
                VALUES (new.id, new.title, new.content, new.tags);
            END;

            CREATE TRIGGER IF NOT EXISTS recipes_ad AFTER DELETE ON recipes BEGIN
                INSERT INTO recipes_fts(recipes_fts, rowid, title, content, tags)
                VALUES('delete', old.id, old.title, old.content, old.tags);
            END;

            CREATE TRIGGER IF NOT EXISTS recipes_au AFTER UPDATE ON recipes BEGIN
                INSERT INTO recipes_fts(recipes_fts, rowid, title, content, tags)
                VALUES('delete', old.id, old.title, old.content, old.tags);
                INSERT INTO recipes_fts(rowid, title, content, tags)
                VALUES (new.id, new.title, new.content, new.tags);
            END;
            """
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Recipe API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RecipeIn(BaseModel):
    title: str
    content: str
    tags: str = ""
    image_path: str | None = None


class RecipePatch(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: str | None = None


class Recipe(BaseModel):
    id: int
    title: str
    content: str
    tags: str
    image_path: str | None
    created_at: str
    updated_at: str


class ImportResult(BaseModel):
    suggested_title: str
    markdown: str
    image_path: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_recipe(row: sqlite3.Row) -> Recipe:
    return Recipe(**dict(row))


def guess_title(markdown: str) -> str:
    """Pull a sensible title out of extracted markdown."""
    for raw in markdown.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^#{1,3}\s+(.+)$", line)
        if m:
            return m.group(1).strip()
        if len(line) <= 80 and not line.startswith(("-", "*", "•", "|", "<")):
            return line
    return "Untitled recipe"


def preprocess_for_ocr(raw: bytes) -> bytes:
    """Auto-rotate via EXIF, convert to grayscale PNG — gives Tesseract cleaner input."""
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        if img.mode != "L":
            img = img.convert("L")
        out = io.BytesIO()
        img.save(out, format="PNG")
        return out.getvalue()
    except Exception:
        return raw


def run_tesseract(image_bytes: bytes) -> str:
    """Run tesseract on the given image bytes and return the recognized text."""
    proc = subprocess.run(
        ["tesseract", "stdin", "stdout", "-l", "eng"],
        input=image_bytes,
        capture_output=True,
        timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"tesseract failed (exit {proc.returncode}): {proc.stderr.decode(errors='replace').strip()}"
        )
    return proc.stdout.decode("utf-8", errors="replace")


def ocr_to_markdown(text: str) -> str:
    """Lightly format raw OCR output: title heading + section headings."""
    lines = [ln.rstrip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln.strip()]
    if not lines:
        return ""

    out: list[str] = []
    title_used = False
    for ln in lines:
        stripped = ln.strip()
        if SECTION_HEADINGS.match(stripped):
            heading = stripped.rstrip(":").title()
            out.append(f"\n## {heading}\n")
            continue
        if not title_used and len(stripped) <= 80:
            out.append(f"# {stripped}\n")
            title_used = True
            continue
        out.append(stripped)
    return "\n".join(out).strip()


def fts_query(q: str) -> str:
    """Sanitize user search input for FTS5 — prefix-match each token."""
    tokens = re.findall(r"\w+", q)
    return " ".join(f'"{t}"*' for t in tokens) if tokens else ""


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/recipes/import", response_model=ImportResult)
async def import_from_file(file: UploadFile = File(...)) -> ImportResult:
    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {ctype}. Upload a JPEG, PNG, WebP, or HEIC photo.",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file upload")

    suffix = Path(file.filename or "").suffix.lower() or {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/heic": ".heic",
        "image/heif": ".heif",
    }.get(ctype, ".jpg")
    saved_name = f"{uuid.uuid4().hex}{suffix}"
    saved_path = IMAGES_DIR / saved_name
    saved_path.write_bytes(raw)

    try:
        ocr_input = preprocess_for_ocr(raw)
        ocr_text = run_tesseract(ocr_input)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail="Tesseract isn't installed. Run: sudo pacman -S tesseract tesseract-data-eng",
        ) from e
    except subprocess.TimeoutExpired as e:
        raise HTTPException(status_code=504, detail="OCR timed out.") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}") from e

    markdown = ocr_to_markdown(ocr_text)
    if not markdown:
        markdown = "_No text detected in this image. Type the recipe below._"

    return ImportResult(
        suggested_title=guess_title(markdown),
        markdown=markdown,
        image_path=saved_name,
    )


@app.get("/api/recipes", response_model=list[Recipe])
def list_recipes(q: str | None = None, limit: int = 200) -> list[Recipe]:
    with db() as conn:
        if q and (term := fts_query(q)):
            rows = conn.execute(
                """
                SELECT r.* FROM recipes r
                JOIN recipes_fts f ON f.rowid = r.id
                WHERE recipes_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (term, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM recipes ORDER BY datetime(updated_at) DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [row_to_recipe(r) for r in rows]


@app.post("/api/recipes", response_model=Recipe, status_code=201)
def create_recipe(payload: RecipeIn) -> Recipe:
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    ts = now_iso()
    with db() as conn:
        cur = conn.execute(
            """
            INSERT INTO recipes (title, content, tags, image_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.title.strip(),
                payload.content,
                payload.tags.strip(),
                payload.image_path,
                ts,
                ts,
            ),
        )
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM recipes WHERE id = ?", (new_id,)).fetchone()
    return row_to_recipe(row)


@app.get("/api/recipes/{recipe_id}", response_model=Recipe)
def get_recipe(recipe_id: int) -> Recipe:
    with db() as conn:
        row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return row_to_recipe(row)


@app.patch("/api/recipes/{recipe_id}", response_model=Recipe)
def update_recipe(recipe_id: int, patch: RecipePatch) -> Recipe:
    fields = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not fields:
        return get_recipe(recipe_id)

    if "title" in fields and not fields["title"].strip():
        raise HTTPException(status_code=400, detail="Title cannot be blank")

    fields["updated_at"] = now_iso()
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [recipe_id]

    with db() as conn:
        cur = conn.execute(f"UPDATE recipes SET {sets} WHERE id = ?", values)
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Recipe not found")
        row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    return row_to_recipe(row)


@app.delete("/api/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int) -> None:
    with db() as conn:
        row = conn.execute("SELECT image_path FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Recipe not found")
        conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
    if row["image_path"]:
        try:
            (IMAGES_DIR / row["image_path"]).unlink(missing_ok=True)
        except OSError:
            pass


@app.get("/api/images/{name}")
def get_image(name: str):
    if "/" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Bad filename")
    p = IMAGES_DIR / name
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(p)
