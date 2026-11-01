import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL } from "./site";
import "./globals.css";

// Pages set their own canonical URL; the social preview images come from each
// route's opengraph-image.png, and the icons from icon.png and apple-icon.png.
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: HOME_TITLE, template: `%s | ${SITE_NAME}` },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "text wallpaper maker",
    "quote wallpaper maker",
    "custom text wallpaper",
    "motivational quotes wallpaper",
    "minimalist wallpaper",
    "desktop wallpaper",
    "phone wallpaper",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/ocr-a/ocr-a.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
