import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pngSize } from "./support/png";

const WALLPAPER_CANVAS = 'canvas[aria-label="Wallpaper canvas"]';

/** Device-pixel bounds of the light (text) pixels on a canvas. */
interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

test.describe("on a high-DPI screen", () => {
  test.use({ deviceScaleFactor: 2 });

  test("exporting a 4K wallpaper after zooming far in still produces exactly 3840 × 2160, and the canvas stays the size of the visible area", async ({
    page,
  }) => {
    await page.goto("/");
    await choosePreset(page, "Desktop", "3840 × 2160");
    const exportButton = page.getByRole("button", { name: /Export Wallpaper/ });
    await expect(exportButton).toContainText("3840 × 2160 PNG");

    await test.step("zoom in until zooming in stops, at 3200%", async () => {
      const zoomIn = zoomControls(page).getByRole("button", { name: "Zoom in" });
      while (await zoomIn.isEnabled()) await zoomIn.click();
      await expect(zoomLevel(page)).toHaveText("3200%");
    });

    await test.step("every canvas layer is still the size of the visible area, in device pixels", async () => {
      for (const layer of [page.locator(WALLPAPER_CANVAS), page.getByTestId("guides"), page.getByTestId("overlay")]) {
        const box = (await layer.boundingBox())!;
        const size = await layer.evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height }));
        expect(Math.abs(size.width - box.width * 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(size.height - box.height * 2)).toBeLessThanOrEqual(1);
      }
    });

    const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
    expect(download.suggestedFilename()).toBe("wallpaper-3840x2160.png");
    expect(pngSize(await readFile(await download.path()))).toEqual({ width: 3840, height: 2160 });
  });
});

test("the zoom buttons, Shift+0 and Shift+1 change the zoom shown, which is saved but never undone", async ({ page }) => {
  await page.goto("/");
  const controls = zoomControls(page);
  const level = zoomLevel(page);
  // Drawn means the canvas, and its shortcuts, are ready.
  await waitForTextBounds(page.locator(WALLPAPER_CANVAS));
  const fitted = await level.textContent();

  await page.keyboard.press("Shift+0");
  await expect(level).toHaveText("100%");
  await controls.getByRole("button", { name: "Zoom in" }).click();
  await expect(level).toHaveText("200%");
  await controls.getByRole("button", { name: "Zoom out" }).click();
  await controls.getByRole("button", { name: "Zoom out" }).click();
  await expect(level).toHaveText("50%");

  await page.keyboard.press("Shift+1");
  await expect(level).toHaveText(fitted!);
  await controls.getByRole("button", { name: "100%" }).click();
  await expect(level).toHaveText("100%");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(level).toHaveText("100%");
  await page.reload();
  await expect(level).toHaveText("100%");
  await controls.getByRole("button", { name: "Fit" }).click();
  await expect(level).toHaveText(fitted!);
});

test("Cmd/Ctrl+scroll zooms towards the pointer, and scrolling pans", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(WALLPAPER_CANVAS);
  const ratio = await canvasPixelsPerCssPixel(canvas);
  await waitForTextBounds(canvas);
  const before = (await wallpaperBounds(canvas))!;
  // A point on the wallpaper, below and right of its centre.
  const pointer = { x: before.left + (before.right - before.left) * 0.7, y: before.top + (before.bottom - before.top) * 0.6 };
  const fitted = await zoomLevel(page).textContent();

  await page.mouse.move(...screenPoint(await canvas.boundingBox(), pointer, ratio));
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Control");
  await expect(zoomLevel(page)).not.toHaveText(fitted!);

  await test.step("the wallpaper shrank about the point under the pointer, which stayed in place", async () => {
    await expect(async () => {
      const after = (await wallpaperBounds(canvas))!;
      const growth = (after.right - after.left) / (before.right - before.left);
      expect(growth).toBeLessThan(0.8);
      expect(Math.abs(after.left - pointer.x - (before.left - pointer.x) * growth)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.top - pointer.y - (before.top - pointer.y) * growth)).toBeLessThanOrEqual(2);
    }).toPass();
  });

  await test.step("scrolling down 100 px moves the wallpaper up 100 px, at the same zoom", async () => {
    const zoomed = (await wallpaperBounds(canvas))!;
    const zoom = await zoomLevel(page).textContent();
    await page.mouse.wheel(0, 100);
    await expect(async () => {
      const scrolled = (await wallpaperBounds(canvas))!;
      expect(Math.abs(scrolled.top - (zoomed.top - 100 * ratio))).toBeLessThanOrEqual(1);
      expect(scrolled.left).toBe(zoomed.left);
    }).toPass();
    await expect(zoomLevel(page)).toHaveText(zoom!);
  });
});

// Pointer positions go from CSS px to screen px to wallpaper px; a high-DPI
// screen catches a conversion that forgets the device pixel ratio.
for (const deviceScaleFactor of [1, 2]) {
  test.describe(`at a device pixel ratio of ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });

    test("at 100%, Space+drag pans with the pointer, and dragging the block moves it by exactly the pointer's distance", async ({
      page,
    }) => {
      await page.goto("/");
      const canvas = page.locator(WALLPAPER_CANVAS);
      const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
      const y = inspector(page).getByRole("spinbutton", { name: "Y", exact: true });
      await waitForTextBounds(canvas);
      await page.keyboard.press("Shift+0");
      await expect(zoomLevel(page)).toHaveText("100%");

      await test.step("Space+drag moves the wallpaper with the pointer, 1 wallpaper px per CSS px", async () => {
        // At 100% the block is mostly off the canvas's left edge; the right end of its first line shows.
        const before = await waitForTextBounds(canvas);
        const box = (await canvas.boundingBox())!;
        const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
        await page.mouse.move(start.x, start.y);
        await page.keyboard.down("Space");
        await page.mouse.down();
        await page.mouse.move(start.x + 200, start.y - 100, { steps: 4 });
        await page.mouse.move(start.x + 400, start.y - 200, { steps: 4 });
        await page.mouse.up();
        await page.keyboard.up("Space");

        const ratio = await canvasPixelsPerCssPixel(canvas);
        await expect(async () => {
          const after = (await textBounds(canvas))!;
          expect(Math.abs(after.right - before.right - 400 * ratio)).toBeLessThanOrEqual(1.5);
          expect(Math.abs(after.top - before.top + 200 * ratio)).toBeLessThanOrEqual(1.5);
        }).toPass();
        await expect(inspector(page).getByText("Select a text block")).toBeVisible();
      });

      await test.step("dragging the block 100 px right and 50 px up moves it exactly 100 and 50 wallpaper px", async () => {
        const bounds = await waitForTextBounds(canvas);
        const start = screenPoint(await canvas.boundingBox(), centreOf(bounds), await canvasPixelsPerCssPixel(canvas));
        await page.mouse.move(...start);
        await page.mouse.down();
        await page.mouse.move(start[0] + 50, start[1] - 25, { steps: 4 });
        await page.mouse.move(start[0] + 100, start[1] - 50, { steps: 4 });
        await page.mouse.up();

        await expect(x).toHaveValue("154");
        await expect(y).toHaveValue("659.2");
      });
    });
  });
}

function zoomControls(page: Page) {
  return page.getByRole("group", { name: "Zoom" });
}

function zoomLevel(page: Page) {
  return zoomControls(page).getByTestId("zoom-level");
}

/** The right sidebar, where the selected block's position is shown. */
function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Inspector" });
}

async function choosePreset(page: Page, group: "Desktop" | "Mobile", size: string) {
  await page.getByLabel(/^Resolution presets/).click();
  await page.getByRole("group", { name: group }).getByRole("button", { name: new RegExp(`^${size}`) }).click();
}

function centreOf({ left, top, right, bottom }: Bounds) {
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** Canvas pixels per CSS pixel: the device pixel ratio, as the canvas was sized. */
function canvasPixelsPerCssPixel(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => element.width / element.getBoundingClientRect().width);
}

/** The whole-pixel page point (CSS px) over a canvas pixel. */
function screenPoint(
  box: { x: number; y: number } | null,
  canvasPoint: { x: number; y: number },
  ratio: number,
): [number, number] {
  return [Math.round(box!.x + canvasPoint.x / ratio), Math.round(box!.y + canvasPoint.y / ratio)];
}

async function waitForTextBounds(canvas: Locator): Promise<Bounds> {
  await expect.poll(() => textBounds(canvas)).not.toBeNull();
  return (await textBounds(canvas))!;
}

/** The bounds of the canvas's light pixels (the #F2F2F2 text on black), or null before any are drawn. */
function textBounds(canvas: Locator): Promise<Bounds | null> {
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

/** The bounds of the canvas's opaque pixels: the wallpaper, as the space around it is left clear. */
function wallpaperBounds(canvas: Locator): Promise<Bounds | null> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const { width, height } = element;
    if (width === 0 || height === 0) return null;
    const { data } = element.getContext("2d")!.getImageData(0, 0, width, height);
    let bounds: Bounds | null = null;
    for (let i = 0; i < width * height; i++) {
      if (data[i * 4 + 3] < 128) continue;
      const x = i % width;
      const y = Math.floor(i / width);
      bounds = bounds
        ? { left: Math.min(bounds.left, x), top: Math.min(bounds.top, y), right: Math.max(bounds.right, x), bottom: y }
        : { left: x, top: y, right: x, bottom: y };
    }
    return bounds;
  });
}
