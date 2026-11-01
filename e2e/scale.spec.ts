import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  canvasPixelsPerCssPixel,
  clickBlock,
  inspector,
  screenPointAt,
  textBounds,
  waitForTextBounds,
  wallpaperCanvas,
  wallpaperEdges,
} from "./support/blocks";

/** The starting wallpaper's width in wallpaper px. */
const WALLPAPER_WIDTH = 1920;
/** The inspector shows the font size to one decimal place, so an exact size reads within this of it. */
const SHOWN_TO_ONE_DECIMAL = 0.06;
/**
 * How far a line's measured width can stray from proportional to its font
 * size, per glyph, at each size: Chromium on Linux rounds each glyph's advance
 * to a whole pixel (on macOS advances stay fractional).
 */
const ADVANCE_ROUNDING = 0.5;
/** The starting block's longest line, DISCIPLINE, is 10 glyphs long. */
const LONGEST_LINE_GLYPHS = 10;

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** The selected block's box as the inspector shows it (to two decimals), and its font size (to one). */
async function readBlock(page: Page) {
  const field = (name: string) => inspector(page).getByRole("spinbutton", { name, exact: true });
  const value = async (name: string) => Number(await field(name).inputValue());
  return {
    x: await value("X"),
    y: await value("Y"),
    width: await value("Width"),
    height: await value("Height"),
    fontSize: await value("Font size"),
  };
}

type Block = Awaited<ReturnType<typeof readBlock>>;

/**
 * The font size at which a block scaled from `start` by its top-right handle
 * has its right edge at `right`: the old size × the new width ÷ the old width.
 * Snapping is checked by this size, which the Editor works out exactly on
 * every platform, rather than by the measured box. Chromium on Linux rounds
 * each glyph's advance to a whole pixel, so a measured edge can land a few
 * px off a guide there. src/editor/scaling.test.ts checks the box itself,
 * with a deterministic measurer.
 */
function fontSizeReaching(start: Block, right: number) {
  return (start.fontSize * (right - start.x)) / start.width;
}

/** How far the selected block's font size is from `expected`, as the inspector shows it. */
async function fontSizeOff(page: Page, expected: number) {
  return Math.abs((await readBlock(page)).fontSize - expected);
}

/**
 * Hides the grid, so the vertical centre line is the only target near the
 * starting block's right edge as it scales, then selects the block and moves
 * it to X 300, clear of the safe-area edge. Returns the block as it is then.
 */
async function selectBlockAtX300(page: Page) {
  await page.getByRole("checkbox", { name: "Show grid" }).uncheck();
  await clickBlock(page);
  const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
  await x.fill("300");
  await x.press("Enter");
  await expect(x).toHaveValue("300");
  return readBlock(page);
}

test("dragging a corner handle scales the block about the opposite corner, and one undo puts it back", async ({
  page,
}) => {
  await page.goto("/");
  // Snapping off, so the handle follows the pointer exactly (the next test covers snapping).
  await page.getByRole("checkbox", { name: "Snapping" }).uncheck();
  const canvas = wallpaperCanvas(page);
  await clickBlock(page);
  const before = await readBlock(page);
  const textBefore = await waitForTextBounds(canvas);
  expect(before.fontSize).toBe(96);

  // The starting block sits at the bottom-left of the safe area, so its top-right handle is free to drag.
  const handle = await handleOnScreen(page, "top-right");
  await test.step("the pointer over a handle shows a diagonal double arrow", async () => {
    await page.mouse.move(handle.x, handle.y);
    await expect(canvasContainer(page)).toHaveCSS("cursor", "nesw-resize");
  });

  await page.mouse.down();
  await page.mouse.move(handle.x + 60, handle.y - 30, { steps: 4 });
  await page.mouse.move(handle.x + 120, handle.y - 60, { steps: 4 });
  await page.mouse.up();

  await test.step("the font size grew, and the box grew with it, keeping its proportions", async () => {
    await expect.poll(async () => (await readBlock(page)).fontSize).toBeGreaterThan(110);
    const after = await readBlock(page);
    const factor = after.fontSize / before.fontSize;
    // The height is lines × line height × font size, so it scales exactly.
    expect(after.height / before.height).toBeCloseTo(factor, 2);
    // The width is measured, so it is proportional only to within each glyph's advance rounding at both sizes.
    const rounding = LONGEST_LINE_GLYPHS * ADVANCE_ROUNDING * (1 + factor);
    expect(Math.abs(after.width - before.width * factor)).toBeLessThanOrEqual(rounding);
  });

  await test.step("the opposite (bottom-left) corner stayed where it was", async () => {
    const after = await readBlock(page);
    expect(after.x).toBe(before.x);
    expect(Math.abs(after.y + after.height - (before.y + before.height))).toBeLessThanOrEqual(0.02);
  });

  // The drawn pixels' left and bottom shift slightly as the glyphs' side bearings scale, so only growth is checked here.
  await test.step("the drawn text grew up and to the right", async () => {
    await expect.poll(async () => (await textBounds(canvas))!.top).toBeLessThan(textBefore.top - 10);
    expect((await textBounds(canvas))!.right).toBeGreaterThan(textBefore.right + 10);
  });

  await test.step("one undo puts the block back as it was", async () => {
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => readBlock(page)).toEqual(before);
    await expect.poll(() => textBounds(canvas)).toEqual(textBefore);
  });
});

test("a scaled edge snaps onto the centre line at exactly the font size that puts it there, with a smart guide until the drop", async ({
  page,
}) => {
  await page.goto("/");
  const guides = page.getByTestId("guides");
  const before = await selectBlockAtX300(page);
  const onCentreLine = fontSizeReaching(before, 960);

  // Along the box's diagonal, so the corner follows the pointer, to 2 screen px short of the centre line.
  const scale = await screenPxPerWallpaperPx(wallpaperCanvas(page));
  const growth = (960 - (before.x + before.width)) / before.width - 2 / scale / before.width;
  const handle = await handleOnScreen(page, "top-right");
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(
    handle.x + Math.round(growth * before.width * scale),
    handle.y - Math.round(growth * before.height * scale),
    { steps: 6 },
  );

  await test.step("while scaling, the font size is exactly the one that puts the right edge on the centre line, and a smart guide shows", async () => {
    await expect.poll(() => fontSizeOff(page, onCentreLine)).toBeLessThanOrEqual(SHOWN_TO_ONE_DECIMAL);
    await expect.poll(() => smartGuidePixels(guides)).toBeGreaterThan(100);
    expect((await readBlock(page)).x).toBe(300);
  });

  await test.step("pressing Ctrl unsnaps the edge at once, back under the pointer, and letting go re-snaps it", async () => {
    // Under the pointer, 2 screen px short of the centre line, the font size is this much smaller (about 0.6 px).
    // Half of it leaves room for the pointer's whole-pixel steps and the inspector's rounding.
    const shortBy = onCentreLine - fontSizeReaching(before, 960 - 2 / scale);
    await page.keyboard.down("Control");
    await expect.poll(async () => onCentreLine - (await readBlock(page)).fontSize).toBeGreaterThan(shortBy / 2);
    expect(await smartGuidePixels(guides)).toBe(0);
    await page.keyboard.up("Control");
    await expect.poll(() => fontSizeOff(page, onCentreLine)).toBeLessThanOrEqual(SHOWN_TO_ONE_DECIMAL);
    await expect.poll(() => smartGuidePixels(guides)).toBeGreaterThan(100);
  });

  await test.step("dropping keeps the size and removes the smart guide; one undo puts it back", async () => {
    await page.mouse.up();
    await expect.poll(() => smartGuidePixels(guides)).toBe(0);
    expect(await fontSizeOff(page, onCentreLine)).toBeLessThanOrEqual(SHOWN_TO_ONE_DECIMAL);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => readBlock(page)).toEqual(before);
  });
});

// Pointer positions go from CSS px to screen px to wallpaper px; a high-DPI
// screen catches a conversion that forgets the device pixel ratio.
for (const deviceScaleFactor of [1, 2]) {
  test.describe(`at a device pixel ratio of ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });

    test("zoomed in and panned, the handles are hit where they're drawn, and a scale snaps within 6 screen px at the real zoom", async ({
      page,
    }) => {
      await page.goto("/");
      const before = await selectBlockAtX300(page);
      const onCentreLine = fontSizeReaching(before, 960);

      const zoom = await test.step("zoom in on the top-right handle with Ctrl+scroll, which pans to keep it under the pointer", async () => {
        const fitted = await handleOnScreen(page, "top-right");
        await page.mouse.move(fitted.x, fitted.y);
        await page.keyboard.down("Control");
        while ((await zoomPercent(page)) < 180) await page.mouse.wheel(0, -100);
        await page.keyboard.up("Control");
        return (await zoomPercent(page)) / 100;
      });

      await test.step("scroll, which pans the handle away from where it was drawn when fitted", async () => {
        const zoomed = await handleOnScreen(page, "top-right");
        await page.mouse.wheel(60, 80);
        // Emulating a high-DPI screen, Chromium halves synthetic wheel deltas, so this only asks for a clear move.
        await expect.poll(async () => (await handleOnScreen(page, "top-right")).y).toBeLessThan(zoomed.y - 30);
      });

      const handle = await handleOnScreen(page, "top-right");
      await test.step("the pointer over the handle as drawn now shows a diagonal double arrow", async () => {
        await page.mouse.move(handle.x + 1, handle.y);
        await page.mouse.move(handle.x, handle.y);
        await expect(canvasContainer(page)).toHaveCSS("cursor", "nesw-resize");
      });

      // Along the box's diagonal, so the corner follows the pointer, to `short` screen px left of the centre line.
      const pointerFor = (short: number) => {
        const growth = (960 - short / zoom - (before.x + before.width)) / before.width;
        return { x: handle.x + Math.round(growth * before.width * zoom), y: handle.y - Math.round(growth * before.height * zoom) };
      };
      await page.mouse.down();

      await test.step("9 screen px short, which is in reach at the fitted zoom but not at this one, it doesn't snap", async () => {
        const pointer = pointerFor(9);
        await page.mouse.move(pointer.x, pointer.y, { steps: 6 });
        // Under the pointer, the font size is this much smaller than on the centre line (about 0.6 px). Half of it
        // leaves room for the pointer's whole-pixel steps and the inspector's rounding.
        const shortBy = onCentreLine - fontSizeReaching(before, 960 - 9 / zoom);
        await expect.poll(async () => onCentreLine - (await readBlock(page)).fontSize).toBeGreaterThan(shortBy / 2);
        expect(await smartGuidePixels(page.getByTestId("guides"))).toBe(0);
      });

      await test.step("2 screen px short, it snaps onto the centre line at exactly the font size that puts it there, with the opposite corner fixed", async () => {
        const pointer = pointerFor(2);
        await page.mouse.move(pointer.x, pointer.y, { steps: 2 });
        await expect.poll(() => fontSizeOff(page, onCentreLine)).toBeLessThanOrEqual(SHOWN_TO_ONE_DECIMAL);
        await expect.poll(() => smartGuidePixels(page.getByTestId("guides"))).toBeGreaterThan(100);
        const after = await readBlock(page);
        expect(after.x).toBe(300);
        expect(Math.abs(after.y + after.height - (before.y + before.height))).toBeLessThanOrEqual(0.02);
      });

      await page.mouse.up();
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => readBlock(page)).toEqual(before);
    });
  });
}

test("the selected block shows a handle at each corner, and the handles are never exported", async ({ page }) => {
  await page.goto("/");
  await waitForTextBounds(wallpaperCanvas(page));
  const exportedUnselected = await exportPng(page);

  await clickBlock(page);
  const { x, y, width, height } = await readBlock(page);
  const scale = await screenPxPerWallpaperPx(wallpaperCanvas(page));
  const topLeft = await handleOnScreen(page, "top-left");
  const bottomRight = await handleOnScreen(page, "bottom-right");
  // The handles are as far apart on screen as the box's corners, to within a pixel or so.
  expect(Math.abs(bottomRight.x - topLeft.x - width * scale)).toBeLessThanOrEqual(2);
  expect(Math.abs(bottomRight.y - topLeft.y - height * scale)).toBeLessThanOrEqual(2);
  expect(x).toBe(54);
  expect(y).toBe(709.2);

  expect((await exportPng(page)).equals(exportedUnselected)).toBe(true);
});

/** The zoom shown in the zoom controls, in percent. */
async function zoomPercent(page: Page) {
  return parseFloat((await page.getByRole("group", { name: "Zoom" }).getByTestId("zoom-level").textContent())!);
}

/** The element the canvas layers fill, which takes the pointer and shows its cursor. */
function canvasContainer(page: Page) {
  return wallpaperCanvas(page).locator("..");
}

/**
 * The screen point (CSS px) at the middle of a corner handle, found from the
 * handles' white squares on the overlay: the only white pixels it draws.
 */
async function handleOnScreen(page: Page, corner: Corner) {
  const overlay = page.getByTestId("overlay");
  const find = () =>
    overlay.evaluate((element: HTMLCanvasElement, corner) => {
      const { width, height } = element;
      if (width === 0 || height === 0) return null;
      const { data } = element.getContext("2d")!.getImageData(0, 0, width, height);
      const white: { x: number; y: number }[] = [];
      for (let i = 0; i < width * height; i++) {
        if (data[i * 4] > 240 && data[i * 4 + 1] > 240 && data[i * 4 + 2] > 240 && data[i * 4 + 3] > 240) {
          white.push({ x: i % width, y: Math.floor(i / width) });
        }
      }
      if (white.length === 0) return null;
      const middleX = (Math.min(...white.map(({ x }) => x)) + Math.max(...white.map(({ x }) => x))) / 2;
      const middleY = (Math.min(...white.map(({ y }) => y)) + Math.max(...white.map(({ y }) => y))) / 2;
      const [vertical, horizontal] = corner.split("-");
      const inCorner = white.filter(
        ({ x, y }) => (horizontal === "left" ? x < middleX : x > middleX) && (vertical === "top" ? y < middleY : y > middleY),
      );
      const xs = inCorner.map(({ x }) => x);
      const ys = inCorner.map(({ y }) => y);
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    }, corner);
  await expect.poll(find).not.toBeNull();
  return screenPointAt(overlay, (await find())!);
}

/** Screen (CSS) px per wallpaper px, measured from how wide the whole wallpaper is drawn, as it is when fitted. */
async function screenPxPerWallpaperPx(canvas: Locator) {
  const { left, right } = await wallpaperEdges(canvas);
  return (right - left) / (await canvasPixelsPerCssPixel(canvas)) / WALLPAPER_WIDTH;
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

async function exportPng(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export Wallpaper/ }).click(),
  ]);
  return readFile(await download.path());
}
