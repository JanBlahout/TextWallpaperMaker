import type { Metadata } from "next";
import Link from "next/link";
import {
  altText,
  downloadFileName,
  GALLERY_PATH,
  PREVIEW_SIZE,
  previewPath,
  QUOTE_WALLPAPERS,
  WALLPAPER_SIZE,
  wallpaperPath,
} from "@/gallery/quoteWallpapers";
import { JsonLd } from "../JsonLd";
import { absoluteUrl, SITE_NAME } from "../site";

const TITLE = "Jocko Willink Quote Wallpapers";
const DESCRIPTION =
  "16 free minimalist wallpapers with Jocko Willink quotes like “Discipline equals freedom” and “Get after it”. Download the PNGs or make your own.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Jocko Willink wallpaper",
    "Jocko Willink quotes",
    "discipline equals freedom wallpaper",
    "motivational quotes wallpaper",
    "minimalist quote wallpaper",
    "MacBook wallpaper",
  ],
  alternates: { canonical: GALLERY_PATH },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: GALLERY_PATH,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const OCR_A = { fontFamily: '"OCR A", monospace' };
const SIZE_LABEL = `${WALLPAPER_SIZE.width} × ${WALLPAPER_SIZE.height}`;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ImageGallery",
      url: absoluteUrl(GALLERY_PATH),
      name: TITLE,
      description: DESCRIPTION,
      isPartOf: { "@id": absoluteUrl("/#website") },
      image: QUOTE_WALLPAPERS.map((wallpaper) => ({
        "@type": "ImageObject",
        contentUrl: absoluteUrl(wallpaperPath(wallpaper)),
        thumbnailUrl: absoluteUrl(previewPath(wallpaper)),
        name: `${wallpaper.quote} wallpaper`,
        caption: altText(wallpaper),
        width: WALLPAPER_SIZE.width,
        height: WALLPAPER_SIZE.height,
        encodingFormat: "image/png",
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: TITLE, item: absoluteUrl(GALLERY_PATH) },
      ],
    },
  ],
};

export default function QuoteWallpapersPage() {
  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-300">
      <JsonLd data={structuredData} />
      <header className="border-b border-neutral-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="text-xs font-semibold tracking-wide text-neutral-100 uppercase">
            {SITE_NAME}
          </Link>
          <Link
            href="/"
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-100 hover:border-neutral-500"
          >
            Make your own
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 style={OCR_A} className="text-3xl leading-tight text-neutral-100 uppercase sm:text-5xl">
          Jocko Willink quote wallpapers
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-400">
          Sixteen minimalist desktop wallpapers with motivational quotes from and inspired by Jocko Willink, the author
          of <cite>Discipline Equals Freedom</cite>, from “Discipline equals freedom.” to “Good.” Each one is set in OCR
          A, off-white on black, at {SIZE_LABEL} for a 14-inch MacBook Pro. Download any of them free, or{" "}
          <Link href="/" className="text-neutral-100 underline underline-offset-4 hover:text-white">
            make your own text wallpaper
          </Link>{" "}
          in your browser.
        </p>

        <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {QUOTE_WALLPAPERS.map((wallpaper, i) => (
            <li key={wallpaper.slug}>
              <figure>
                <a href={wallpaperPath(wallpaper)}>
                  {/* Plain img: the static export has no image optimiser. */}
                  <img
                    src={previewPath(wallpaper)}
                    alt={altText(wallpaper)}
                    width={PREVIEW_SIZE.width}
                    height={PREVIEW_SIZE.height}
                    loading={i < 3 ? "eager" : "lazy"}
                    decoding="async"
                    className="h-auto w-full rounded border border-neutral-800"
                  />
                </a>
                <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-neutral-200">{wallpaper.quote}</span>
                  <a
                    href={wallpaperPath(wallpaper)}
                    download={downloadFileName(wallpaper)}
                    className="shrink-0 text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-200"
                  >
                    Download PNG
                  </a>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>

        <section className="mt-20 max-w-2xl" aria-labelledby="make-your-own">
          <h2 id="make-your-own" style={OCR_A} className="text-xl text-neutral-100 uppercase sm:text-2xl">
            Make your own text wallpaper
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5 leading-relaxed text-neutral-400">
            <li>
              <strong className="font-medium text-neutral-200">Pick your screen.</strong> Desktop and phone presets
              for 1080p, 1440p, 4K, ultrawide, MacBook, iPhone and Android screens, or any custom size.
            </li>
            <li>
              <strong className="font-medium text-neutral-200">Type your quote and style it.</strong> OCR A or
              another font, size, letter spacing, line height and colour, lined up with the grid, safe margins and
              smart guides.
            </li>
            <li>
              <strong className="font-medium text-neutral-200">Export a PNG</strong> at exactly your screen’s
              resolution. Nothing is uploaded: the editor runs in your browser and saves your work there.
            </li>
          </ol>
          <Link
            href="/"
            className="mt-8 inline-block rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white"
          >
            Open Text Wallpaper Maker
          </Link>
          <p className="mt-3 text-xs text-neutral-500">The editor needs a desktop or laptop screen.</p>
        </section>

        <section className="mt-16 max-w-2xl" aria-labelledby="rotate">
          <h2 id="rotate" style={OCR_A} className="text-xl text-neutral-100 uppercase sm:text-2xl">
            Rotate them on your Mac
          </h2>
          <p className="mt-6 leading-relaxed text-neutral-400">
            Download the ones you like into one folder, then add that folder in System Settings › Wallpaper and
            choose how often it changes. Every wallpaper uses the same layout, so the rotation feels like one set.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-800">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-neutral-500 sm:px-6">
          Quotes from and inspired by Jocko Willink. {SITE_NAME} isn’t affiliated with or endorsed by Jocko Willink.
          OCR A by Matthew Skala.
        </p>
      </footer>
    </div>
  );
}
