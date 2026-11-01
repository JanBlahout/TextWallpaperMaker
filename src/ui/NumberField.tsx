"use client";

import { useId, useState } from "react";

interface NumberFieldProps {
  /** The field's name, e.g. "Font size". */
  label: string;
  /** A shorter name shown inside the field, e.g. "Size"; the full name is read out. Omit to show none. */
  shortLabel?: string;
  /** Shown after the value, e.g. "px". */
  unit: string;
  value: number;
  /** How many decimal places the value is shown to, at most; trailing zeros are dropped. */
  decimals: number;
  /** How far the arrow keys step the value. */
  step: number;
  min?: number;
  max?: number;
  /** Commits a value; NaN when what was typed isn't a number (the Editor ignores it). */
  onCommit: (value: number) => void;
}

/**
 * A number field that commits when it loses focus, which Enter also does, so
 * each edit is one undo step. Typing only edits a draft, and Escape discards
 * it. When the Editor ignores or adjusts what was typed, the field then shows
 * the value actually used.
 */
export function NumberField({ label, shortLabel, unit, value, decimals, step, min, max, onCommit }: NumberFieldProps) {
  const id = useId();
  /** The text while it's being edited; null shows the current value. */
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 focus-within:border-neutral-500">
      <label htmlFor={id} className="shrink-0 text-[11px] text-neutral-500" title={label}>
        {shortLabel && <span aria-hidden>{shortLabel}</span>}
        <span className="sr-only">{label}</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={draft ?? formatNumber(value, decimals)}
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
        className="w-full min-w-0 bg-transparent py-1 text-right font-mono text-xs text-neutral-100 tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span aria-hidden className="shrink-0 text-[11px] text-neutral-500">
        {unit}
      </span>
    </div>
  );
}

/** The value rounded to at most `decimals` places, e.g. 103.2 or 96 for one place. */
function formatNumber(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}
