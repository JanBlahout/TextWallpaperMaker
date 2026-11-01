import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Guide lines on the starting 1920 × 1080 wallpaper at the default 5% safe
 * margin and 12 columns, worked out from the spec: the safe area is 54 px in
 * from every edge, columns are 151 px and rows 162 px, and the centre lines run
 * through (960, 540).
 */
const GUIDE_XS = [...Array.from({ length: 13 }, (_, i) => 54 + 151 * i), 960];
const GUIDE_YS = [...Array.from({ length: 7 }, (_, i) => 54 + 162 * i), 540];

/**
 * Generously covers the starting text block (bottom-left, its box from x 54 and
 * up to y 1026), whose pixels aren't the background even without guides.
 */
const TEXT_REGION = { left: 0, top: 680, right: 760, bottom: 1080 };

test("guides are drawn over the canvas and never appear in the export", async ({ page }) => {
  await page.goto("/");
  const guides = page.getByTestId("guides");

  let withBoth = 0;
  await test.step("the grid, safe-area edges and centre lines are drawn when the editor opens", async () => {
    await expect.poll(() => drawnPixels(guides)).toBeGreaterThan(0);
    withBoth = await drawnPixels(guides);
  });

  const exportedWithGuides = await exportPng(page);

  await test.step("every exported pixel where a guide line runs has the black background colour", async () => {
    const { checked, offending } = await pixelsOnGuideLines(page, exportedWithGuides);
    expect(checked).toBeGreaterThan(30_000);
    expect(offending, "pixels on guide lines that aren't the background colour").toEqual([]);
  });

  await test.step("hiding the grid keeps the safe-area guides; hiding those too clears the layer", async () => {
    await page.getByRole("checkbox", { name: "Show grid" }).uncheck();
    await expect.poll(() => drawnPixels(guides)).toBeLessThan(withBoth);
    expect(await drawnPixels(guides)).toBeGreaterThan(0);

    await page.getByRole("checkbox", { name: "Show safe area and centre lines" }).uncheck();
    await expect.poll(() => drawnPixels(guides)).toBe(0);
  });

  await test.step("the export is byte-for-byte identical with the guides hidden", async () => {
    const exportedWithoutGuides = await exportPng(page);
    expect(exportedWithoutGuides.equals(exportedWithGuides)).toBe(true);
  });
});

async function exportPng(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export Wallpaper/ }).click(),
  ]);
  return readFile(await download.path());
}

/** How many pixels of a canvas have anything drawn on them. */
function drawnPixels(canvas: Locator): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    if (element.width === 0 || element.height === 0) return 0;
    const { data } = element.getContext("2d")!.getImageData(0, 0, element.width, element.height);
    let drawn = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
    return drawn;
  });
}

/**
 * Checks the exported PNG along every guide line (the pixel column or row on
 * each side of the line's position), outside the text, for the background
 * colour #000000. Returns how many pixels it checked and the first few that
 * weren't the background.
 */
function pixelsOnGuideLines(page: Page, png: Buffer) {
  return page.evaluate(
    async ({ pngBase64, xs, ys, text }) => {
      const bytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

      let checked = 0;
      const offending: string[] = [];
      const check = (x: number, y: number) => {
        if (x >= text.left && x < text.right && y >= text.top && y < text.bottom) return;
        checked++;
        const i = (y * width + x) * 4;
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if ((r !== 0 || g !== 0 || b !== 0 || a !== 255) && offending.length < 10) {
          offending.push(`(${x}, ${y}) is rgba(${r}, ${g}, ${b}, ${a})`);
        }
      };
      for (const x of xs) for (const column of [x - 1, x]) for (let y = 0; y < height; y++) check(column, y);
      for (const y of ys) for (const row of [y - 1, y]) for (let x = 0; x < width; x++) check(x, row);
      return { checked, offending };
    },
    { pngBase64: png.toString("base64"), xs: GUIDE_XS, ys: GUIDE_YS, text: TEXT_REGION },
  );
}
