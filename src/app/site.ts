/**
 * The site's identity for search engines and link previews. Server-only: the
 * production address comes from build-time environment variables.
 */

/**
 * The public address that canonical links, the sitemap and social previews
 * point to. NEXT_PUBLIC_SITE_URL wins (set it once there's a custom domain);
 * on Vercel, the project's production domain is used; locally, localhost.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

export const SITE_NAME = "Text Wallpaper Maker";

export const HOME_TITLE = "Text Wallpaper Maker – Create Custom Quote Wallpapers";

export const HOME_DESCRIPTION =
  "Free text wallpaper maker for minimalist motivational quote wallpapers. Pick a desktop or phone resolution, type your quote, align it and export a crisp PNG.";

/** An absolute URL on this site, for structured data and the sitemap. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}
