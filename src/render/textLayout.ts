import { blockLines, letterSpacingPx, type TextContent, type TextMeasurement, type Typography } from "@/editor";
import { fontById } from "@/fonts/registry";

/**
 * Text styling and line layout shared by the renderer and the canvas text
 * measurer, so measured boxes and drawn pixels can't disagree (ADR 0003).
 */

/** The canvas `font` shorthand for a block's typography. */
export function canvasFont({ fontId, fontWeight, fontSize }: Pick<Typography, "fontId" | "fontWeight" | "fontSize">) {
  return `${fontWeight} ${fontSize}px ${fontById(fontId).family}`;
}

/**
 * Sets font, letter spacing and alignment on a context. Must run again after
 * any canvas resize, because resizing resets the context.
 */
export function applyTextStyle(ctx: CanvasRenderingContext2D, typography: Typography) {
  ctx.font = canvasFont(typography);
  ctx.letterSpacing = `${letterSpacingPx(typography)}px`;
  ctx.textAlign = "left";
  // Each line is centred vertically in its line box (line height × font size).
  ctx.textBaseline = "middle";
}

/** A block's measurement, plus what drawing its lines needs. */
export interface LineLayout extends TextMeasurement {
  lines: string[];
  lineHeightPx: number;
}

/** Lays out a block's lines with a context that `applyTextStyle` has styled. */
export function layOutLines(ctx: CanvasRenderingContext2D, content: TextContent): LineLayout {
  const lines = blockLines(content);
  // Canvas adds letter spacing after every character, including a line's last.
  const trailingSpacing = letterSpacingPx(content);
  const lineWidths = lines.map((line) => (line === "" ? 0 : ctx.measureText(line).width - trailingSpacing));
  const lineHeightPx = content.lineHeight * content.fontSize;
  return {
    lines,
    lineWidths,
    width: Math.max(0, ...lineWidths),
    height: lines.length * lineHeightPx,
    lineHeightPx,
  };
}
