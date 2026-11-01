import { blockLines, type TextContent, type Typography } from "@/editor";
import { fontById } from "@/fonts/registry";
import { canvasFont } from "./textLayout";

/** A font as a text block uses it: with its text, when there is any yet. */
type FontUse = Pick<Typography, "fontId" | "fontWeight"> & Partial<Pick<TextContent, "text" | "uppercase">>;

/**
 * Resolves once every hosted font face these text blocks need has loaded, so
 * nothing is drawn or measured in a fallback font. Rejects if a font didn't load.
 */
export async function loadFontsFor(uses: readonly FontUse[]) {
  await Promise.all(
    [...fontsNeeded(uses)].map(async ([font, { label, text }]) => {
      // An empty list means no matching @font-face exists, so nothing loaded.
      // The leading space, which every font's faces cover, rules out the other
      // reason: no face covering the text.
      const faces = await document.fonts.load(font, ` ${text}`);
      if (faces.length === 0) throw new Error(`The ${label} font did not load.`);
    }),
  );
}

/** Whether every hosted font face these text blocks need has already loaded. */
export function fontsLoadedFor(uses: readonly FontUse[]) {
  return [...fontsNeeded(uses)].every(([font, { text }]) => document.fonts.check(font, ` ${text}`));
}

/**
 * Each hosted font these blocks use, as a canvas font string, with every
 * character drawn in it. A Google font has a face per script (Latin, Latin
 * Extended, Cyrillic…), and the browser fetches only the faces covering the
 * characters asked for, so a font is loaded for its text, not just by name.
 */
function fontsNeeded(uses: readonly FontUse[]) {
  const fonts = new Map<string, { label: string; text: string }>();
  for (const use of uses) {
    const entry = fontById(use.fontId);
    if (entry.source !== "hosted") continue;
    const font = canvasFont({ ...use, fontSize: 16 });
    const displayed = use.text === undefined ? "" : blockLines({ text: use.text, uppercase: !!use.uppercase }).join("");
    const text = new Set([...(fonts.get(font)?.text ?? ""), ...displayed]);
    fonts.set(font, { label: entry.label, text: [...text].join("") });
  }
  return fonts;
}
