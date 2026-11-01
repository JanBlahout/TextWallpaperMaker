import { describe, expect, it } from "vitest";
import { viewportOf } from "@/editor";
import { handleAt } from "./handles";

const FULL_HD = { width: 1920, height: 1080 };
/** A canvas where a fitted 1920 × 1080 wallpaper is exactly half size, 40 px in from the sides and 50 from the top. */
const CANVAS = { width: 1040, height: 640 };
const FITTED = viewportOf(FULL_HD, { zoom: "fit", pan: { x: 0, y: 0 } }, CANVAS);
/** At 200%, with the wallpaper point (500, 300) at the canvas's centre (520, 320). */
const ZOOMED_AND_PANNED = viewportOf(FULL_HD, { zoom: 2, pan: { x: 500, y: 300 } }, CANVAS);

/** A 240 × 100 px box from (400, 250) to (640, 350), in wallpaper px. */
const BOX = { x: 400, y: 250, width: 240, height: 100 };

describe("which corner handle is under the pointer", () => {
  // Fitted, the box shows from (240, 175) to (360, 225) on screen.
  it.each`
    screen                 | corner
    ${{ x: 240, y: 175 }}  | ${"top-left"}
    ${{ x: 360, y: 175 }}  | ${"top-right"}
    ${{ x: 240, y: 225 }}  | ${"bottom-left"}
    ${{ x: 360, y: 225 }}  | ${"bottom-right"}
    ${{ x: 300, y: 200 }}  | ${null}
    ${{ x: 300, y: 175 }}  | ${null}
  `("finds the $corner handle at ($screen.x, $screen.y) on screen with the wallpaper fitted", ({ screen, corner }) => {
    expect(handleAt(FITTED, BOX, screen)).toBe(corner);
  });

  it("finds the handles where the box shows when zoomed in and panned", () => {
    // At 200% around (500, 300), the box shows from (320, 220) to (800, 420).
    expect(handleAt(ZOOMED_AND_PANNED, BOX, { x: 320, y: 220 })).toBe("top-left");
    expect(handleAt(ZOOMED_AND_PANNED, BOX, { x: 800, y: 420 })).toBe("bottom-right");
    // Where the corners would be fitted, there's no handle now.
    expect(handleAt(ZOOMED_AND_PANNED, BOX, { x: 240, y: 175 })).toBeNull();
    expect(handleAt(ZOOMED_AND_PANNED, BOX, { x: 360, y: 225 })).toBeNull();
  });

  it("reaches 6 screen px from its corner on each axis, inside or outside the box, at any zoom", () => {
    for (const [viewport, corner] of [
      [FITTED, { x: 360, y: 225 }],
      [ZOOMED_AND_PANNED, { x: 800, y: 420 }],
    ] as const) {
      expect(handleAt(viewport, BOX, { x: corner.x + 6, y: corner.y + 6 })).toBe("bottom-right");
      expect(handleAt(viewport, BOX, { x: corner.x - 6, y: corner.y - 6 })).toBe("bottom-right");
      expect(handleAt(viewport, BOX, { x: corner.x + 7, y: corner.y })).toBeNull();
      expect(handleAt(viewport, BOX, { x: corner.x, y: corner.y - 7 })).toBeNull();
    }
  });

  it("reaches at most a quarter of the way into a box that's small on screen, so its middle still moves it", () => {
    // 40 × 16 px, shown 20 × 8 px fitted: from (90, 100) to (110, 108) on screen.
    const small = { x: 100, y: 100, width: 40, height: 16 };

    expect(handleAt(FITTED, small, { x: 95, y: 102 })).toBe("top-left");
    expect(handleAt(FITTED, small, { x: 105, y: 106 })).toBe("bottom-right");
    expect(handleAt(FITTED, small, { x: 100, y: 104 })).toBeNull();
    expect(handleAt(FITTED, small, { x: 96, y: 103 })).toBeNull();
    // Outside the box, the handles still reach 6 px.
    expect(handleAt(FITTED, small, { x: 84, y: 94 })).toBe("top-left");
  });

  it("picks the closest corner outside a box small enough on screen for handles to overlap there", () => {
    // 16 × 8 px, shown 8 × 4 px fitted: from (90, 100) to (98, 104) on screen.
    const tiny = { x: 100, y: 100, width: 16, height: 8 };

    expect(handleAt(FITTED, tiny, { x: 100, y: 101 })).toBe("top-right");
    expect(handleAt(FITTED, tiny, { x: 100, y: 103.5 })).toBe("bottom-right");
  });
});
