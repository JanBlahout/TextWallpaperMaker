import { expect, type Page } from "@playwright/test";

export type Rgb = [number, number, number];

const WALLPAPER_CANVAS = 'canvas[aria-label="Wallpaper canvas"]';

/**
 * Waits until the canvas's centre pixel, which shows the wallpaper's centre
 * (the starting wallpaper has no text there), has the given colour.
 */
export async function expectCanvasBackground(page: Page, rgb: Rgb) {
  await expect
    .poll(() =>
      page.locator(WALLPAPER_CANVAS).evaluate((canvas: HTMLCanvasElement) => {
        const x = Math.floor(canvas.width / 2);
        const y = Math.floor(canvas.height / 2);
        return [...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data.slice(0, 3)];
      }),
    )
    .toEqual(rgb);
}
