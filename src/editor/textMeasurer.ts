import type { TextContent, Typography } from "./model";

export interface TextMeasurement {
  /** Each displayed line's width, excluding letter spacing after its last character. */
  lineWidths: number[];
  /** The box hugs the text: as wide as the widest line... */
  width: number;
  /** ...and line count × line height × font size tall. */
  height: number;
}

/** Measures a block's text. Passed into the Editor so it never touches the DOM. */
export interface TextMeasurer {
  measure(content: TextContent): TextMeasurement;
}

/**
 * The lines exactly as they are displayed: split only at typed line breaks and
 * uppercased when the block asks for it. Measurers and the renderer share this.
 */
export function blockLines({ text, uppercase }: Pick<TextContent, "text" | "uppercase">): string[] {
  return (uppercase ? text.toUpperCase() : text).split("\n");
}

/** Letter spacing in px: it's stored as a percentage of the font size. */
export function letterSpacingPx({ letterSpacing, fontSize }: Pick<Typography, "letterSpacing" | "fontSize">): number {
  return (letterSpacing / 100) * fontSize;
}
