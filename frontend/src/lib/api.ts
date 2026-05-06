export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type Recipe = {
  id: number;
  title: string;
  content: string;
  tags: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportResult = {
  suggested_title: string;
  markdown: string;
  image_path: string;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function imageUrl(name: string | null | undefined): string | null {
  if (!name) return null;
  return `${API_URL}/api/images/${encodeURIComponent(name)}`;
}

export async function listRecipes(q?: string): Promise<Recipe[]> {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return handle<Recipe[]>(
    await fetch(`${API_URL}/api/recipes${qs}`, { cache: "no-store" }),
  );
}

export async function getRecipe(id: number): Promise<Recipe> {
  return handle<Recipe>(
    await fetch(`${API_URL}/api/recipes/${id}`, { cache: "no-store" }),
  );
}

export async function createRecipe(input: {
  title: string;
  content: string;
  tags?: string;
  image_path?: string | null;
}): Promise<Recipe> {
  return handle<Recipe>(
    await fetch(`${API_URL}/api/recipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateRecipe(
  id: number,
  patch: { title?: string; content?: string; tags?: string },
): Promise<Recipe> {
  return handle<Recipe>(
    await fetch(`${API_URL}/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteRecipe(id: number): Promise<void> {
  await handle<void>(
    await fetch(`${API_URL}/api/recipes/${id}`, { method: "DELETE" }),
  );
}

export async function importFile(file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  return handle<ImportResult>(
    await fetch(`${API_URL}/api/recipes/import`, {
      method: "POST",
      body: fd,
    }),
  );
}
