"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  createRecipe,
  imageUrl,
  importFile,
  type ImportResult,
} from "@/lib/api";
import { shrinkImage } from "@/lib/resize";

export default function NewRecipePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  async function handleFile(f: File | null) {
    if (!f) return;
    setImporting(true);
    try {
      const shrunk = await shrinkImage(f);
      const result = await importFile(shrunk);
      setImported(result);
      setTitle(result.suggested_title);
      setContent(result.markdown);
      toast.success("Recipe extracted! Edit anything that looks off, then save.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Import failed: ${msg}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Please add a title.");
      return;
    }
    setSaving(true);
    try {
      const recipe = await createRecipe({
        title,
        content,
        tags,
        image_path: imported?.image_path ?? null,
      });
      toast.success("Recipe saved!");
      router.push(`/recipes/${recipe.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't save: ${msg}`);
      setSaving(false);
    }
  }

  function startBlank() {
    setImported({ suggested_title: "", markdown: "", image_path: "" });
    setTitle("");
    setContent("");
  }

  const previewImg = imageUrl(imported?.image_path);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
        >
          <ArrowLeft className="size-4" /> Back to recipes
        </Link>
      </div>

      {!imported && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-stone-100 text-3xl">
              📸
            </div>
            <div>
              <h2 className="text-xl font-semibold">Add a new recipe</h2>
              <p className="text-stone-500 mt-1">
                Snap a photo of a clipping or upload a PDF — we&rsquo;ll pull the
                text out for you.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                size="lg"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Reading clipping…
                  </>
                ) : (
                  <>
                    <Camera className="size-4" />
                    Take or upload photo
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={startBlank}
                disabled={importing}
              >
                <Upload className="size-4" />
                Type it in instead
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {imported && (
        <div className="space-y-6">
          {previewImg && (
            <Card className="overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImg}
                alt="Original clipping"
                className="w-full max-h-80 object-contain bg-stone-100"
              />
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grandma's apple pie"
              className="text-base bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. dessert, baking, holidays"
              className="bg-white"
            />
            <p className="text-xs text-stone-500">
              Comma-separated. Helps with searching later.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Recipe</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                "## Ingredients\n- 2 cups flour\n\n## Steps\n1. Mix everything…"
              }
              className="min-h-[400px] font-mono text-sm bg-white"
            />
            <p className="text-xs text-stone-500">
              Edit freely — formatted with Markdown. Use <code>##</code> for
              section headings and <code>-</code> for list items.
            </p>
          </div>

          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-stone-50/95 backdrop-blur border-t border-stone-200 flex gap-3 justify-end">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setImported(null);
                setTitle("");
                setContent("");
                setTags("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="size-4" /> Save recipe
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
