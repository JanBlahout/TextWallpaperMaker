import { expect, test, type Page } from "@playwright/test";
import { clickBlock, inspector, textBounds, waitForTextBounds, wallpaperCanvas } from "./support/blocks";

test("Cmd/Ctrl+D duplicates the selected block without bookmarking the page, and Delete or Backspace deletes", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = wallpaperCanvas(page);
  const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
  const y = inspector(page).getByRole("spinbutton", { name: "Y", exact: true });
  const hint = inspector(page).getByText("Select a text block");
  const original = await waitForTextBounds(canvas);
  await clickBlock(page);
  await expect(x).toHaveValue("54");

  await test.step("Cmd/Ctrl+D selects a copy 2% of 1080 px right and down, and cancels the bookmark shortcut", async () => {
    expect(await pressAndCheckCancelled(page, "ControlOrMeta+d")).toBe(true);
    await expect(x).toHaveValue("75.6");
    await expect(y).toHaveValue("730.8");
    // The copy is drawn over the original, so the text now reaches further right and down.
    await expect.poll(async () => (await textBounds(canvas))!.right).toBeGreaterThan(original.right);
  });

  await test.step("Delete deletes the copy", async () => {
    await page.keyboard.press("Delete");
    await expect(hint).toBeVisible();
    await expect.poll(() => textBounds(canvas)).toEqual(original);
  });

  await test.step("Backspace deletes the original, and one undo brings it back", async () => {
    await clickBlock(page);
    await page.keyboard.press("Backspace");
    await expect(hint).toBeVisible();
    await expect.poll(() => textBounds(canvas)).toBeNull();
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => textBounds(canvas)).toEqual(original);
  });
});

test("in an inspector field, Backspace and Delete edit the field, and Cmd/Ctrl+D neither duplicates nor bookmarks", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = wallpaperCanvas(page);
  const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
  const original = await waitForTextBounds(canvas);
  await clickBlock(page);

  await x.focus();
  expect(await pressAndCheckCancelled(page, "ControlOrMeta+d")).toBe(true);
  await expect(x).toHaveValue("54");

  await x.selectText();
  await x.press("Backspace");
  await expect(x).toHaveValue("");
  await x.fill("54");
  await x.selectText();
  await x.press("Delete");
  await expect(x).toHaveValue("");

  await x.press("Escape");
  await expect(x).toHaveValue("54");
  expect(await textBounds(canvas)).toEqual(original);
});

test("the inspector's Duplicate and Delete buttons duplicate and delete the selected block, and need a selection", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = wallpaperCanvas(page);
  const x = inspector(page).getByRole("spinbutton", { name: "X", exact: true });
  const duplicate = inspector(page).getByRole("button", { name: "Duplicate" });
  const remove = inspector(page).getByRole("button", { name: "Delete" });
  const original = await waitForTextBounds(canvas);
  await expect(duplicate).toBeDisabled();
  await expect(remove).toBeDisabled();
  await clickBlock(page);

  await duplicate.click();
  await expect(x).toHaveValue("75.6");

  await remove.click();
  await expect(inspector(page).getByText("Select a text block")).toBeVisible();
  await expect.poll(() => textBounds(canvas)).toEqual(original);
  await expect(duplicate).toBeDisabled();
});

/**
 * Presses `keys` and tells whether the page cancelled the last keydown's
 * default action, such as the browser's bookmark shortcut. The listener is
 * added after the editor's, so it sees what the editor did.
 */
async function pressAndCheckCancelled(page: Page, keys: string) {
  await page.evaluate(() => {
    window.addEventListener("keydown", (event) => {
      document.body.dataset.lastKeyCancelled = String(event.defaultPrevented);
    });
  });
  await page.keyboard.press(keys);
  return (await page.evaluate(() => document.body.dataset.lastKeyCancelled)) === "true";
}
