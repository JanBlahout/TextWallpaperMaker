"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { letterSpacingPx, type Box, type Editor, type LineAlign, type TextBlock } from "@/editor";
import { fontById } from "@/fonts/registry";
import type { RenderTransform } from "@/render/renderWallpaper";

/** A point on screen, in CSS px from the viewport's top-left (like a pointer event's clientX and clientY). */
export interface ScreenPoint {
  x: number;
  y: number;
}

interface InPlaceTextEditorProps {
  editor: Editor;
  /** The block whose text is being edited. */
  block: TextBlock;
  /** Its box, measured from its text, in wallpaper px. */
  box: Box;
  /** Wallpaper px to CSS px over the canvas: the transform the canvas layers are drawn with. */
  transform: RenderTransform;
  /** Where the block was double-clicked to open it, or null when it opened otherwise (as Add text opens it). */
  openAt: ScreenPoint | null;
}

/**
 * The text field for editing a block's text in place: a textarea laid over
 * the block in the layer above the canvas (ADR 0003), in its font, size,
 * letter spacing, line height and alignment, so its caret and selection sit
 * on the drawn text. Its own text is transparent: the canvas keeps drawing the
 * block, with each keystroke, exactly as it will export. Enter inserts a line
 * break; Escape or clicking outside finishes editing.
 *
 * Opened by a double-click, it selects the word that was double-clicked, as
 * double-clicking text does anywhere; otherwise it selects all the text, so
 * typing replaces it (a new block's "TEXT").
 */
export function InPlaceTextEditor({ editor, block, box, transform, openAt }: InPlaceTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Only as the field opens. It's keyed by block, so editing another block opens a new one.
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.focus();
    if (!openAt) {
      field.select();
      return;
    }
    const offset = caretOffsetAt(field, openAt);
    // Where the browser can't tell what was double-clicked, the caret goes at the end, losing nothing.
    if (offset === null) field.setSelectionRange(field.value.length, field.value.length);
    else field.setSelectionRange(...wordAround(field.value, offset));
  }, []);

  // The field is sized to hold its text, so it never needs to scroll. Should a
  // keystroke outrun that for a moment, scrolling back keeps the caret on the drawn text.
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.scrollLeft = 0;
    ref.current.scrollTop = 0;
  });

  return (
    <textarea
      ref={ref}
      aria-label="Edit text in place"
      value={block.text}
      wrap="off"
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      onChange={(event) => editor.setText(event.target.value)}
      onBlur={() => editor.endTextEdit()}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        editor.endTextEdit();
      }}
      // Clicks inside the field place the caret; they mustn't reach the canvas, which would select or drag.
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      style={fieldStyle(block, box, transform)}
      className="absolute m-0 resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre text-transparent outline-none select-text selection:bg-blue-400/35 selection:text-transparent"
    />
  );
}

/**
 * The offset in the field's text at a screen point over it, or null where the
 * browser can't tell (`caretPositionFromPoint` is missing, as in older Safari).
 */
function caretOffsetAt(field: HTMLTextAreaElement, { x, y }: ScreenPoint): number | null {
  const position = document.caretPositionFromPoint?.(x, y);
  return position?.offsetNode === field ? position.offset : null;
}

/** Letters and digits, in any script: what double-clicking selects a run of. */
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/** The start and end of the word touching `offset`, or `offset` twice when there's none. */
function wordAround(text: string, offset: number): [number, number] {
  let start = offset;
  while (start > 0 && WORD_CHARACTER.test(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && WORD_CHARACTER.test(text[end])) end++;
  return [start, end];
}

/** Where the field's spare width goes: past the side the lines grow towards. */
const SPARE_WIDTH_BEFORE: Record<LineAlign, number> = { left: 0, center: 0.5, right: 1 };

/**
 * Lays the field over the block's box. It's an em wider and a line taller
 * than the box, so what's just been typed fits before the box is measured
 * again, and the spare width goes where lines grow, keeping the field's
 * alignment edge on the box's. CSS also adds letter spacing after each line's
 * last character, which measurement leaves out, so the field is that much
 * wider too.
 */
function fieldStyle(block: TextBlock, box: Box, { scale, offsetX, offsetY }: RenderTransform): CSSProperties {
  const spacing = letterSpacingPx(block);
  const lineHeight = block.lineHeight * block.fontSize;
  const spare = block.fontSize;
  const left = box.x - spare * SPARE_WIDTH_BEFORE[block.align];
  return {
    left: left * scale + offsetX,
    top: box.y * scale + offsetY,
    width: (box.width + spacing + spare) * scale,
    height: (box.height + lineHeight) * scale,
    fontFamily: fontById(block.fontId).family,
    fontWeight: block.fontWeight,
    fontSize: block.fontSize * scale,
    lineHeight: `${lineHeight * scale}px`,
    letterSpacing: spacing * scale,
    textAlign: block.align,
    textTransform: block.uppercase ? "uppercase" : "none",
    caretColor: block.color,
  };
}
