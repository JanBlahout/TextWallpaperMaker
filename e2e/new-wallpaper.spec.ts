import { expect, test } from "@playwright/test";
import { expectCanvasBackground, type Rgb } from "./support/canvas";

const BLACK: Rgb = [0, 0, 0];
const NAVY: Rgb = [0x1e, 0x3a, 0x5f];

test("New wallpaper resets to the starting wallpaper without asking, and undo brings the previous one back", async ({
  page,
}) => {
  await page.goto("/");
  const hexField = page.getByRole("textbox", { name: "Background colour hex" });
  await hexField.fill("#1e3a5f");
  await hexField.press("Enter");
  await expect(hexField).toHaveValue("#1E3A5F");

  // Playwright dismisses any confirmation dialog, which would leave the wallpaper as it was.
  await page.getByRole("button", { name: "New wallpaper" }).click();
  await expect(hexField).toHaveValue("#000000");
  await expectCanvasBackground(page, BLACK);

  await page.keyboard.press("ControlOrMeta+z");
  await expect(hexField).toHaveValue("#1E3A5F");
  await expectCanvasBackground(page, NAVY);
});
