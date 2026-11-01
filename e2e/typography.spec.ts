import { expect, test, type Page } from "@playwright/test";
import { clickBlock, inspector, waitForTextBounds, wallpaperCanvas, type Bounds } from "./support/blocks";
import { WALLPAPER_CANVAS } from "./support/canvas";

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
  const before = await wallpaperCanvas(page).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  // The family name Next.js generated for Inter, from its @font-face rules.
  const inter = await page.evaluate(
    () => [...document.fonts].find(({ family }) => family.includes("Inter") && !family.includes("Fallback"))!.family,
  );

  await fontSelect(page).selectOption({ label: "Inter" });

  await test.step("when the canvas first changes, Inter has already loaded", async () => {
    // waitForFunction resolves only once the function returns a truthy value.
    const firstChange = await page.waitForFunction(
      ({ selector, before, inter }) => {
        const canvas = document.querySelector<HTMLCanvasElement>(selector)!;
        if (canvas.toDataURL() === before) return null;
        return { interLoaded: document.fonts.check(`400 96px "${inter}"`) };
      },
      { selector: WALLPAPER_CANVAS, before, inter },
      { polling: "raf", timeout: 15_000 },
    );
    expect(await firstChange.jsonValue()).toEqual({ interLoaded: true });
  });

  await test.step("the block's width is its widest line measured in Inter", async () => {
    const interWidth = await page.evaluate((inter) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = `400 96px "${inter}", sans-serif`;
      return Math.max(...["DISCIPLINE", "EQUALS", "FREEDOM."].map((line) => ctx.measureText(line).width));
    }, inter);
    const width = inspector(page).getByRole("spinbutton", { name: "Width" });
    await expect.poll(async () => Number(await width.inputValue())).toBeCloseTo(interWidth, 1);
  });
});

test("the typography controls restyle the drawn text, and each change is one undo step", async ({ page }) => {
  await page.goto("/");
  const canvas = wallpaperCanvas(page);
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

function fontSelect(page: Page) {
  return inspector(page).getByRole("combobox", { name: "Font", exact: true });
}

/** Selects the starting block, the only one, by clicking its drawn text. */
async function selectStartingBlock(page: Page) {
  await clickBlock(page);
  await expect(fontSelect(page)).toBeVisible();
}

function height({ top, bottom }: Bounds) {
  return bottom - top;
}
