import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { pngSize } from "./support/png";

// A high-DPI screen: the export must still be the wallpaper's exact resolution.
test.use({ deviceScaleFactor: 2 });

test("choosing the 1179 × 2556 phone preset exports a PNG of exactly 1179 × 2556", async ({ page }) => {
  await page.goto("/");
  const exportButton = page.getByRole("button", { name: /Export Wallpaper/ });
  await expect(exportButton).toContainText("1920 × 1080 PNG");

  await choosePreset(page, "Mobile", "1179 × 2556");
  await expect(exportButton).toContainText("1179 × 2556 PNG");

  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  expect(download.suggestedFilename()).toBe("wallpaper-1179x2556.png");
  expect(pngSize(await readFile(await download.path()))).toEqual({ width: 1179, height: 2556 });
});

test("a custom size applies only on Enter or leaving the field, notes clamping, and undoes in one step", async ({
  page,
}) => {
  await page.goto("/");
  const exportButton = page.getByRole("button", { name: /Export Wallpaper/ });
  const width = page.getByRole("spinbutton", { name: "Width" });
  const height = page.getByRole("spinbutton", { name: "Height" });
  await expect(width).toHaveValue("1920");

  await test.step("typing doesn't apply the size; Enter does", async () => {
    await width.fill("2400");
    await expect(exportButton).toContainText("1920 × 1080 PNG");
    await width.press("Enter");
    await expect(exportButton).toContainText("2400 × 1080 PNG");
  });

  await test.step("leaving the field applies the size too", async () => {
    await height.fill("1350");
    await expect(exportButton).toContainText("2400 × 1080 PNG");
    await height.blur();
    await expect(exportButton).toContainText("2400 × 1350 PNG");
  });

  await test.step("a size beyond 8192 px is clamped, with a note", async () => {
    await width.fill("9000");
    await width.press("Enter");
    await expect(exportButton).toContainText("8192 × 1350 PNG");
    await expect(width).toHaveValue("8192");
    await expect(page.getByRole("status")).toContainText("Width set to 8192 px");
  });

  await test.step("Cmd/Ctrl+Z undoes one resolution change at a time", async () => {
    await page.keyboard.press("ControlOrMeta+z");
    await expect(exportButton).toContainText("2400 × 1350 PNG");
    await expect(page.getByRole("status")).toBeEmpty();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(exportButton).toContainText("2400 × 1080 PNG");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(exportButton).toContainText("1920 × 1080 PNG");
  });
});

async function choosePreset(page: Page, group: "Desktop" | "Mobile", size: string) {
  await page.getByLabel(/^Resolution presets/).click();
  await page.getByRole("group", { name: group }).getByRole("button", { name: new RegExp(`^${size}`) }).click();
}
