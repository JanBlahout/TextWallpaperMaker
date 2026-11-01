import type { Typography } from "@/editor";
import { fontById } from "@/fonts/registry";
import { canvasFont } from "./textLayout";

/**
 * Resolves once every hosted font face these typographies use has loaded, so
 * nothing is drawn or measured in a fallback font. Rejects if one didn't load.
 */
export async function loadFontsFor(typographies: readonly Pick<Typography, "fontId" | "fontWeight">[]) {
  const fonts = new Map<string, { label: string; font: string }>();
  for (const { fontId, fontWeight } of typographies) {
    const entry = fontById(fontId);
    if (entry.source !== "hosted") continue;
    const font = canvasFont({ fontId, fontWeight, fontSize: 16 });
    fonts.set(font, { label: entry.label, font });
  }

  await Promise.all(
    [...fonts.values()].map(async ({ label, font }) => {
      // An empty list means no matching @font-face exists, so nothing loaded.
      const faces = await document.fonts.load(font);
      if (faces.length === 0) throw new Error(`The ${label} font did not load.`);
    }),
  );
}
