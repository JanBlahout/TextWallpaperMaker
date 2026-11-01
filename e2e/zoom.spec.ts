import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  canvasPixelsPerCssPixel,
  centreOf,
  inspector,
  screenPointAt,
  textBounds,
  waitForTextBounds,
  type Bounds,
} from "./support/blocks";
import { WALLPAPER_CANVAS } from "./support/canvas";
import { pngSize } from "./support/png";

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

  const start = await screenPointAt(canvas, pointer);
  await page.mouse.move(start.x, start.y);
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

test("Space+drag still pans after clicking a sidebar control, without pressing it again, while a control reached with Tab keeps Space", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.locator(WALLPAPER_CANVAS);
  const showGrid = page.getByRole("checkbox", { name: "Show grid" });
  await waitForTextBounds(canvas);
  await showGrid.click();
  await expect(showGrid).not.toBeChecked();
  const before = (await wallpaperBounds(canvas))!;

  const box = (await canvas.boundingBox())!;
  const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  await page.mouse.move(start.x, start.y);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(start.x + 60, start.y + 30, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");

  const ratio = await canvasPixelsPerCssPixel(canvas);
  await expect(async () => {
    const after = (await wallpaperBounds(canvas))!;
    expect(Math.abs(after.left - before.left - 60 * ratio)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.top - before.top - 30 * ratio)).toBeLessThanOrEqual(1);
  }).toPass();
  await expect(showGrid).not.toBeChecked();

  // The Show grid box comes straight after the Grid columns field.
  await page.getByRole("spinbutton", { name: "Grid columns" }).click();
  await page.keyboard.press("Tab");
  await expect(showGrid).toBeFocused();
  await page.keyboard.press("Space");
  await expect(showGrid).toBeChecked();
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
      // Off, so the block lands exactly where the pointer takes it rather than on a guide nearby.
      await page.getByRole("checkbox", { name: "Snapping" }).uncheck();
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
        const start = await screenPointAt(canvas, centreOf(bounds));
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x + 50, start.y - 25, { steps: 4 });
        await page.mouse.move(start.x + 100, start.y - 50, { steps: 4 });
        await page.mouse.up();

        await expect(x).toHaveValue("154");
        await expect(y).toHaveValue("659.2");
      });
    });
  });
}

test.describe("zoomed to 200% and panned, on a high-DPI screen", () => {
  test.use({ deviceScaleFactor: 2 });

  test("snapping stays within 6 screen px, and the smart guide, the selection box and the dragged block line up with the wallpaper", async ({
    page,
  }) => {
    await page.goto("/");
    const canvas = page.locator(WALLPAPER_CANVAS);
    const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
    // With the grid hidden, the safe-area edge at x 54 is the only vertical line in reach.
    await page.getByRole("checkbox", { name: "Show grid" }).uncheck();
    const toPage = await zoomInOnTheStartingBlock(page);
    const start = await screenPointAt(canvas, centreOf(await waitForTextBounds(canvas)));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();

    await test.step("4 screen px (2 wallpaper px) off the safe-area edge, the block snaps onto it, with the guide and box on it", async () => {
      await page.mouse.move(start.x + 4, start.y, { steps: 2 });
      await expect(x).toHaveValue("54");
      const edge = toPage({ x: 54, y: 0 }).x;
      await expect.poll(() => linesAcross(page, "guides", SMART_GUIDE, start.y)).toEqual([expect.closeTo(edge, 0)]);
      expect(await linesAcross(page, "overlay", SELECTION_BOX, start.y)).toEqual([expect.closeTo(edge, 0)]);
    });

    await test.step("8 screen px (4 wallpaper px) off it, past 6 screen px, the block moves freely with the box", async () => {
      await page.mouse.move(start.x + 8, start.y, { steps: 2 });
      await expect(x).toHaveValue("58");
      await expect.poll(() => linesAcross(page, "guides", SMART_GUIDE, start.y)).toEqual([]);
      // The box's right edge, at x 630, is past the canvas's right edge.
      const edge = toPage({ x: 58, y: 0 }).x;
      expect(await linesAcross(page, "overlay", SELECTION_BOX, start.y)).toEqual([expect.closeTo(edge, 0)]);
    });

    await page.mouse.up();
    await expect(x).toHaveValue("58");
  });

  test("the in-place text field sits on the block, and zooms with the canvas while it stays open", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator(WALLPAPER_CANVAS);
    const field = page.getByRole("textbox", { name: "Edit text in place" });
    const fontSize = () => field.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    const toPage = await zoomInOnTheStartingBlock(page);
    const start = await screenPointAt(canvas, centreOf(await waitForTextBounds(canvas)));
    await page.mouse.dblclick(start.x, start.y);
    await expect(field).toBeFocused();

    await test.step("its top-left corner is on the block's, at (54, 709.2), and its 96 px text shows at 192 px", async () => {
      const corner = toPage({ x: 54, y: 709.2 });
      const box = (await field.boundingBox())!;
      expect(box.x).toBeCloseTo(corner.x, 0);
      expect(box.y).toBeCloseTo(corner.y, 0);
      expect(await fontSize()).toBe(192);
    });

    await test.step("Cmd/Ctrl+scroll over it zooms it about the pointer along with the canvas, and it stays open", async () => {
      const before = (await field.boundingBox())!;
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -100);
      await page.keyboard.up("Control");
      await expect.poll(fontSize).toBeGreaterThan(192);
      const growth = (await fontSize()) / 192;
      const after = (await field.boundingBox())!;
      expect(after.x - start.x).toBeCloseTo((before.x - start.x) * growth, 0);
      expect(after.y - start.y).toBeCloseTo((before.y - start.y) * growth, 0);
      await expect(field).toBeFocused();
    });
  });
});

/** The smart guides' rose: strongly red, little green. */
const SMART_GUIDE = { red: [200, 255], green: [0, 120], blue: [0, 255] } as const;
/** The selection box's blue. */
const SELECTION_BOX = { red: [0, 150], green: [120, 210], blue: [200, 255] } as const;

type Colour = { [channel in "red" | "green" | "blue"]: readonly [number, number] };

/**
 * Zooms to 100%, then in to 200%, and scrolls 1500 px left and 300 px down, so
 * the canvas's centre shows wallpaper (960 − 1500 ÷ 2, 540 + 300 ÷ 2) = (210, 690)
 * and the starting block's left edge is on the canvas. Returns where a
 * wallpaper point shows on the page, worked out from that.
 */
async function zoomInOnTheStartingBlock(page: Page) {
  const canvas = page.locator(WALLPAPER_CANVAS);
  await waitForTextBounds(canvas);
  await page.keyboard.press("Shift+0");
  await zoomControls(page).getByRole("button", { name: "Zoom in" }).click();
  await expect(zoomLevel(page)).toHaveText("200%");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // The page sees the wheel's deltas ÷ the device pixel ratio of 2: 1500 CSS px left and 300 down.
  await page.mouse.wheel(-3000, 600);
  const toPage = ({ x, y }: { x: number; y: number }) => ({
    x: box.x + box.width / 2 + (x - 210) * 2,
    y: box.y + box.height / 2 + (y - 690) * 2,
  });
  // Until then, the text runs off the canvas's left edge.
  await expect.poll(async () => (await textBounds(canvas))!.left).toBeGreaterThan(0);
  return toPage;
}

/**
 * The page x (CSS px) of each vertical line of a colour on a layer, where it
 * crosses the row at page y `y`, left to right: the middle of each run of
 * device px of that colour along the row.
 */
async function linesAcross(page: Page, layer: "guides" | "overlay", colour: Colour, y: number): Promise<number[]> {
  const canvas = page.getByTestId(layer);
  const box = (await canvas.boundingBox())!;
  const ratio = await canvasPixelsPerCssPixel(canvas);
  const row = Math.round((y - box.y) * ratio);
  const runs = await canvas.evaluate(
    (element: HTMLCanvasElement, { row, red, green, blue }) => {
      const { data } = element.getContext("2d")!.getImageData(0, row, element.width, 1);
      const found: [number, number][] = [];
      for (let x = 0; x < element.width; x++) {
        const [r, g, b, a] = data.slice(x * 4, x * 4 + 4);
        if (a < 150 || r < red[0] || r > red[1] || g < green[0] || g > green[1] || b < blue[0] || b > blue[1]) continue;
        const last = found.at(-1);
        if (last && last[1] === x) last[1] = x + 1;
        else found.push([x, x + 1]);
      }
      return found;
    },
    { row, ...colour },
  );
  return runs.map(([from, to]) => box.x + (from + to) / 2 / ratio);
}

function zoomControls(page: Page) {
  return page.getByRole("group", { name: "Zoom" });
}

function zoomLevel(page: Page) {
  return zoomControls(page).getByTestId("zoom-level");
}

async function choosePreset(page: Page, group: "Desktop" | "Mobile", size: string) {
  await page.getByLabel(/^Resolution presets/).click();
  await page.getByRole("group", { name: group }).getByRole("button", { name: new RegExp(`^${size}`) }).click();
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
