"use client";

import { useEditor, useView } from "./editorStore";

const ACTIONS = [
  { label: "Duplicate", title: "Duplicate the block (Cmd/Ctrl+D)", run: "duplicate" },
  { label: "Delete", title: "Delete the block (Delete)", run: "delete" },
] as const;

/**
 * The inspector's Duplicate and Delete for the selected text block, as
 * Cmd/Ctrl+D and Delete/Backspace also do. Each click is one undo step. The
 * buttons are disabled when nothing is selected.
 */
export function BlockActions() {
  const editor = useEditor();
  const hasSelection = Boolean(useView()?.selection);

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {ACTIONS.map(({ label, title, run }) => (
        <button
          key={run}
          type="button"
          title={title}
          disabled={!editor || !hasSelection}
          onClick={() => editor?.[run]()}
          className="rounded-md border border-neutral-700 py-1 text-xs text-neutral-300 transition-colors focus-visible:ring-1 focus-visible:ring-neutral-400 focus-visible:outline-none enabled:cursor-pointer enabled:hover:border-neutral-500 enabled:hover:text-neutral-100 disabled:border-neutral-800 disabled:text-neutral-700"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
