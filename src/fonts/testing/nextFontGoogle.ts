/**
 * Stands in for `next/font/google` under Vitest (see vitest.config.ts), where
 * Next.js's compiler, which makes those functions work, doesn't run. Each
 * font's family list is what Turbopack generates: the font's own name, then
 * its metric-adjusted fallback.
 */
function googleFont(family: string) {
  return (_options?: unknown) => ({ className: "", style: { fontFamily: `'${family}', '${family} Fallback'` } });
}

export const Inter = googleFont("Inter");
export const IBM_Plex_Mono = googleFont("IBM Plex Mono");
export const Space_Mono = googleFont("Space Mono");
export const Courier_Prime = googleFont("Courier Prime");
