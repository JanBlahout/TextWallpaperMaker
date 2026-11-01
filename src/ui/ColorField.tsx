"use client";

import { useEffect, useRef, useState } from "react";
import { parseHexColor } from "@/editor";

interface ColorFieldProps {
  /** Names the colour for assistive tech, e.g. "Background colour". */
  label: string;
  /** The current colour as "#RRGGBB". */
  value: string;
  /** Shows a colour without committing it: called while moving around inside the picker. */
  onPreview: (color: string) => void;
  /** Commits a colour from the picker, or the hex field's text as typed (the Editor rejects invalid hex). */
  onCommit: (color: string) => void;
}

/**
 * A colour picker plus a hex field. Moving around inside the picker previews;
 * releasing or closing it commits. The hex field commits when it loses focus,
 * which Enter also does, and goes back to the current colour if its text was
 * rejected. Escape discards what was typed.
 */
export function ColorField({ label, value, onPreview, onCommit }: ColorFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  /** The hex field's text while it's being edited; null shows the current colour. */
  const [draft, setDraft] = useState<string | null>(null);

  // React's onChange fires on every `input` event. The native `change` event
  // fires once the picker is released or closed: that's the commit.
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const commit = () => onCommit(picker.value);
    picker.addEventListener("change", commit);
    return () => picker.removeEventListener("change", commit);
  }, [onCommit]);

  const commitDraft = () => {
    if (draft !== null) onCommit(draft);
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={pickerRef}
        type="color"
        aria-label={label}
        value={value.toLowerCase()}
        onChange={(event) => onPreview(event.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-neutral-700 bg-transparent p-0 [&::-moz-color-swatch]:rounded-[3px] [&::-moz-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-[3px] [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <input
        type="text"
        aria-label={`${label} hex`}
        value={draft ?? value}
        aria-invalid={draft !== null && parseHexColor(draft) === null}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          // Leaving the field commits, and lets Cmd/Ctrl+Z undo the change straight away.
          if (event.key === "Enter") event.currentTarget.blur();
          else if (event.key === "Escape") setDraft(null);
        }}
        className="h-7 w-full min-w-0 rounded border border-neutral-700 bg-neutral-950 px-2 font-mono text-xs text-neutral-200 uppercase outline-none focus:border-neutral-500 aria-invalid:border-red-500/60"
      />
    </div>
  );
}
