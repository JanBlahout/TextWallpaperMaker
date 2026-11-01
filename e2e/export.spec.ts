import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { pngSize } from "./support/png";

// A high-DPI screen: the export must still be the wallpaper's exact resolution.
test.use({ deviceScaleFactor: 2 });

test("Export Wallpaper downloads the starting wallpaper as an exactly 1920 × 1080 PNG", async ({ page }) => {
  await page.goto("/");

  const exportButton = page.getByRole("button", { name: /Export Wallpaper/ });
  await expect(exportButton).toContainText("1920 × 1080 PNG");

  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);

  expect(download.suggestedFilename()).toBe("wallpaper-1920x1080.png");
  const png = await readFile(await download.path());
  expect(pngSize(png)).toEqual({ width: 1920, height: 1080 });
});
