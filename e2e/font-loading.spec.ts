import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const WALLPAPER_CANVAS = 'canvas[aria-label="Wallpaper canvas"]';

test("OCR A has loaded before the first draw, so the text is never drawn in the fallback font", async ({ page }) => {
  // Hold the font back: a renderer that didn't wait for it would draw its
  // first frame in the fallback font and only later swap to OCR A.
  await page.route("**/fonts/ocr-a/ocr-a.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/");

  await test.step("the first frame with text on the canvas is identical to a redraw made after OCR A has surely loaded", async () => {
    // waitForFunction resolves only once the function returns a truthy value.
    const firstDraw = (await (
      await page.waitForFunction(firstFrameWithText, WALLPAPER_CANVAS, { polling: "raf", timeout: 15_000 })
    ).jsonValue())!;

    await page.waitForFunction(() => document.fonts.check('96px "OCR A"'));

    // Force a fresh draw at the same size: resize the window away and back,
    // waiting each time for the canvas to be redrawn at the new size.
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width + 160, height: viewport.height + 90 });
    await waitForCanvasSize(page, (width) => width !== firstDraw.width);
    await page.setViewportSize(viewport);
    await waitForCanvasSize(page, (width, height) => width === firstDraw.width && height === firstDraw.height);
    const redrawUrl = await page.locator(WALLPAPER_CANVAS).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());

    expect(redrawUrl === firstDraw.url, "the first frame differs from a redraw made in OCR A").toBe(true);
  });

  await test.step("the rendered text matches OCR A and differs from a render in the fallback font", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export Wallpaper/ }).click(),
    ]);
    const png = (await readFile(await download.path())).toString("base64");

    const differingFromOcrA = await pixelsDifferingFromReference(page, png, '"OCR A", monospace');
    const differingFromFallback = await pixelsDifferingFromReference(page, png, "monospace");

    // The OCR A match is the control: it proves the reference is drawn in the
    // same place, so the fallback mismatch can only come from the glyphs.
    expect(differingFromOcrA).toBeLessThan(100);
    expect(differingFromFallback).toBeGreaterThan(5_000);
  });
});

/** Runs in the page: the canvas as a data URL once any pixel is light (text), otherwise null. */
function firstFrameWithText(selector: string): { url: string; width: number; height: number } | null {
  const canvas = document.querySelector<HTMLCanvasElement>(selector);
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 128) return { url: canvas.toDataURL(), width: canvas.width, height: canvas.height };
  }
  return null;
}

/** Waits until the wallpaper canvas's pixel size satisfies `predicate` (it's resized only when redrawn). */
async function waitForCanvasSize(page: Page, predicate: (width: number, height: number) => boolean) {
  await expect
    .poll(async () => {
      const [width, height] = await page
        .locator(WALLPAPER_CANVAS)
        .evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height]);
      return predicate(width, height);
    })
    .toBe(true);
}

/**
 * Draws the starting wallpaper as the spec describes it (black 1920 × 1080,
 * three lines of 96 px #F2F2F2 text, line height 1.1, its box on the bottom-left
 * safe-area edges 54 px in) straight onto a canvas in `fontFamily`, and counts
 * the pixels where the exported PNG differs from it.
 */
function pixelsDifferingFromReference(page: Page, pngBase64: string, fontFamily: string) {
  return page.evaluate(
    async ({ pngBase64, fontFamily }) => {
      const context2d = (width: number, height: number) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas.getContext("2d")!;
      };

      const bytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const exported = context2d(bitmap.width, bitmap.height);
      exported.drawImage(bitmap, 0, 0);

      await document.fonts.load(`96px ${fontFamily}`);
      const reference = context2d(1920, 1080);
      reference.fillStyle = "#000000";
      reference.fillRect(0, 0, 1920, 1080);
      reference.font = `400 96px ${fontFamily}`;
      reference.fillStyle = "#F2F2F2";
      reference.textBaseline = "middle";
      const lines = ["DISCIPLINE", "EQUALS", "FREEDOM."];
      const lineHeight = 96 * 1.1;
      const top = 1080 - 54 - lines.length * lineHeight;
      lines.forEach((line, i) => reference.fillText(line, 54, top + i * lineHeight + lineHeight / 2));

      const exportedPixels = exported.getImageData(0, 0, 1920, 1080).data;
      const referencePixels = reference.getImageData(0, 0, 1920, 1080).data;
      let differing = 0;
      for (let i = 0; i < exportedPixels.length; i += 4) {
        let delta = 0;
        for (let channel = 0; channel < 3; channel++) {
          delta = Math.max(delta, Math.abs(exportedPixels[i + channel] - referencePixels[i + channel]));
        }
        if (delta > 32) differing++;
      }
      return differing;
    },
    { pngBase64, fontFamily },
  );
}
