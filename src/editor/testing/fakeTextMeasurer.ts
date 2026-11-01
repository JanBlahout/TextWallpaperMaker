import { blockLines, letterSpacingPx, type TextContent, type TextMeasurer } from "../index";

/**
 * A deterministic stand-in for the canvas measurer, so expected boxes are exact:
 * every character is 0.6 × font size wide, letter spacing sits only between
 * characters, and each line is line height × font size tall.
 */
export const fakeTextMeasurer: TextMeasurer = {
  measure(content: TextContent) {
    const spacingPx = letterSpacingPx(content);
    const lineWidths = blockLines(content).map((line) => {
      const chars = [...line].length;
      return chars === 0 ? 0 : chars * 0.6 * content.fontSize + (chars - 1) * spacingPx;
    });
    return {
      lineWidths,
      width: Math.max(0, ...lineWidths),
      height: lineWidths.length * content.lineHeight * content.fontSize,
    };
  },
};
