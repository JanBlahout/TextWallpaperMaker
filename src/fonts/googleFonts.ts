import { Courier_Prime, IBM_Plex_Mono, Inter, Space_Mono } from "next/font/google";

/*
 * The Google fonts the app hosts: Next.js downloads them at build time and
 * serves them itself. Next.js needs each call at module scope, assigned to a
 * const, with literal options, so the weights are listed here as well as in
 * the registry.
 *
 * None is preloaded: a font loads when a text block first uses it, and nothing
 * is drawn in it until it has (see `loadFontsFor`).
 */

/** A variable font: one file per script covers every weight from 100 to 900. */
const inter = Inter({ preload: false });
const ibmPlexMono = IBM_Plex_Mono({ weight: ["100", "200", "300", "400", "500", "600", "700"], preload: false });
const spaceMono = Space_Mono({ weight: ["400", "700"], preload: false });
const courierPrime = Courier_Prime({ weight: ["400", "700"], preload: false });

/**
 * The family name Next.js generated for each font, which the registry must
 * use. It's the first in the font's family list. The second is a
 * metric-adjusted fallback, Arial resized to match, which is left out: it
 * would draw characters a font lacks in a resized Arial, and where Arial isn't
 * installed it fails to load, which fails loading the whole family list.
 * (Turbopack adds it even with `adjustFontFallback: false`.)
 */
export const GOOGLE_FONT_FAMILIES = {
  inter: generatedFamily(inter),
  ibmPlexMono: generatedFamily(ibmPlexMono),
  spaceMono: generatedFamily(spaceMono),
  courierPrime: generatedFamily(courierPrime),
};

function generatedFamily(font: { style: { fontFamily: string } }) {
  return font.style.fontFamily.split(",")[0].trim();
}
