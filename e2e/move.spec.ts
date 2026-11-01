import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

const WALLPAPER_CANVAS = 'canvas[aria-label="Wallpaper canvas"]';

/** Device-pixel bounds of the light (text) pixels on a canvas. */
interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Pointer positions go from CSS px to canvas px to wallpaper px; a high-DPI
// screen catches a conversion that forgets the device pixel ratio.
for (const deviceScaleFactor of [1, 2]) {
  test.describe(`at a device pixel ratio of ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });

    test("dragging the block moves it on the canvas with the pointer, and the drag is one undo step", async ({
      page,
    }) => {
      await page.goto("/");
      // Snapping off, so the block follows the pointer exactly (snapping.spec.ts covers snapping).
      await page.getByRole("checkbox", { name: "Snapping" }).uncheck();
      const canvas = page.locator(WALLPAPER_CANVAS);
      const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
      const y = inspector(page).getByRole("spinbutton", { name: "Y", exact: true });
      const before = await waitForTextBounds(canvas);
      const start = await screenPointAt(canvas, centreOf(before));
      const drag = { x: 150, y: -200 };

      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + drag.x / 2, start.y + drag.y / 2, { steps: 4 });
      await page.mouse.move(start.x + drag.x, start.y + drag.y, { steps: 4 });
      await page.mouse.up();

      await test.step("the drawn text followed the pointer, to within a pixel or so of anti-aliasing", async () => {
        const ratio = await canvasPixelsPerCssPixel(canvas);
        await expect(async () => {
          const after = (await textBounds(canvas))!;
          expect(Math.abs(after.left - before.left - drag.x * ratio)).toBeLessThanOrEqual(1.5);
          expect(Math.abs(after.top - before.top - drag.y * ratio)).toBeLessThanOrEqual(1.5);
        }).toPass();
      });

      await test.step("the inspector shows the block's new position", async () => {
        await expect(x).not.toHaveValue("54");
        expect(Number(await x.inputValue())).toBeGreaterThan(54);
        expect(Number(await y.inputValue())).toBeLessThan(709.2);
      });

      await test.step("one undo puts it back", async () => {
        await page.keyboard.press("ControlOrMeta+z");
        await expect(x).toHaveValue("54");
        await expect(y).toHaveValue("709.2");
        await expect.poll(() => textBounds(canvas)).toEqual(before);
      });
    });
  });
}

test("arrow keys nudge the selected block, Shift+arrow by 10 px, and Escape deselects", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(WALLPAPER_CANVAS);
  const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
  const y = inspector(page).getByRole("spinbutton", { name: "Y", exact: true });
  const hint = inspector(page).getByText("Select a text block");

  await test.step("clicking the block selects it and shows its position", async () => {
    await expect(hint).toBeVisible();
    await clickBlock(page, canvas);
    await expect(x).toHaveValue("54");
    await expect(y).toHaveValue("709.2");
    await expect(inspector(page).getByRole("spinbutton", { name: "Width" })).toHaveJSProperty("readOnly", true);
  });

  await test.step("an arrow nudges it 1 px and Shift+arrow 10 px", async () => {
    await page.keyboard.press("ArrowRight");
    await expect(x).toHaveValue("55");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(y).toHaveValue("699.2");
  });

  await test.step("Escape deselects, and then arrows do nothing", async () => {
    await page.keyboard.press("Escape");
    await expect(hint).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await clickBlock(page, canvas);
    await expect(x).toHaveValue("55");
  });

  await test.step("a typed X is applied on Enter and moves the drawn text", async () => {
    const before = await waitForTextBounds(canvas);
    await x.fill("300");
    await x.press("Enter");
    await expect(x).toHaveValue("300");
    await expect.poll(async () => (await textBounds(canvas))!.left).toBeGreaterThan(before.left + 50);
  });
});

test("the selection box is drawn over the canvas but never exported", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(WALLPAPER_CANVAS);
  const overlay = page.getByTestId("overlay");
  await waitForTextBounds(canvas);
  const exportedUnselected = await exportPng(page);
  const unselectedOverlayPixels = await drawnPixels(overlay);

  await clickBlock(page, canvas);
  await expect.poll(() => drawnPixels(overlay)).toBeGreaterThan(unselectedOverlayPixels);

  expect((await exportPng(page)).equals(exportedUnselected)).toBe(true);
});

test("the part of a block past the wallpaper's edge shows faded on the canvas", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(WALLPAPER_CANVAS);
  await clickBlock(page, canvas);
  const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
  await x.fill("-200");
  await x.press("Enter");
  await page.keyboard.press("Escape");

  // Light pixels drawn on the wallpaper canvas, split by the wallpaper's left
  // edge, with how opaque the overlay is over each.
  const sample = () =>
    page.evaluate((selector) => {
      const main = document.querySelector<HTMLCanvasElement>(selector)!;
      const overlay = document.querySelector<HTMLCanvasElement>('[data-testid="overlay"]')!;
      const { width, height } = main;
      const pixels = main.getContext("2d")!.getImageData(0, 0, width, height).data;
      const wash = overlay.getContext("2d")!.getImageData(0, 0, width, height).data;
      // The middle row has no text, so the wallpaper starts at its first opaque pixel.
      const middle = Math.floor(height / 2) * width;
      let edge = 0;
      while (edge < width && pixels[(middle + edge) * 4 + 3] < 255) edge++;

      const washOutside: number[] = [];
      const washInside: number[] = [];
      for (let i = 0; i < width * height; i++) {
        if (pixels[i * 4] < 200 || pixels[i * 4 + 3] < 200) continue;
        const column = i % width;
        if (column < edge - 1) washOutside.push(wash[i * 4 + 3]);
        else if (column > edge + 1) washInside.push(wash[i * 4 + 3]);
      }
      return { edge, washOutside, washInside };
    }, WALLPAPER_CANVAS);

  await expect.poll(async () => (await sample()).washOutside.length).toBeGreaterThan(100);
  const { washOutside, washInside } = await sample();
  expect(washInside.length, "text drawn inside the wallpaper").toBeGreaterThan(100);
  expect(Math.min(...washOutside), "overlay opacity over text past the edge").toBeGreaterThan(150);
  expect(Math.max(...washInside), "overlay opacity over text inside the wallpaper").toBe(0);
});

/** The right sidebar, where the selected block's position is shown. */
function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Inspector" });
}

/** Clicks the middle of the drawn text, which is inside the block's box. */
async function clickBlock(page: Page, canvas: Locator) {
  const point = await screenPointAt(canvas, centreOf(await waitForTextBounds(canvas)));
  await page.mouse.click(point.x, point.y);
}

function centreOf({ left, top, right, bottom }: Bounds) {
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** Canvas pixels per CSS pixel: the device pixel ratio, as the canvas was sized. */
function canvasPixelsPerCssPixel(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => element.width / element.getBoundingClientRect().width);
}

/** The whole-pixel screen point (CSS px) over a canvas pixel. */
async function screenPointAt(canvas: Locator, canvasPoint: { x: number; y: number }) {
  const box = (await canvas.boundingBox())!;
  const ratio = await canvasPixelsPerCssPixel(canvas);
  return { x: Math.round(box.x + canvasPoint.x / ratio), y: Math.round(box.y + canvasPoint.y / ratio) };
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

async function exportPng(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export Wallpaper/ }).click(),
  ]);
  return readFile(await download.path());
}
