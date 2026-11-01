import { expect, type Locator, type Page } from "@playwright/test";
import { WALLPAPER_CANVAS } from "./canvas";

/** Device-pixel bounds of the light (text) pixels on a canvas. */
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
  const { left, top, right, bottom } = await waitForTextBounds(canvas);
  const box = (await canvas.boundingBox())!;
  const ratio = await canvas.evaluate((element: HTMLCanvasElement) => element.width / element.getBoundingClientRect().width);
  await page.mouse.click(Math.round(box.x + (left + right) / 2 / ratio), Math.round(box.y + (top + bottom) / 2 / ratio));
}

export async function waitForTextBounds(canvas: Locator): Promise<Bounds> {
  await expect.poll(() => textBounds(canvas)).not.toBeNull();
  return (await textBounds(canvas))!;
}

/** The bounds of the canvas's light pixels (the #F2F2F2 text on black), or null when none are drawn. */
export function textBounds(canvas: Locator): Promise<Bounds | null> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const { width, height } = element;
    if (width === 0 || height === 0) return null;
    const { data } = element.getContext("2d")!.getImageData(0, 0, width, height);
    let bounds: Bounds | null = null;
    for (let i = 0; i < width * height; i++) {
      if (data[i * 4] < 128) continue;
      const x = i % width;
      const y = Math.floor(i / width);
      bounds = bounds
        ? { left: Math.min(bounds.left, x), top: Math.min(bounds.top, y), right: Math.max(bounds.right, x), bottom: y }
        : { left: x, top: y, right: x, bottom: y };
    }
    return bounds;
  });
}
