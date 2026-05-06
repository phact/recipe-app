# recipe-app

Snap a photo of a recipe, OCR it, store it as markdown, search it.

- **Backend:** FastAPI + SQLite (FTS5) + Tesseract OCR
- **Frontend:** Next.js 16 + React 19 + Tailwind v4

## Prerequisites

- Python 3.13+ and [uv](https://docs.astral.sh/uv/)
- Node 20+ and npm
- `tesseract` with English data (`sudo pacman -S tesseract tesseract-data-eng` on Arch)

## Run

**Backend** (port 8000):

```bash
cd backend
uv run uvicorn main:app --reload
```

**Frontend** (port 3000):

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

## Layout

```
backend/   FastAPI app, SQLite db (recipes.db), uploaded images (uploads/)
frontend/  Next.js app
```
