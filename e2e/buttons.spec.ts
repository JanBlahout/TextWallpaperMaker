import { expect, test } from "@playwright/test";
import { clickBlock, inspector } from "./support/blocks";

test("every button that can be clicked shows the hand cursor, and a disabled one doesn't", async ({ page }) => {
  await page.goto("/");
  // Select the starting block, so the Inspector's buttons are shown and enabled too.
  await clickBlock(page);
  await expect(inspector(page).getByRole("spinbutton", { name: "X", exact: true })).toBeVisible();

  const cursors = await page.locator("button:visible").evaluateAll((buttons) =>
    buttons.map((button) => ({
      name: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
      disabled: (button as HTMLButtonElement).disabled,
      cursor: getComputedStyle(button).cursor,
    })),
  );

  const enabled = cursors.filter((button) => !button.disabled);
  expect(enabled.length).toBeGreaterThan(10);
  expect(enabled.filter((button) => button.cursor !== "pointer")).toEqual([]);
  for (const button of cursors.filter((button) => button.disabled)) {
    expect(button.cursor, button.name).not.toBe("pointer");
  }
});
