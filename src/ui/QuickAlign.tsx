"use client";

import { useId } from "react";
import type { AlignPosition, AlignTarget } from "@/editor";
import { useEditor, useSettings, useView } from "./editorStore";

/** Where an icon's line sits: at the start, the centre or the end. */
type IconAt = keyof typeof ICON_SHAPES;

interface AlignAction {
  position: AlignPosition;
  label: string;
  icon: { at: IconAt; vertical: boolean };
}

/** The six actions in two groups: across, then up and down. */
const ACTION_GROUPS: readonly (readonly AlignAction[])[] = [
  [
    { position: "left", label: "Align left", icon: { at: "start", vertical: false } },
    { position: "centre", label: "Centre horizontally", icon: { at: "centre", vertical: false } },
    { position: "right", label: "Align right", icon: { at: "end", vertical: false } },
  ],
  [
    { position: "top", label: "Align top", icon: { at: "start", vertical: true } },
    { position: "middle", label: "Centre vertically", icon: { at: "centre", vertical: true } },
    { position: "bottom", label: "Align bottom", icon: { at: "end", vertical: true } },
  ],
];

const TARGETS: readonly { target: AlignTarget; label: string }[] = [
  { target: "safe-area", label: "Safe area" },
  { target: "wallpaper", label: "Wallpaper" },
];

/**
 * The inspector's quick-align actions: six buttons that line the selected
 * block up with the safe area or the whole wallpaper, as the switch beside
 * them says. Each click is one undo step. The buttons are disabled when
 * nothing is selected; the switch is an editor setting, so it always works.
 */
export function QuickAlign() {
  const editor = useEditor();
  const settings = useSettings();
  const hasSelection = Boolean(useView()?.selection);
  const headingId = useId();
  const switchName = useId();

  return (
    <section aria-labelledby={headingId} className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-xs text-neutral-400">
          Align
        </h3>
        <fieldset disabled={!editor || !settings} className="flex rounded-md border border-neutral-700 p-0.5">
          <legend className="sr-only">Align to</legend>
          {TARGETS.map(({ target, label }) => (
            <label
              key={target}
              className="cursor-pointer rounded px-2 py-0.5 text-[11px] text-neutral-400 transition-colors hover:text-neutral-200 has-checked:bg-neutral-700 has-checked:text-neutral-100 has-focus-visible:ring-1 has-focus-visible:ring-neutral-400"
            >
              <input
                type="radio"
                name={switchName}
                value={target}
                checked={settings?.alignTarget === target}
                onChange={() => editor?.setSettings({ alignTarget: target })}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {ACTION_GROUPS.map((actions) => (
          <div key={actions[0].position} className="flex rounded-md border border-neutral-700 p-0.5">
            {actions.map(({ position, label, icon }) => (
              <button
                key={position}
                type="button"
                aria-label={label}
                title={label}
                disabled={!editor || !hasSelection}
                onClick={() => editor?.align(position)}
                className="flex flex-1 justify-center rounded py-1 text-neutral-300 transition-colors focus-visible:ring-1 focus-visible:ring-neutral-400 focus-visible:outline-none enabled:cursor-pointer enabled:hover:bg-neutral-800 enabled:hover:text-neutral-100 disabled:text-neutral-700"
              >
                <AlignIcon {...icon} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The horizontal icons, in a 16 × 16 box: where the 1 px line's left side is,
 * and the two bars lined up with it, as [left, width].
 */
const ICON_SHAPES = {
  start: { line: 2, bars: [[4, 9], [4, 6]] },
  centre: { line: 7.5, bars: [[3, 10], [5, 6]] },
  end: { line: 13, bars: [[3, 9], [6, 6]] },
} as const satisfies Record<string, { line: number; bars: readonly (readonly [number, number])[] }>;

/** A line at the target's edge or centre, with two bars lined up with it. */
function AlignIcon({ at, vertical }: { at: IconAt; vertical: boolean }) {
  const { line, bars } = ICON_SHAPES[at];
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      {/* A vertical icon is the horizontal one mirrored across the diagonal, which swaps x and y. */}
      <g fill="currentColor" transform={vertical ? "matrix(0 1 1 0 0 0)" : undefined}>
        <rect x={line} y={2} width={1} height={12} />
        {bars.map(([left, width], i) => (
          <rect key={i} x={left} y={i === 0 ? 4 : 9} width={width} height={3} rx={0.5} />
        ))}
      </g>
    </svg>
  );
}
