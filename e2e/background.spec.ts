import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { BLACK, expectCanvasBackground, NAVY, type Rgb } from "./support/canvas";

test("a background colour typed in the hex field shows on the canvas and in the export, and undo and redo work", async ({
  page,
}) => {
  await page.goto("/");
  const hexField = page.getByRole("textbox", { name: "Background colour hex" });
  await expect(hexField).toHaveValue("#000000");

  await test.step("invalid hex is rejected without changing the wallpaper", async () => {
    await hexField.fill("navy");
    await hexField.press("Enter");
    await expect(hexField).toHaveValue("#000000");
  });

  await test.step("a valid hex colour applies to the canvas on Enter", async () => {
    await hexField.fill("#1e3a5f");
    await hexField.press("Enter");
    await expect(hexField).toHaveValue("#1E3A5F");
    await expectCanvasBackground(page, NAVY);
  });

  await test.step("Cmd/Ctrl+Z straight after Enter undoes it, and Cmd/Ctrl+Shift+Z redoes it", async () => {
    // Enter leaves the field, so the shortcut reaches the editor rather than undoing typing.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(hexField).toHaveValue("#000000");
    await expectCanvasBackground(page, BLACK);

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(hexField).toHaveValue("#1E3A5F");
    await expectCanvasBackground(page, NAVY);
  });

  await test.step("the export has the background colour", async () => {
    expect(await exportedPixel(page, { x: 0, y: 0 })).toEqual(NAVY);
  });
});

test("moving around inside the colour picker previews each colour, and each release is one undo step", async ({
  page,
}) => {
  await page.goto("/");
  const picker = page.getByLabel("Background colour", { exact: true });
  const hexField = page.getByRole("textbox", { name: "Background colour hex" });
  await expect(hexField).toHaveValue("#000000");

  await dragThroughColors(picker, ["#101010", "#202020", "#1e3a5f"]);
  await expect(hexField).toHaveValue("#1E3A5F");
  await expectCanvasBackground(page, NAVY);
  await releasePicker(picker);

  await dragThroughColors(picker, ["#5a2a2a", "#7a1f1f"]);
  await releasePicker(picker);
  await expect(hexField).toHaveValue("#7A1F1F");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(hexField).toHaveValue("#1E3A5F");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(hexField).toHaveValue("#000000");
  await expectCanvasBackground(page, BLACK);
});

/**
 * Fires an `input` event per colour, as the browser does while the user moves
 * around inside the picker. Uses the native value setter, as the browser would,
 * so React sees each change.
 */
async function dragThroughColors(picker: Locator, colors: string[]) {
  await picker.evaluate((input: HTMLInputElement, colors) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    for (const color of colors) {
      setValue.call(input, color);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, colors);
}

/** Fires the `change` event the browser sends when the picker is released or closed. */
async function releasePicker(picker: Locator) {
  await picker.evaluate((input: HTMLInputElement) => input.dispatchEvent(new Event("change", { bubbles: true })));
}

/** Exports the wallpaper and reads one pixel of the downloaded PNG. */
async function exportedPixel(page: Page, { x, y }: { x: number; y: number }): Promise<Rgb> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export Wallpaper/ }).click(),
  ]);
  const pngBase64 = (await readFile(await download.path())).toString("base64");
  return page.evaluate(
    async ({ pngBase64, x, y }) => {
      const bytes = Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return [r, g, b] as Rgb;
    },
    { pngBase64, x, y },
  );
}
