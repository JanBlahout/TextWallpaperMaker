import { expect, test, type Page } from "@playwright/test";

const WALLPAPER_CANVAS = 'canvas[aria-label="Wallpaper canvas"]';

const ALIGN_BUTTONS = [
  "Align left",
  "Centre horizontally",
  "Align right",
  "Align top",
  "Centre vertically",
  "Align bottom",
];

test("the align buttons line the selected block up with the safe area or the whole wallpaper, one undo step each", async ({
  page,
}) => {
  await page.goto("/");
  const panel = inspector(page);
  const button = (name: string) => panel.getByRole("button", { name, exact: true });
  const value = (name: string) => async () =>
    Number(await panel.getByRole("spinbutton", { name, exact: true }).inputValue());
  const [x, y, width, height] = ["X", "Y", "Width", "Height"].map(value);
  const right = async () => (await x()) + (await width());
  const bottom = async () => (await y()) + (await height());

  await test.step("the buttons are disabled until a block is selected, and the target is the safe area", async () => {
    for (const name of ALIGN_BUTTONS) await expect(button(name)).toBeDisabled();
    await expect(panel.getByRole("radio", { name: "Safe area" })).toBeChecked();

    await selectStartingBlock(page);

    for (const name of ALIGN_BUTTONS) await expect(button(name)).toBeEnabled();
  });

  await test.step("against the safe area, which is 54 px in from every edge of 1920 × 1080", async () => {
    await button("Align right").click();
    await expect.poll(right).toBeCloseTo(1866, 1);
    await button("Align top").click();
    await expect.poll(y).toBe(54);
  });

  await test.step("against the whole wallpaper once the switch says so", async () => {
    await panel.getByText("Wallpaper", { exact: true }).click();
    await expect(panel.getByRole("radio", { name: "Wallpaper" })).toBeChecked();

    await button("Align left").click();
    await expect.poll(x).toBe(0);
    await button("Align bottom").click();
    await expect.poll(bottom).toBeCloseTo(1080, 1);
  });

  await test.step("one undo reverts one alignment", async () => {
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(y).toBe(54);
    expect(await x()).toBe(0);
  });

  await test.step("the target is saved with the editor settings", async () => {
    await page.reload();
    await expect(panel.getByRole("radio", { name: "Wallpaper" })).toBeChecked();
  });
});

/** The right sidebar, where the align buttons are. */
function inspector(page: Page) {
  return page.getByRole("complementary", { name: "Inspector" });
}

/** Clicks the middle of the starting block's drawn text: its light pixels on the black background. */
async function selectStartingBlock(page: Page) {
  const canvas = page.locator(WALLPAPER_CANVAS);
  const centre = () =>
    canvas.evaluate((element: HTMLCanvasElement) => {
      const { width, height } = element;
      if (width === 0 || height === 0) return null;
      const { data } = element.getContext("2d")!.getImageData(0, 0, width, height);
      let [left, top, right, bottom] = [width, height, -1, -1];
      for (let i = 0; i < width * height; i++) {
        if (data[i * 4] < 128) continue;
        const [px, py] = [i % width, Math.floor(i / width)];
        [left, top, right, bottom] = [Math.min(left, px), Math.min(top, py), Math.max(right, px), Math.max(bottom, py)];
      }
      if (right < 0) return null;
      // Canvas px to CSS px from the canvas's top-left.
      const ratio = width / element.getBoundingClientRect().width;
      return { x: (left + right) / 2 / ratio, y: (top + bottom) / 2 / ratio };
    });
  await expect.poll(centre).not.toBeNull();
  const point = (await centre())!;
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + point.x, box.y + point.y);
}
