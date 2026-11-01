"use client";

import { useCallback } from "react";
import type { Editor, Wallpaper } from "@/editor";
import { ColorField } from "./ColorField";

/**
 * The left sidebar's background colour controls. Each committed colour is one
 * undo step; moving around inside the picker only previews.
 */
export function BackgroundControls({ editor, wallpaper }: { editor: Editor; wallpaper: Wallpaper }) {
  const preview = useCallback((color: string) => editor.setBackground(color, { preview: true }), [editor]);
  const commit = useCallback((color: string) => editor.setBackground(color), [editor]);

  return (
    <section className="border-b border-neutral-800 px-4 py-3">
      <h2 className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Background</h2>
      <div className="mt-2">
        <ColorField label="Background colour" value={wallpaper.background} onPreview={preview} onCommit={commit} />
      </div>
    </section>
  );
}
