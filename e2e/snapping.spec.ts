import { expect, test, type Locator, type Page } from "@playwright/test";

const WALLPAPER_CANVAS = 'canvas[aria-label="Wallpaper canvas"]';
/** The starting wallpaper's width in wallpaper px. */
const WALLPAPER_WIDTH = 1920;

/**
 * Drags the starting block towards the vertical centre line, 2 screen px past
 * where its centre would sit exactly on it (well inside the 6 px snap
 * distance), and keeps the mouse button down. Returns where the block's X
 * would be if its centre were on the centre line, and where the pointer is.
 *
 * The grid is hidden first, so nothing but the centre line is in reach.
 */
async function dragTowardsCentreLine(page: Page) {
  await page.getByRole("checkbox", { name: "Show grid" }).uncheck();
  const canvas = page.locator(WALLPAPER_CANVAS);
  const start = await pointOverText(canvas);
  await page.mouse.click(start.x, start.y);

  // The real font's width, as the inspector shows it.
  const x = Number(await positionField(page, "X").inputValue());
  const width = Number(await inspector(page).getByRole("spinbutton", { name: "Width" }).inputValue());
  const centred = 960 - width / 2;

  const scale = await screenPxPerWallpaperPx(canvas);
  const offset = Math.round((centred - x) * scale) + 2;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const pointer = { x: start.x + offset, y: start.y };
  await page.mouse.move(pointer.x, pointer.y, { steps: 5 });
  return { centred, pointer };
}

test("a block dragged near the centre line snaps onto it, with a smart guide until the drop", async ({ page }) => {
  await page.goto("/");
  const x = positionField(page, "X");
  const guides = page.getByTestId("guides");

  const { centred } = await dragTowardsCentreLine(page);

  await test.step("while dragging, the block's centre is exactly on the centre line and a smart guide shows", async () => {
    await expect.poll(async () => Math.abs(Number(await x.inputValue()) - centred)).toBeLessThanOrEqual(0.01);
    await expect.poll(() => smartGuidePixels(guides)).toBeGreaterThan(100);
  });

  await test.step("dropping keeps the block there and removes the smart guide", async () => {
    await page.mouse.up();
    await expect.poll(() => smartGuidePixels(guides)).toBe(0);
    expect(Math.abs(Number(await x.inputValue()) - centred)).toBeLessThanOrEqual(0.01);
  });

  await test.step("one undo puts the block back", async () => {
    await page.keyboard.press("ControlOrMeta+z");
    await expect(x).toHaveValue("54");
  });
});

test("holding Ctrl during a drag, or turning Snapping off, lets the block move freely", async ({ page }) => {
  await page.goto("/");
  const x = positionField(page, "X");
  const guides = page.getByTestId("guides");
  const snapping = page.getByRole("checkbox", { name: "Snapping" });
  await expect(snapping).toBeChecked();

  await test.step("pressing Ctrl mid-drag unsnaps the block at once, back under the pointer", async () => {
    const { centred, pointer } = await dragTowardsCentreLine(page);
    const isCentred = async () => Math.abs(Number(await x.inputValue()) - centred) <= 0.01;
    await expect.poll(isCentred).toBe(true);

    await page.keyboard.down("Control");
    await expect.poll(async () => Number(await x.inputValue())).toBeGreaterThan(centred + 1);
    await expect.poll(() => smartGuidePixels(guides)).toBe(0);

    await test.step("it moves freely while Ctrl is held, and snaps again once it's let go", async () => {
      await page.mouse.move(pointer.x + 1, pointer.y);
      await expect.poll(async () => Number(await x.inputValue())).toBeGreaterThan(centred + 3);
      expect(await smartGuidePixels(guides)).toBe(0);
      await page.keyboard.up("Control");
      await expect.poll(isCentred).toBe(true);
    });

    await page.mouse.up();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(x).toHaveValue("54");
  });

  await test.step("with Snapping off, the block follows the pointer past the centre line", async () => {
    await snapping.uncheck();
    const { centred } = await dragTowardsCentreLine(page);
    await expect.poll(async () => Number(await x.inputValue())).toBeGreaterThan(centred + 1);
    expect(await smartGuidePixels(guides)).toBe(0);
    await page.mouse.up();
  });
});

function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Inspector" });
}

function positionField(page: Page, name: "X" | "Y") {
  return inspector(page).getByRole("spinbutton", { name, exact: true });
}

/**
 * Screen (CSS) px per wallpaper px, measured from how wide the wallpaper is
 * drawn: across the canvas's middle row (no text there), only the wallpaper
 * is opaque.
 */
function screenPxPerWallpaperPx(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement, wallpaperWidth) => {
    const { width, height } = element;
    const row = element.getContext("2d")!.getImageData(0, Math.floor(height / 2), width, 1).data;
    let drawn = 0;
    for (let i = 3; i < row.length; i += 4) if (row[i] > 127) drawn++;
    const canvasPxPerCssPx = width / element.getBoundingClientRect().width;
    return drawn / canvasPxPerCssPx / wallpaperWidth;
  }, WALLPAPER_WIDTH);
}

/** A screen point (CSS px) in the middle of the drawn text, once it's drawn. */
async function pointOverText(canvas: Locator) {
  await expect.poll(() => textCentre(canvas)).not.toBeNull();
  const centre = (await textCentre(canvas))!;
  const box = (await canvas.boundingBox())!;
  const ratio = await canvas.evaluate((element: HTMLCanvasElement) => element.width / element.getBoundingClientRect().width);
  return { x: Math.round(box.x + centre.x / ratio), y: Math.round(box.y + centre.y / ratio) };
}

/** The centre of the canvas's light (text) pixels, in canvas px, or null before any are drawn. */
function textCentre(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const { width, height } = element;
    if (width === 0 || height === 0) return null;
    const { data } = element.getContext("2d")!.getImageData(0, 0, width, height);
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < width * height; i++) {
      if (data[i * 4] < 128) continue;
      const x = i % width;
      const y = Math.floor(i / width);
      [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
    }
    return left === Infinity ? null : { x: (left + right) / 2, y: (top + bottom) / 2 };
  });
}

/** How many pixels of the guides layer are the smart guides' rose: strongly red, little green. */
function smartGuidePixels(guides: Locator): Promise<number> {
  return guides.evaluate((element: HTMLCanvasElement) => {
    if (element.width === 0 || element.height === 0) return 0;
    const { data } = element.getContext("2d")!.getImageData(0, 0, element.width, element.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 200 && data[i + 1] < 120 && data[i + 3] > 200) count++;
    return count;
  });
}
