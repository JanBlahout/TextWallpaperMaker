"use client";

import { useId, useState, type ReactNode } from "react";
import { GRID_COLUMNS_RANGE, SAFE_MARGINS, type Editor, type EditorSettings } from "@/editor";

/**
 * The left sidebar's guide controls: safe margin, grid columns and the two
 * visibility toggles. They change editor settings, never the wallpaper.
 */
export function GuideSettings({ editor, settings }: { editor: Editor; settings: EditorSettings }) {
  return (
    <section className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-3">
      <h2 className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">Guides</h2>

      <fieldset className="flex items-center justify-between gap-2">
        <legend className="float-left text-xs text-neutral-400">Safe margin</legend>
        <div className="flex rounded-md border border-neutral-700 p-0.5">
          {SAFE_MARGINS.map((margin) => (
            <label
              key={margin}
              className="cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] text-neutral-400 tabular-nums transition-colors hover:text-neutral-200 has-checked:bg-neutral-700 has-checked:text-neutral-100 has-focus-visible:ring-1 has-focus-visible:ring-neutral-400"
            >
              <input
                type="radio"
                name="safe-margin"
                value={margin}
                checked={settings.safeMargin === margin}
                onChange={() => editor.setSettings({ safeMargin: margin })}
                className="sr-only"
              />
              {margin}%
            </label>
          ))}
        </div>
      </fieldset>

      <GridColumnsField editor={editor} columns={settings.gridColumns} />

      <Toggle checked={settings.gridVisible} onChange={(gridVisible) => editor.setSettings({ gridVisible })}>
        Show grid
      </Toggle>
      <Toggle
        checked={settings.safeAreaVisible}
        onChange={(safeAreaVisible) => editor.setSettings({ safeAreaVisible })}
      >
        Show safe area and centre lines
      </Toggle>
    </section>
  );
}

/**
 * Sends each value as it's typed, so the grid follows along; the Editor
 * ignores what isn't a number and keeps the rest in range. Leaving the field
 * shows the count actually used.
 */
function GridColumnsField({ editor, columns }: { editor: Editor; columns: number }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const finish = () => setDraft(null);

  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs text-neutral-400">
        Grid columns
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={GRID_COLUMNS_RANGE.min}
        max={GRID_COLUMNS_RANGE.max}
        step={1}
        value={draft ?? columns}
        onChange={(event) => {
          setDraft(event.target.value);
          editor.setSettings({ gridColumns: event.target.valueAsNumber });
        }}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish();
        }}
        className="w-16 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-right font-mono text-xs text-neutral-100 tabular-nums focus:border-neutral-500 focus:outline-none"
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-400 hover:text-neutral-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 cursor-pointer accent-neutral-300"
      />
      {children}
    </label>
  );
}
