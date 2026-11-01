import { expect, test, type Page } from "@playwright/test";
import { expectCanvasBackground, type Rgb } from "./support/canvas";

const NAVY: Rgb = [0x1e, 0x3a, 0x5f];

test("a changed background colour and guide setting are still there after a reload", async ({ page }) => {
  await page.goto("/");
  const hexField = backgroundHexField(page);
  const showGrid = page.getByRole("checkbox", { name: "Show grid" });
  await expect(hexField).toHaveValue("#000000");
  await expect(showGrid).toBeChecked();

  await hexField.fill("#1e3a5f");
  await hexField.press("Enter");
  await showGrid.uncheck();
  await expect(hexField).toHaveValue("#1E3A5F");

  await page.reload();

  await expect(hexField).toHaveValue("#1E3A5F");
  await expectCanvasBackground(page, NAVY);
  await expect(showGrid).not.toBeChecked();
});

test("a change is saved shortly after it's made, so a new tab opens on it while the first stays open", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const hexField = backgroundHexField(page);
  await expect(hexField).toHaveValue("#000000");
  await hexField.fill("#1e3a5f");
  await hexField.press("Enter");
  await expect(hexField).toHaveValue("#1E3A5F");

  const newTab = await context.newPage();
  await expect(async () => {
    await newTab.goto("/");
    await expect(backgroundHexField(newTab)).toHaveValue("#1E3A5F", { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
});

function backgroundHexField(page: Page) {
  return page.getByRole("textbox", { name: "Background colour hex" });
}
