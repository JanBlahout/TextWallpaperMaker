import { GOOGLE_FONT_FAMILIES } from "./googleFonts";

/**
 * Every font a text block can use. Adding a font is one entry here (plus its
 * loading: an @font-face rule in globals.css, or Next.js font loading in
 * googleFonts.ts).
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
  /** The weights the font actually has, lightest first. */
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
  {
    id: "inter",
    label: "Inter",
    family: `${GOOGLE_FONT_FAMILIES.inter}, sans-serif`,
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    source: "hosted",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    family: `${GOOGLE_FONT_FAMILIES.ibmPlexMono}, monospace`,
    weights: [100, 200, 300, 400, 500, 600, 700],
    source: "hosted",
  },
  {
    id: "space-mono",
    label: "Space Mono",
    family: `${GOOGLE_FONT_FAMILIES.spaceMono}, monospace`,
    weights: [400, 700],
    source: "hosted",
  },
  {
    id: "courier-prime",
    label: "Courier Prime",
    family: `${GOOGLE_FONT_FAMILIES.courierPrime}, monospace`,
    weights: [400, 700],
    source: "hosted",
  },
  {
    // Helvetica on macOS and iOS, Arial on Windows; both have a regular and a bold.
    id: "helvetica-arial",
    label: "Helvetica / Arial",
    family: "Helvetica, Arial, sans-serif",
    weights: [400, 700],
    source: "system",
  },
  {
    // SF Mono or Menlo on Apple systems, Consolas on Windows, Liberation Mono on Linux.
    id: "system-monospace",
    label: "System monospace",
    family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    weights: [400, 700],
    source: "system",
  },
];

/** Looks up a font that may not exist, such as one named in saved data or a command. */
export function findFont(id: string): FontEntry | undefined {
  return FONTS.find((entry) => entry.id === id);
}

/**
 * Looks up a font. An unknown id is a bug: loading saved data is what turns
 * unrecognised data into the starting wallpaper, so it never reaches here.
 */
export function fontById(id: string): FontEntry {
  const font = findFont(id);
  if (!font) throw new Error(`Unknown font id "${id}"`);
  return font;
}
