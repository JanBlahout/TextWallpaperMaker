"use client";

import type { Editor } from "@/editor";

/**
 * Resets the wallpaper to the starting wallpaper. It's one undo step, so it
 * doesn't ask for confirmation.
 */
export function NewWallpaperButton({ editor }: { editor: Editor | null }) {
  return (
    <button
      type="button"
      onClick={() => editor?.newWallpaper()}
      disabled={!editor}
      title="Reset to the starting wallpaper. Undo brings yours back."
      className="w-full rounded-md border border-neutral-700 px-3 py-1.5 text-left text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      New wallpaper
    </button>
  );
}
