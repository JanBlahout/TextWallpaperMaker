"use client";

import { useId, useState } from "react";
import type { Box, Editor } from "@/editor";
import { BlockActions } from "./BlockActions";
import { useEditor, useView } from "./editorStore";
import { QuickAlign } from "./QuickAlign";
import { TypographyControls } from "./TypographyControls";

/**
 * The right sidebar: properties of the selected text block, or a short hint
 * when nothing is selected, then the quick-align actions, then Duplicate and Delete.
 */
export function Inspector() {
  const editor = useEditor();
  const selection = useView()?.selection ?? null;
  const headingId = useId();

  return (
    <aside aria-labelledby={headingId} className="border-l border-neutral-800 bg-neutral-900 px-4 py-3">
      <h2 id={headingId} className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
        Inspector
      </h2>
      {editor && selection ? (
        <>
          <TypographyControls editor={editor} blockId={selection.id} />
          <PositionFields editor={editor} box={selection.box} />
        </>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">Select a text block to edit its text, typography and position.</p>
      )}
      <QuickAlign />
      <BlockActions />
    </aside>
  );
}

/**
 * X and Y of the box's top-left corner in wallpaper px, from the wallpaper's
 * top-left. Width and height are read-only: the box always hugs its text (ADR 0002).
 */
function PositionFields({ editor, box }: { editor: Editor; box: Box }) {
  return (
    <section className="mt-3">
      <h3 className="text-xs text-neutral-400">Position</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <CoordinateField label="X" value={box.x} onCommit={(x) => editor.setPosition({ x })} />
        <CoordinateField label="Y" value={box.y} onCommit={(y) => editor.setPosition({ y })} />
        <ReadOnlyField label="W" name="Width" value={box.width} />
        <ReadOnlyField label="H" name="Height" value={box.height} />
      </div>
    </section>
  );
}

const FIELD_CLASSES =
  "w-full min-w-0 rounded-md border px-2 py-1 text-right font-mono text-xs tabular-nums focus:outline-none";

/**
 * A number field that commits when it loses focus, which Enter also does, so
 * each edit is one undo step. Escape discards what was typed. The Editor
 * ignores what isn't a number, and the field then shows the current value.
 */
function CoordinateField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  /** The text while it's being edited; null shows the current value. */
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <label className="flex items-center gap-2">
      <span className="w-3 text-[11px] text-neutral-500">{label}</span>
      <input
        type="number"
        step="any"
        value={draft ?? formatPx(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          if (draft !== null) onCommit(event.currentTarget.valueAsNumber);
          setDraft(null);
        }}
        onKeyDown={(event) => {
          // Leaving the field commits, and lets Cmd/Ctrl+Z undo the change straight away.
          if (event.key === "Enter") event.currentTarget.blur();
          else if (event.key === "Escape") setDraft(null);
        }}
        className={`${FIELD_CLASSES} border-neutral-700 bg-neutral-950 text-neutral-100 focus:border-neutral-500`}
      />
    </label>
  );
}

function ReadOnlyField({ label, name, value }: { label: string; name: string; value: number }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-3 text-[11px] text-neutral-500">{label}</span>
      <input
        type="number"
        readOnly
        aria-label={name}
        value={formatPx(value)}
        className={`${FIELD_CLASSES} border-neutral-800 bg-transparent text-neutral-400`}
      />
    </label>
  );
}

/** Wallpaper px with at most two decimals, e.g. 709.2 or 576. */
function formatPx(value: number) {
  return String(Math.round(value * 100) / 100);
}
