"use client";

import { useId, useRef, useState } from "react";
import type { Editor } from "@/editor";
import { useWallpaper } from "./editorStore";

/** The fewest and most lines the field shows before it scrolls. */
const ROWS = { min: 2, max: 8 } as const;

/**
 * The inspector's text field for the selected block: multi-line, with Enter
 * inserting a line break, and showing the text as typed (uppercase only
 * changes how the canvas draws it). Lines never wrap, as on the canvas
 * (ADR 0002). Typing shows on the canvas straight away; leaving the field
 * commits, as one undo step, and Escape goes back to the text from before.
 */
export function BlockTextField({ editor, blockId }: { editor: Editor; blockId: string }) {
  const id = useId();
  const text = useWallpaper()?.blocks.find((block) => block.id === blockId)?.text ?? "";
  /** The text while it's being edited; null shows the block's text. */
  const [draft, setDraft] = useState<string | null>(null);
  /** The block's text when editing started, for Escape to go back to. */
  const original = useRef(text);
  const value = draft ?? text;

  return (
    <section className="mt-3">
      <label htmlFor={id} className="text-xs text-neutral-400">
        Text
      </label>
      <textarea
        id={id}
        value={value}
        rows={Math.min(ROWS.max, Math.max(ROWS.min, value.split("\n").length))}
        wrap="off"
        spellCheck={false}
        autoComplete="off"
        onFocus={() => {
          original.current = text;
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          editor.setText(event.target.value, { preview: true });
        }}
        onBlur={() => {
          if (draft !== null) editor.setText(draft);
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || draft === null) return;
          editor.setText(original.current, { preview: true });
          setDraft(null);
        }}
        className="mt-2 block w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-xs leading-5 text-neutral-100 focus:border-neutral-500 focus:outline-none"
      />
    </section>
  );
}
