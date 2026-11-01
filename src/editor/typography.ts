import { FONTS, fontById } from "@/fonts/registry";
import { parseHexColor } from "./color";
import { LINE_ALIGNS, type TextBlock, type Typography } from "./model";

/**
 * The block with `changes` applied to its typography, as set in the inspector.
 * A value the block can't take leaves that property as it is: a font the
 * registry doesn't have, a weight the font doesn't have, a size or line height
 * that isn't a number above 0, letter spacing or opacity that isn't a number,
 * an unknown line alignment, or a colour that isn't hex (see `parseHexColor`).
 * Opacity is kept within 0–100. Switching to a font without the block's weight
 * picks the nearest weight it has; a weight changed at the same time then
 * applies to the new font.
 */
export function withTypography(block: TextBlock, changes: Partial<Typography>): TextBlock {
  const next = { ...block };
  const { fontId, fontWeight, fontSize, letterSpacing, lineHeight, align, color, opacity, uppercase } = changes;

  const font = FONTS.find(({ id }) => id === fontId);
  if (font) {
    next.fontId = font.id;
    next.fontWeight = nearestWeight(font.weights, next.fontWeight);
  }
  if (fontWeight !== undefined && fontById(next.fontId).weights.includes(fontWeight)) next.fontWeight = fontWeight;
  if (fontSize !== undefined && isAboveZero(fontSize)) next.fontSize = fontSize;
  if (letterSpacing !== undefined && Number.isFinite(letterSpacing)) next.letterSpacing = letterSpacing;
  if (lineHeight !== undefined && isAboveZero(lineHeight)) next.lineHeight = lineHeight;
  if (align !== undefined && LINE_ALIGNS.includes(align)) next.align = align;
  const hex = color === undefined ? null : parseHexColor(color);
  if (hex !== null) next.color = hex;
  if (opacity !== undefined && Number.isFinite(opacity)) next.opacity = Math.min(100, Math.max(0, opacity));
  if (uppercase !== undefined) next.uppercase = uppercase;
  return next;
}

/** The weight in `weights` closest to `weight`; a tie goes to the lighter one. */
function nearestWeight(weights: readonly number[], weight: number): number {
  return weights.reduce((nearest, candidate) =>
    Math.abs(candidate - weight) < Math.abs(nearest - weight) ? candidate : nearest,
  );
}

function isAboveZero(value: number) {
  return Number.isFinite(value) && value > 0;
}
