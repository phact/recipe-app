"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown";
import {
  deleteRecipe,
  getRecipe,
  imageUrl,
  type Recipe,
  updateRecipe,
} from "@/lib/api";

export default function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const recipeId = Number(id);
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (Number.isNaN(recipeId)) {
      setError("Invalid recipe id");
      return;
    }
    getRecipe(recipeId)
      .then((r) => {
        setRecipe(r);
        setTitle(r.title);
        setContent(r.content);
        setTags(r.tags);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [recipeId]);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title can't be empty.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateRecipe(recipeId, { title, content, tags });
      setRecipe(updated);
      setEditing(false);
      toast.success("Saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't save: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteRecipe(recipeId);
      toast.success("Recipe deleted.");
      router.push("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't delete: ${msg}`);
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-4",
          )}
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const tagList = recipe.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const img = imageUrl(recipe.image_path);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2",
          )}
        >
          <ArrowLeft className="size-4" /> Back to recipes
        </Link>
        {!editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-stone-200"
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setTitle(recipe.title);
                setContent(recipe.content);
                setTags(recipe.tags);
              }}
              disabled={saving}
            >
              <X className="size-4" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="size-4" /> Save
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {img && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={recipe.title}
            className="w-full max-h-96 object-contain"
          />
        </div>
      )}

      {!editing ? (
        <article className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {recipe.title}
            </h1>
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tagList.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            {recipe.content.trim() ? (
              <Markdown>{recipe.content}</Markdown>
            ) : (
              <p className="text-stone-500 italic">No notes yet.</p>
            )}
          </div>
        </article>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated, tags"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Recipe</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[400px] font-mono text-sm bg-white"
            />
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this recipe?</DialogTitle>
            <DialogDescription>
              &ldquo;{recipe.title}&rdquo; will be removed permanently. This
              can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" /> Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
