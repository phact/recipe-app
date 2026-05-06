import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-stone-900 text-base text-white">
            ✦
          </span>
          <span className="text-lg">Family Recipes</span>
        </Link>
        <Link href="/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4" />
          New recipe
        </Link>
      </div>
    </header>
  );
}
