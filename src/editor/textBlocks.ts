import type { Box, TextBlock, Typography } from "./model";
import type { TextMeasurer } from "./textMeasurer";

/** What a new text block reads until it's typed over. */
const NEW_BLOCK_TEXT = "TEXT";

/** A new text block reading "TEXT" in the given style, its box centred in `area`. */
export function newTextBlock(id: string, style: Typography, area: Box, measurer: TextMeasurer): TextBlock {
  const content = { text: NEW_BLOCK_TEXT, ...typographyOf(style) };
  const { width, height } = measurer.measure(content);
  return {
    id,
    ...content,
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
  };
}

/** Whether text shows nothing: it's empty, or only spaces and line breaks. */
export function isBlank(text: string): boolean {
  return text.trim() === "";
}

/**
 * Just the typography of a block (or of a style), built field by field in the
 * order the Editor builds blocks, so equal wallpapers serialise identically.
 */
function typographyOf(style: Typography): Typography {
  return {
    fontId: style.fontId,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    align: style.align,
    color: style.color,
    opacity: style.opacity,
    uppercase: style.uppercase,
  };
}
