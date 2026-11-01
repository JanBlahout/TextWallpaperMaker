/**
 * Stands in for `next/font/google` under Vitest (see vitest.config.ts), where
 * Next.js's compiler, which makes those functions work, doesn't run. Each
 * font's family list is shaped like the one Next.js generates: a generated
 * name, then a metric-adjusted fallback. The names are hashed, as Next.js's
 * webpack build makes them, so a test can tell the generated name is used.
 */
function googleFont(family: string) {
  const name = family.replaceAll(" ", "_");
  return (_options?: unknown) => ({
    className: "",
    style: { fontFamily: `'__${name}_5f2a1c', '__${name}_Fallback_5f2a1c'` },
  });
}

export const Inter = googleFont("Inter");
export const IBM_Plex_Mono = googleFont("IBM Plex Mono");
export const Space_Mono = googleFont("Space Mono");
export const Courier_Prime = googleFont("Courier Prime");
