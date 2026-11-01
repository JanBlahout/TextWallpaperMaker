/**
 * Every font a text block can use. Adding a font is one entry here (plus its
 * loading: an @font-face rule in globals.css, or Next.js font loading).
 */

export interface FontEntry {
  /** Stored on text blocks; never change an existing id. */
  id: string;
  /** Shown in the UI. */
  label: string;
  /**
   * The CSS font-family list, used by both the canvas renderer and the UI. It
   * always ends with a generic family, so characters the font lacks (OCR A has
   * no en dash, em dash or ellipsis) fall back instead of being altered.
   */
  family: string;
  /** The weights the font actually has. */
  weights: readonly number[];
  /** "hosted": served by this app; "system": provided by the viewer's OS. */
  source: "hosted" | "system";
}

export const FONTS: readonly FontEntry[] = [
  {
    // Matthew Skala's OCR A v0.3.1, served from public/fonts/ocr-a (see NOTICE.txt there).
    id: "ocr-a",
    label: "OCR A",
    family: '"OCR A", monospace',
    weights: [400],
    source: "hosted",
  },
];

/**
 * Looks up a font. An unknown id is a bug: loading saved data is what turns
 * unrecognised data into the starting wallpaper, so it never reaches here.
 */
export function fontById(id: string): FontEntry {
  const font = FONTS.find((entry) => entry.id === id);
  if (!font) throw new Error(`Unknown font id "${id}"`);
  return font;
}
