"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeCard } from "@/components/recipe-card";
import { listRecipes, type Recipe } from "@/lib/api";

export default function Home() {
  const [q, setQ] = useState("");
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      listRecipes(q)
        .then((r) => {
          if (!cancelled) {
            setRecipes(r);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(String(e.message ?? e));
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const empty = useMemo(
    () => recipes !== null && recipes.length === 0,
    [recipes],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Recipes</h1>
        <p className="text-stone-500">
          Snap a photo of a clipping and we&rsquo;ll save it here.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, ingredient, or tag…"
          className="h-12 pl-10 text-base bg-white"
          autoFocus
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&rsquo;t load recipes: {error}. Is the backend running on port 8000?
        </div>
      )}

      {recipes === null && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      )}

      {empty && !q && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white py-16 px-6 text-center">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-stone-100 text-2xl">
            📸
          </div>
          <h2 className="text-lg font-semibold">No recipes yet</h2>
          <p className="text-stone-500 mt-1 mb-5 max-w-sm mx-auto">
            Take a photo of a recipe clipping and we&rsquo;ll turn it into a
            searchable, editable recipe.
          </p>
          <Link href="/new" className={cn(buttonVariants({ size: "lg" }))}>
            <Plus className="size-4" />
            Add your first recipe
          </Link>
        </div>
      )}

      {empty && q && (
        <div className="rounded-xl border border-stone-200 bg-white py-12 text-center">
          <p className="text-stone-500">
            No recipes match &ldquo;{q}&rdquo;.
          </p>
        </div>
      )}

      {recipes && recipes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}
