import { expect, type Locator, type Page } from "@playwright/test";
import { WALLPAPER_CANVAS } from "./canvas";

/** Device-pixel bounds on a canvas, such as of its light (text) pixels; edges included. */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function wallpaperCanvas(page: Page) {
  return page.locator(WALLPAPER_CANVAS);
}

/** The right sidebar, where the selected block's position is shown. */
export function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Inspector" });
}

/** Clicks the middle of the drawn text, which is inside the block's box when there's one block. */
export async function clickBlock(page: Page) {
  const canvas = wallpaperCanvas(page);
  const point = await screenPointAt(canvas, centreOf(await waitForTextBounds(canvas)));
  await page.mouse.click(point.x, point.y);
}

/** Waits for text to be drawn, as the canvas draws only once the fonts have loaded, and returns its bounds. */
export async function waitForTextBounds(canvas: Locator): Promise<Bounds> {
  await expect.poll(() => textBounds(canvas)).not.toBeNull();
  return (await textBounds(canvas))!;
}

/**
 * The bounds of the canvas's light pixels (the #F2F2F2 text on black), or
 * null when none are drawn. `rows` limits the search to a band of rows.
 */
export function textBounds(canvas: Locator, rows?: { top: number; bottom: number }): Promise<Bounds | null> {
  return canvas.evaluate((element: HTMLCanvasElement, rows) => {
    const { width, height } = element;
    if (width === 0 || height === 0) return null;
    const { data } = element.getContext("2d")!.getImageData(0, 0, width, height);
    const top = Math.max(0, Math.floor(rows?.top ?? 0));
    const bottom = Math.min(height - 1, Math.ceil(rows?.bottom ?? height - 1));
    let bounds: Bounds | null = null;
    for (let y = top; y <= bottom; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4] < 128) continue;
        bounds = bounds
          ? { left: Math.min(bounds.left, x), top: bounds.top, right: Math.max(bounds.right, x), bottom: y }
          : { left: x, top: y, right: x, bottom: y };
      }
    }
    return bounds;
  }, rows);
}

/**
 * The wallpaper's left and right edges on the canvas, in device px: the first
 * and last opaque pixels of the middle row (the surround is left transparent).
 */
export function wallpaperEdges(canvas: Locator): Promise<{ left: number; right: number }> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const { width, height } = element;
    const row = element.getContext("2d")!.getImageData(0, Math.floor(height / 2), width, 1).data;
    let left = 0;
    while (left < width && row[left * 4 + 3] < 255) left++;
    let right = width - 1;
    while (right > 0 && row[right * 4 + 3] < 255) right--;
    return { left, right: right + 1 };
  });
}

/** The middle of some bounds, in the same px. */
export function centreOf({ left, top, right, bottom }: Bounds) {
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** Canvas pixels per CSS pixel: the device pixel ratio, as the canvas was sized. */
export function canvasPixelsPerCssPixel(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => element.width / element.getBoundingClientRect().width);
}

/** Device-pixel bounds on the canvas, as page CSS px (from the page's top-left, outer edges). */
export async function pageBounds(canvas: Locator, { left, top, right, bottom }: Bounds): Promise<Bounds> {
  const box = (await canvas.boundingBox())!;
  const ratio = await canvasPixelsPerCssPixel(canvas);
  return {
    left: box.x + left / ratio,
    top: box.y + top / ratio,
    right: box.x + (right + 1) / ratio,
    bottom: box.y + (bottom + 1) / ratio,
  };
}

/** The whole-pixel screen point (CSS px) over a canvas pixel. */
export async function screenPointAt(canvas: Locator, canvasPoint: { x: number; y: number }) {
  const box = (await canvas.boundingBox())!;
  const ratio = await canvasPixelsPerCssPixel(canvas);
  return { x: Math.round(box.x + canvasPoint.x / ratio), y: Math.round(box.y + canvasPoint.y / ratio) };
}
