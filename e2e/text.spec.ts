import { expect, test, type Page } from "@playwright/test";
import {
  canvasPixelsPerCssPixel,
  centreOf,
  inspector,
  pageBounds,
  screenPointAt,
  textBounds,
  waitForTextBounds,
  wallpaperCanvas,
  wallpaperEdges,
  type Bounds,
} from "./support/blocks";

const STARTING_TEXT = "DISCIPLINE\nEQUALS\nFREEDOM.";
/** The starting block's line height, in wallpaper px: 1.1 × 96. */
const LINE_HEIGHT = 105.6;

// The text field is laid over the canvas in CSS px, through the same transform
// as the canvas; a high-DPI screen catches a conversion that forgets the ratio.
for (const deviceScaleFactor of [1, 2]) {
  test.describe(`at a device pixel ratio of ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });

    test("double-clicking a word opens a text field over the block, and what's typed shows on the canvas after Escape", async ({
      page,
    }) => {
      await page.goto("/");
      const canvas = wallpaperCanvas(page);
      const field = inPlaceField(page);
      const before = await waitForTextBounds(canvas);
      // Canvas px per wallpaper px, from the 1920 px wide wallpaper as drawn.
      const edges = await wallpaperEdges(canvas);
      const scale = (edges.right - edges.left) / 1920;
      const lineHeight = LINE_HEIGHT * scale;
      // Rows through the top half of the second line's capitals.
      const secondLine = { top: before.top + 1.1 * lineHeight, bottom: before.top + 1.5 * lineHeight };
      const equals = (await textBounds(canvas, secondLine))!;
      // The middle of the drawn text is in EQUALS, the middle line.
      const point = await screenPointAt(canvas, centreOf(before));

      await page.mouse.dblclick(point.x, point.y);

      await test.step("a text field opens over the block, in its font size, with the word selected", async () => {
        await expect(field).toBeFocused();
        await expect(field).toHaveValue(STARTING_TEXT);
        const selection = await field.evaluate((element: HTMLTextAreaElement) =>
          element.value.slice(element.selectionStart, element.selectionEnd),
        );
        expect(selection).toBe("EQUALS");

        const fieldBox = (await field.boundingBox())!;
        const drawn = await pageBounds(canvas, before);
        // The drawn D starts a few px inside the box, past the glyph's side bearing.
        expect(drawn.left - fieldBox.x).toBeGreaterThanOrEqual(-1);
        expect(drawn.left - fieldBox.x).toBeLessThan(6);
        expect(fieldBox.y).toBeLessThanOrEqual(drawn.top);
        expect(fieldBox.y + fieldBox.height).toBeGreaterThanOrEqual(drawn.bottom);

        // 96 wallpaper px, in CSS px.
        const fontSize = await field.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
        expect(fontSize).toBeCloseTo((96 * scale) / (await canvasPixelsPerCssPixel(canvas)), 0);
      });

      // EQUALS becomes two lines, RISE and UP.
      await page.keyboard.type("rise");
      await page.keyboard.press("Enter");
      await page.keyboard.type("up");
      await page.keyboard.press("Escape");

      await test.step("Escape finishes editing, and the canvas shows the new lines", async () => {
        await expect(field).toBeHidden();
        // One more line pushes FREEDOM. down by a line height; DISCIPLINE stays put.
        await expect
          .poll(async () => (await textBounds(canvas))!.bottom - before.bottom)
          .toBeGreaterThan(lineHeight - 2);
        const after = (await textBounds(canvas))!;
        expect(after.bottom - before.bottom).toBeLessThan(lineHeight + 2);
        expect(after).toMatchObject({ top: before.top, right: before.right });
        // The second line, RISE, starts where EQUALS did (give or take a pixel
        // of side bearing) and is two characters shorter.
        const rise = (await textBounds(canvas, secondLine))!;
        expect(Math.abs(rise.left - equals.left)).toBeLessThanOrEqual(2);
        expect(equals.right - rise.right).toBeGreaterThan(100 * scale);
      });

      await test.step("the text is stored as typed; uppercase only changes how it looks", async () => {
        await expect(inspectorTextField(page)).toHaveValue("DISCIPLINE\nrise\nup\nFREEDOM.");
      });

      await test.step("one undo reverts the whole edit", async () => {
        await page.keyboard.press("ControlOrMeta+z");
        await expect(inspectorTextField(page)).toHaveValue(STARTING_TEXT);
        await expect.poll(() => textBounds(canvas)).toEqual(before);
      });
    });
  });
}

test("Add text puts a TEXT block in the middle of the wallpaper, ready to type over", async ({ page }) => {
  await page.goto("/");
  const canvas = wallpaperCanvas(page);
  const field = inPlaceField(page);
  await waitForTextBounds(canvas);
  const { height } = await canvas.evaluate((element: HTMLCanvasElement) => ({ height: element.height }));
  const ratio = await canvasPixelsPerCssPixel(canvas);
  // The wallpaper is centred on the canvas, and the starting block sits far below its middle.
  const middleRows = { top: height / 2 - 40 * ratio, bottom: height / 2 + 40 * ratio };
  expect(await textBounds(canvas, middleRows)).toBeNull();

  await page.getByRole("button", { name: "Add text" }).click();

  await test.step("the new block reads TEXT, centred on the wallpaper, open for typing", async () => {
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("TEXT");
    await expect.poll(() => textBounds(canvas, middleRows)).not.toBeNull();
    const added = (await textBounds(canvas, middleRows))!;
    const canvasCentre = await canvas.evaluate((element: HTMLCanvasElement) => element.width / 2);
    // Centred, to within the glyphs' side bearings.
    expect(Math.abs(centreOf(added).x - canvasCentre)).toBeLessThan(4 * ratio);
  });

  await test.step("typing replaces TEXT, and Escape finishes", async () => {
    await page.keyboard.type("hello");
    await page.keyboard.press("Escape");
    await expect(field).toBeHidden();
    await expect(inspectorTextField(page)).toHaveValue("hello");
  });
});

test("emptying a block's text in place deletes the block, and undo brings it back", async ({ page }) => {
  await page.goto("/");
  const canvas = wallpaperCanvas(page);
  const before = await waitForTextBounds(canvas);
  const point = await screenPointAt(canvas, centreOf(before));

  await page.mouse.dblclick(point.x, point.y);
  await expect(inPlaceField(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.mouse.click(5, 5);

  await expect(inPlaceField(page)).toBeHidden();
  await expect.poll(() => textBounds(canvas)).toBeNull();
  await expect(inspector(page).getByText("Select a text block")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => textBounds(canvas)).toEqual(before);
});

test("the inspector's text field shows changes on the canvas as they're typed, and a commit is one undo step", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = wallpaperCanvas(page);
  const before = await waitForTextBounds(canvas);
  const point = await screenPointAt(canvas, centreOf(before));
  await page.mouse.click(point.x, point.y);
  const textField = inspectorTextField(page);
  await expect(textField).toHaveValue(STARTING_TEXT);

  await textField.fill("GET UP.");
  await expect.poll(async () => heightOf((await textBounds(canvas))!)).toBeLessThan(heightOf(before) / 2);
  await textField.press("Enter");
  await textField.pressSequentially("DUST OFF.");
  await textField.blur();

  await expect(textField).toHaveValue("GET UP.\nDUST OFF.");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(textField).toHaveValue(STARTING_TEXT);
  await expect.poll(() => textBounds(canvas)).toEqual(before);
});

/** The text field laid over the canvas while a block's text is edited in place. */
function inPlaceField(page: Page) {
  return page.getByRole("textbox", { name: "Edit text in place" });
}

function inspectorTextField(page: Page) {
  return inspector(page).getByRole("textbox", { name: "Text", exact: true });
}

function heightOf({ top, bottom }: Bounds) {
  return bottom - top;
}
