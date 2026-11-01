/**
 * The quote wallpaper gallery: ready-made wallpapers made with the editor, all
 * in the same layout (OCR A, #F2F2F2 on black, bottom-left on the 8% safe
 * margin) at the MacBook Pro 14″ preset. The PNGs live in public/wallpapers/,
 * with 1200 px previews in public/wallpapers/preview/.
 */

export const GALLERY_PATH = "/jocko-willink-quotes-wallpapers";

/** Every gallery wallpaper's exact size: the MacBook Pro 14″ preset. */
export const WALLPAPER_SIZE = { width: 3024, height: 1964 } as const;

/** The previews' size: the wallpaper scaled to 1200 px wide. */
export const PREVIEW_SIZE = { width: 1200, height: 779 } as const;

export interface QuoteWallpaper {
  /** Names the files: public/wallpapers/<slug>-wallpaper.png and its preview. */
  slug: string;
  /** The quote as written; the wallpaper shows it uppercase. */
  quote: string;
}

export const QUOTE_WALLPAPERS: readonly QuoteWallpaper[] = [
  { slug: "discipline-equals-freedom", quote: "Discipline equals freedom." },
  { slug: "dont-count-on-motivation", quote: "Don’t count on motivation. Count on discipline." },
  { slug: "get-after-it", quote: "Get after it." },
  { slug: "hesitation-is-the-enemy", quote: "Hesitation is the enemy." },
  { slug: "the-shortcut-is-a-lie", quote: "The shortcut is a lie." },
  { slug: "one-small-decision-at-a-time", quote: "One. Small. Decision. At. A. Time." },
  { slug: "weakness-doesnt-get-a-vote", quote: "Weakness doesn’t get a vote." },
  { slug: "prioritize-and-execute", quote: "Prioritize and execute." },
  { slug: "relax-look-around-make-a-call", quote: "Relax. Look around. Make a call." },
  { slug: "default-aggressive", quote: "Default: Aggressive." },
  { slug: "dont-negotiate-with-weakness", quote: "Don’t negotiate with weakness." },
  { slug: "you-know-what-youre-supposed-to-do", quote: "You know what you’re supposed to do. So go do it." },
  { slug: "you-are-the-general-you-are-the-soldier", quote: "You are the general, you are the soldier." },
  { slug: "be-humble-or-get-humbled", quote: "Be humble or get humbled." },
  { slug: "get-up-dust-off-reload", quote: "Get up. Dust off. Reload. Recalibrate. Re-engage." },
  { slug: "good", quote: "Good." },
];

export function wallpaperPath({ slug }: QuoteWallpaper): string {
  return `/wallpapers/${slug}-wallpaper.png`;
}

export function previewPath({ slug }: QuoteWallpaper): string {
  return `/wallpapers/preview/${slug}-wallpaper.png`;
}

/** The file name a download is saved under. */
export function downloadFileName({ slug }: QuoteWallpaper): string {
  return `${slug}-wallpaper-${WALLPAPER_SIZE.width}x${WALLPAPER_SIZE.height}.png`;
}

/** Describes the image for people who can't see it, and for image search. */
export function altText({ quote }: QuoteWallpaper): string {
  return `Minimalist black wallpaper with the quote “${quote}” in off-white OCR A type at the bottom left`;
}
