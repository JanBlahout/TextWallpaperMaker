import type { MetadataRoute } from "next";
import { GALLERY_PATH, QUOTE_WALLPAPERS, wallpaperPath } from "@/gallery/quoteWallpapers";
import { absoluteUrl } from "./site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    {
      url: absoluteUrl(GALLERY_PATH),
      changeFrequency: "monthly",
      priority: 0.8,
      // Listing the wallpapers helps them show up in image search.
      images: QUOTE_WALLPAPERS.map((wallpaper) => absoluteUrl(wallpaperPath(wallpaper))),
    },
  ];
}
