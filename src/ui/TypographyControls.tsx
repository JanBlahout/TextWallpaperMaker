"use client";

import { useId, useRef, type ReactNode } from "react";
import { LINE_ALIGNS, type Editor, type LineAlign, type TextBlock } from "@/editor";
import { FONTS, fontById } from "@/fonts/registry";
import { ColorField } from "./ColorField";
import { useWallpaper } from "./editorStore";
import { NumberField } from "./NumberField";
import { Toggle } from "./Toggle";
import { useNativeChange } from "./useNativeChange";

const WEIGHT_NAMES: Partial<Record<number, string>> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

const ALIGN_LABELS: Record<LineAlign, string> = { left: "Left", center: "Centre", right: "Right" };

const SELECT_CLASSES =
  "w-full min-w-0 cursor-pointer rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 hover:border-neutral-600 focus:border-neutral-500 focus:outline-none";

/**
 * The inspector's typography controls for the selected text block. Each
 * committed change is one undo step: picking from a list, Enter or leaving a
 * field, or releasing the colour picker or the opacity slider. Moving around
 * inside the picker or dragging the slider only previews.
 */
export function TypographyControls({ editor, blockId }: { editor: Editor; blockId: string }) {
  const block = useWallpaper()?.blocks.find(({ id }) => id === blockId);
  if (!block) return null;
  const { weights } = fontById(block.fontId);
  const commitOpacity = (opacity: number) => editor.setTypography({ opacity });

  return (
    <section className="mt-3 flex flex-col gap-2">
      <h3 className="text-xs text-neutral-400">Typography</h3>

      <Row label="Font">
        {(id) => (
          <select
            id={id}
            value={block.fontId}
            onChange={(event) => editor.setTypography({ fontId: event.target.value })}
            className={SELECT_CLASSES}
          >
            {FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        )}
      </Row>

      {/* A single-weight font, like OCR A, has nothing to choose. */}
      {weights.length > 1 && (
        <Row label="Weight">
          {(id) => (
            <select
              id={id}
              value={block.fontWeight}
              onChange={(event) => editor.setTypography({ fontWeight: Number(event.target.value) })}
              className={SELECT_CLASSES}
            >
              {weights.map((weight) => (
                <option key={weight} value={weight}>
                  {WEIGHT_NAMES[weight] ?? weight} {weight}
                </option>
              ))}
            </select>
          )}
        </Row>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Font size"
          shortLabel="Size"
          unit="px"
          value={block.fontSize}
          decimals={1}
          step={1}
          min={0}
          onCommit={(fontSize) => editor.setTypography({ fontSize })}
        />
        <NumberField
          label="Letter spacing"
          shortLabel="Spacing"
          unit="%"
          value={block.letterSpacing}
          decimals={2}
          step={1}
          onCommit={(letterSpacing) => editor.setTypography({ letterSpacing })}
        />
        <NumberField
          label="Line height"
          shortLabel="Line"
          unit="×"
          value={block.lineHeight}
          decimals={2}
          step={0.05}
          min={0}
          onCommit={(lineHeight) => editor.setTypography({ lineHeight })}
        />
      </div>

      <LineAlignControl editor={editor} block={block} />

      <Row label="Colour">
        <ColorField
          label="Text colour"
          value={block.color}
          onPreview={(color) => editor.setTypography({ color }, { preview: true })}
          onCommit={(color) => editor.setTypography({ color })}
        />
      </Row>

      <Row label="Opacity">
        <div className="flex items-center gap-2">
          <OpacitySlider
            value={block.opacity}
            onPreview={(opacity) => editor.setTypography({ opacity }, { preview: true })}
            onCommit={commitOpacity}
          />
          <div className="w-16 shrink-0">
            <NumberField
              label="Opacity percentage"
              unit="%"
              value={block.opacity}
              decimals={1}
              step={1}
              min={0}
              max={100}
              onCommit={commitOpacity}
            />
          </div>
        </div>
      </Row>

      <Toggle checked={block.uppercase} onChange={(uppercase) => editor.setTypography({ uppercase })}>
        Uppercase
      </Toggle>
    </section>
  );
}

const ROW_LABEL_CLASSES = "w-14 shrink-0 text-xs text-neutral-400";

/**
 * A row with a caption on the left and the controls filling the rest. Given a
 * function, the caption labels the one control it renders with the given id;
 * otherwise the controls carry their own names.
 */
function Row({ label, children }: { label: string; children: ReactNode | ((id: string) => ReactNode) }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      {typeof children === "function" ? (
        <label htmlFor={id} className={ROW_LABEL_CLASSES}>
          {label}
        </label>
      ) : (
        <span aria-hidden className={ROW_LABEL_CLASSES}>
          {label}
        </span>
      )}
      <div className="min-w-0 flex-1">{typeof children === "function" ? children(id) : children}</div>
    </div>
  );
}

/** Left, centre or right: how the block's lines line up inside its box. */
function LineAlignControl({ editor, block }: { editor: Editor; block: TextBlock }) {
  const name = useId();
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="float-left w-14 shrink-0 text-xs text-neutral-400">Align</legend>
      <div className="flex flex-1 rounded-md border border-neutral-700 p-0.5">
        {LINE_ALIGNS.map((align) => (
          <label
            key={align}
            className="flex-1 cursor-pointer rounded px-2 py-0.5 text-center text-[11px] text-neutral-400 transition-colors hover:text-neutral-200 has-checked:bg-neutral-700 has-checked:text-neutral-100 has-focus-visible:ring-1 has-focus-visible:ring-neutral-400"
          >
            <input
              type="radio"
              name={name}
              value={align}
              checked={block.align === align}
              onChange={() => editor.setTypography({ align })}
              className="sr-only"
            />
            {ALIGN_LABELS[align]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Dragging previews the opacity; releasing the slider commits it. The arrow
 * keys commit each step.
 */
function OpacitySlider({
  value,
  onPreview,
  onCommit,
}: {
  value: number;
  onPreview: (opacity: number) => void;
  onCommit: (opacity: number) => void;
}) {
  const sliderRef = useRef<HTMLInputElement>(null);
  useNativeChange(sliderRef, (slider) => onCommit(slider.valueAsNumber));

  return (
    <input
      ref={sliderRef}
      type="range"
      aria-label="Opacity"
      min={0}
      max={100}
      step={1}
      value={value}
      onChange={(event) => onPreview(event.target.valueAsNumber)}
      className="min-w-0 flex-1 cursor-pointer accent-neutral-300"
    />
  );
}
