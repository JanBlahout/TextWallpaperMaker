"use client";

import { useId, useState } from "react";
import {
  clampResolution,
  PRESET_GROUPS,
  RESOLUTION_RANGE,
  sameResolution,
  type Editor,
  type Resolution,
} from "@/editor";

/**
 * The left sidebar's resolution controls: a preset selector and custom width
 * and height fields. Every change re-fits the text blocks as one undo step.
 */
export function ResolutionControls({ editor, resolution }: { editor: Editor; resolution: Resolution }) {
  return (
    <section className="flex flex-col gap-2 border-b border-neutral-800 px-4 py-3">
      <h2 className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Resolution</h2>
      <PresetSelector editor={editor} resolution={resolution} />
      <CustomSize editor={editor} resolution={resolution} />
    </section>
  );
}

/**
 * A disclosure listing the presets in their Desktop and Mobile groups, each
 * showing its size first and its name second. Choosing one applies it and
 * closes the list.
 */
function PresetSelector({ editor, resolution }: { editor: Editor; resolution: Resolution }) {
  const [open, setOpen] = useState(false);
  const groupId = useId();
  const current = PRESET_GROUPS.flatMap((group) => group.presets).find((preset) => sameResolution(preset, resolution));

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        setOpen(false);
        event.currentTarget.querySelector("summary")?.focus();
      }}
      className="group"
    >
      <summary
        aria-label={`Resolution presets: ${resolution.width} × ${resolution.height}, ${current?.name ?? "custom"}`}
        className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 hover:border-neutral-600 focus-visible:border-neutral-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        <span className="font-mono text-xs text-neutral-100 tabular-nums">
          {resolution.width} × {resolution.height}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500">{current?.name ?? "Custom"}</span>
        <Chevron />
      </summary>

      <div className="mt-1 flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-950 p-1">
        {PRESET_GROUPS.map((group) => (
          <div key={group.name} role="group" aria-labelledby={`${groupId}-${group.name}`}>
            <h3
              id={`${groupId}-${group.name}`}
              className="px-2 pt-1 pb-0.5 text-[10px] font-medium tracking-wide text-neutral-600 uppercase"
            >
              {group.name}
            </h3>
            <ul>
              {group.presets.map((preset) => (
                <li key={`${preset.width}x${preset.height}`}>
                  <button
                    type="button"
                    aria-pressed={sameResolution(preset, resolution)}
                    onClick={() => {
                      editor.setResolution(preset);
                      setOpen(false);
                    }}
                    className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 focus-visible:bg-neutral-800 focus-visible:outline-none aria-pressed:bg-neutral-800 aria-pressed:text-neutral-100"
                  >
                    <span className="font-mono text-xs tabular-nums">
                      {preset.width} × {preset.height}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right text-[11px] text-neutral-500">
                      {preset.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="size-3 shrink-0 text-neutral-500 transition-transform group-open:rotate-180"
    >
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

type Side = "width" | "height";

/**
 * Width and height fields that apply only on Enter or when you leave the
 * field, never per keystroke, so half-typed numbers don't re-fit the layout.
 * When the Editor has to round or clamp a value, a short note says so.
 */
function CustomSize({ editor, resolution }: { editor: Editor; resolution: Resolution }) {
  /** The latest note, kept with the resolution it's about so it goes away once that changes. */
  const [note, setNote] = useState<{ text: string; about: Resolution } | null>(null);

  const apply = (side: Side, value: number) => {
    const requested = { ...resolution, [side]: value };
    const applied = clampResolution(requested);
    editor.setResolution(requested);
    setNote(
      applied[side] === value
        ? null
        : {
            text: `${side === "width" ? "Width" : "Height"} set to ${applied[side]} px: sizes are whole pixels from ${RESOLUTION_RANGE.min} to ${RESOLUTION_RANGE.max}.`,
            about: applied,
          },
    );
  };

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <SizeField side="width" value={resolution.width} onCommit={apply} />
        <span aria-hidden className="text-[11px] text-neutral-600">
          ×
        </span>
        <SizeField side="height" value={resolution.height} onCommit={apply} />
        <span className="text-[11px] text-neutral-600">px</span>
      </div>
      {/* Always rendered, so screen readers announce the note when it appears. */}
      <p role="status" className="mt-1.5 text-[11px] leading-snug text-neutral-400 empty:mt-0">
        {note && sameResolution(note.about, resolution) ? note.text : null}
      </p>
    </div>
  );
}

/**
 * One side's field. Typing only edits a draft; Enter or leaving the field
 * commits it (Enter leaves the field, so Cmd/Ctrl+Z undoes the change straight
 * away). Escape discards the draft, and a draft that isn't a number is dropped.
 */
function SizeField({
  side,
  value,
  onCommit,
}: {
  side: Side;
  value: number;
  onCommit: (side: Side, value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const label = side === "width" ? "Width" : "Height";

  const commit = () => {
    if (draft !== null && draft.trim() !== "" && !Number.isNaN(Number(draft))) onCommit(side, Number(draft));
    setDraft(null);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-950 pl-2 focus-within:border-neutral-500">
      <label htmlFor={id} className="text-[11px] text-neutral-500" title={label}>
        <span aria-hidden>{label[0]}</span>
        <span className="sr-only">{label}</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={RESOLUTION_RANGE.min}
        max={RESOLUTION_RANGE.max}
        step={1}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          else if (event.key === "Escape") setDraft(null);
        }}
        className="w-full min-w-0 bg-transparent py-1 pr-2 text-right font-mono text-xs text-neutral-100 tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}
