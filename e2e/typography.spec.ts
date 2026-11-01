import { expect, test, type Locator, type Page } from "@playwright/test";

const WALLPAPER_CANVAS = 'canvas[aria-label="Wallpaper canvas"]';

/** Device-pixel bounds of the light (text) pixels on a canvas. */
interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

test("a newly chosen font has loaded before the canvas draws with it, and the block's box is measured in it", async ({
  page,
}) => {
  // Hold back the Google fonts the app hosts (OCR A is served from elsewhere),
  // so drawing or measuring before the font arrives would use the fallback font.
  await page.route("**/_next/static/media/*.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/");
  await selectStartingBlock(page);
  const before = await page.locator(WALLPAPER_CANVAS).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());

  await fontSelect(page).selectOption({ label: "Inter" });

  await test.step("when the canvas first changes, Inter has already loaded", async () => {
    // waitForFunction resolves only once the function returns a truthy value.
    const firstChange = await page.waitForFunction(
      ({ selector, before }) => {
        const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
        if (canvas.toDataURL() === before) return null;
        return { interLoaded: document.fonts.check("400 96px 'Inter'") };
      },
      { selector: WALLPAPER_CANVAS, before },
      { polling: "raf", timeout: 15_000 },
    );
    expect(await firstChange.jsonValue()).toEqual({ interLoaded: true });
  });

  await test.step("the block's width is its widest line measured in Inter", async () => {
    const interWidth = await page.evaluate(() => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = "400 96px 'Inter', sans-serif";
      return Math.max(...["DISCIPLINE", "EQUALS", "FREEDOM."].map((line) => ctx.measureText(line).width));
    });
    const width = inspector(page).getByRole("spinbutton", { name: "Width" });
    await expect.poll(async () => Number(await width.inputValue())).toBeCloseTo(interWidth, 1);
  });
});

test("the typography controls restyle the drawn text, and each change is one undo step", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(WALLPAPER_CANVAS);
  await selectStartingBlock(page);
  const weight = inspector(page).getByRole("combobox", { name: "Weight" });
  const size = inspector(page).getByRole("spinbutton", { name: "Font size" });

  await test.step("OCR A has one weight, so there's none to choose; Inter offers its nine", async () => {
    await expect(weight).toHaveCount(0);
    await fontSelect(page).selectOption({ label: "Inter" });
    await expect(weight.getByRole("option")).toHaveCount(9);
    await weight.selectOption({ label: "Black 900" });
  });

  await test.step("switching to IBM Plex Mono, whose heaviest weight is 700, picks Bold 700", async () => {
    await fontSelect(page).selectOption({ label: "IBM Plex Mono" });
    await expect(weight).toHaveValue("700");
  });

  await test.step("a font size typed and committed with Enter scales the drawn text", async () => {
    const before = await waitForTextBounds(canvas);
    await size.fill("48");
    await size.press("Enter");
    await expect.poll(async () => height(await waitForTextBounds(canvas))).toBeLessThan(height(before) * 0.6);
  });

  await test.step("undo steps back through the changes one at a time", async () => {
    await page.keyboard.press("ControlOrMeta+z");
    await expect(size).toHaveValue("96");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(fontSelect(page)).toHaveValue("inter");
    await expect(weight).toHaveValue("900");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(weight).toHaveValue("400");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(fontSelect(page)).toHaveValue("ocr-a");
    await expect(weight).toHaveCount(0);
  });
});

/** The right sidebar, where the selected block's properties are shown. */
function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Inspector" });
}

function fontSelect(page: Page) {
  return inspector(page).getByRole("combobox", { name: "Font", exact: true });
}

/** Clicks the middle of the starting block's drawn text, selecting it. */
async function selectStartingBlock(page: Page) {
  const canvas = page.locator(WALLPAPER_CANVAS);
  const { left, top, right, bottom } = await waitForTextBounds(canvas);
  const box = (await canvas.boundingBox())!;
  const ratio = await canvas.evaluate((element: HTMLCanvasElement) => element.width / element.getBoundingClientRect().width);
  await page.mouse.click(box.x + (left + right) / 2 / ratio, box.y + (top + bottom) / 2 / ratio);
  await expect(fontSelect(page)).toBeVisible();
}

function height({ top, bottom }: Bounds) {
  return bottom - top;
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
