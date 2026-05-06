import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Recipe, imageUrl } from "@/lib/api";

function previewText(content: string): string {
  return content
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const tags = recipe.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const img = imageUrl(recipe.image_path);

  return (
    <Link href={`/recipes/${recipe.id}`} className="block group">
      <Card className="overflow-hidden h-full p-0 transition-shadow group-hover:shadow-md">
        {img ? (
          <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={recipe.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div className="aspect-[4/3] w-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center text-3xl text-stone-400">
            🍳
          </div>
        )}
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold leading-tight tracking-tight text-base line-clamp-2">
            {recipe.title}
          </h3>
          <p className="text-xs text-stone-500 line-clamp-2 min-h-[2rem]">
            {previewText(recipe.content) || "No notes yet"}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.slice(0, 4).map((t) => (
                <Badge key={t} variant="secondary" className="text-xs font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
