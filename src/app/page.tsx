import type { Metadata } from "next";
import { EditorApp } from "@/ui/EditorApp";
import { JsonLd } from "./JsonLd";
import { absoluteUrl, HOME_DESCRIPTION, SITE_NAME } from "./site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": absoluteUrl("/#website"), url: absoluteUrl("/"), name: SITE_NAME },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: HOME_DESCRIPTION,
      applicationCategory: "DesignApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript. Designed for desktop and laptop screens.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Desktop and phone resolution presets, or any custom size",
        "Multiple text blocks with OCR A and other fonts",
        "Grid, safe margins and smart guides with snapping",
        "PNG export at the exact resolution",
        "Autosaves in the browser; no sign-up",
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <JsonLd data={structuredData} />
      <EditorApp />
    </>
  );
}
