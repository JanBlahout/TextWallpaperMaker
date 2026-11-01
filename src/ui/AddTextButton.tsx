"use client";

import type { Editor } from "@/editor";

/**
 * Adds a text block reading "TEXT" in the middle of the safe area, in the
 * selected block's style, and opens it for typing straight away.
 */
export function AddTextButton({ editor }: { editor: Editor }) {
  return (
    <section className="border-b border-neutral-800 px-4 py-3">
      <button
        type="button"
        onClick={() => editor.addText()}
        title="Add a text block in the middle of the safe area, in the selected block's style."
        className="flex w-full items-center gap-2 rounded-md border border-neutral-700 px-3 py-1.5 text-left text-xs text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50"
      >
        <span aria-hidden className="font-mono text-sm leading-none text-neutral-400">
          +
        </span>
        Add text
      </button>
    </section>
  );
}
