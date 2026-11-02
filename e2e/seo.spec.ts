import { expect, test, type Page } from "@playwright/test";
import { pngSize } from "./support/png";

/** The page's JSON-LD structured data: the "@type" of every node in its graph, and the graph itself. */
async function structuredData(page: Page) {
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const graph: { "@type": string; image?: unknown[] }[] = JSON.parse(json ?? "{}")["@graph"];
  return { types: graph.map((node) => node["@type"]), graph };
}

/** Fetches a URL from the tags by its path, since absolute URLs point at the production address. */
async function fetchPng(page: Page, url: string) {
  const { pathname } = new URL(url, page.url());
  const response = await page.request.get(pathname);
  expect(response.ok()).toBe(true);
  return pngSize(await response.body());
}

test("the editor page has a title, description, canonical URL, social preview, structured data and one h1", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Text Wallpaper Maker/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /text wallpaper maker/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\//);
  await expect(page.locator("h1")).toHaveCount(1);

  const preview = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(await fetchPng(page, preview!)).toEqual({ width: 1200, height: 630 });

  const icon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(await fetchPng(page, icon!)).toEqual({ width: 512, height: 512 });

  expect((await structuredData(page)).types).toEqual(["WebSite", "WebApplication"]);
});

test("the editor links to the quote wallpaper gallery, which offers every wallpaper as a full-size PNG", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Quote wallpaper gallery/ }).click();

  await expect(page).toHaveURL(/\/jocko-willink-quotes-wallpapers$/);
  await expect(page).toHaveTitle(/Jocko Willink Quote Wallpapers/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/jocko-willink-quotes-wallpapers$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Jocko Willink quote wallpapers/i);

  // Every preview describes its quote for people who can't see it, and for image search.
  const previews = page.getByRole("img");
  await expect(previews).toHaveCount(16);
  for (const alt of await previews.evaluateAll((imgs) => imgs.map((img) => img.getAttribute("alt") ?? ""))) {
    expect(alt).toMatch(/^Minimalist black wallpaper with the quote “.+”/);
  }

  const downloads = page.getByRole("link", { name: "Download PNG" });
  await expect(downloads).toHaveCount(16);
  for (const href of await downloads.evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))) {
    expect(await fetchPng(page, href)).toEqual({ width: 3024, height: 1964 });
  }

  const preview = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(preview).toContain("/jocko-willink-quotes-wallpapers/opengraph-image.png");
  expect(await fetchPng(page, preview!)).toEqual({ width: 1200, height: 630 });

  const { types, graph } = await structuredData(page);
  expect(types).toEqual(["ImageGallery", "BreadcrumbList"]);
  expect(graph[0].image).toHaveLength(16);
});

test("the gallery link is in view with its thumbnails at the top of the sidebar, even in the smallest desktop window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto("/");

  const link = page.getByRole("link", { name: /Quote wallpaper gallery/ });
  await expect(link).toBeInViewport({ ratio: 1 });
  await expect(link).toContainText("16 free wallpapers");
  const thumbnails = link.locator("img");
  await expect(thumbnails).toHaveCount(3);
  for (const thumbnail of await thumbnails.all()) {
    await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(160);
  }
});

test("robots.txt points to the sitemap, which lists both pages and the gallery's wallpapers", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/^Sitemap: https?:\/\/.+\/sitemap\.xml$/m);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toMatch(/<loc>https?:\/\/[^<]+\/jocko-willink-quotes-wallpapers<\/loc>/);
  expect(sitemap.match(/<image:loc>/g)).toHaveLength(16);
});
