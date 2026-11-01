import { describe, expect, it } from "vitest";
import { createEditor, DEFAULT_TYPOGRAPHY, refit, type Point, type Resolution, type Wallpaper } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

/**
 * A 2000 × 1000 wallpaper with "ABCDE" blocks at 100 px and line height 1. With
 * the fake measurer each box is 300 × 100 px. At a 5% safe margin the safe area
 * runs from 50 to 1950 across (centre 1000) and from 50 to 950 down (centre 500).
 */
function wallpaperWithBlocksAt(...positions: Point[]): Wallpaper {
  return {
    resolution: { width: 2000, height: 1000 },
    background: "#000000",
    blocks: positions.map(({ x, y }, i) => ({
      ...DEFAULT_TYPOGRAPHY,
      id: `block-${i + 1}`,
      text: "ABCDE",
      fontSize: 100,
      lineHeight: 1,
      x,
      y,
    })),
  };
}

function refitTo(wallpaper: Wallpaper, resolution: Resolution) {
  return refit(wallpaper, resolution, { safeMargin: 5, measurer: fakeTextMeasurer });
}

describe("re-fitting a wallpaper to a new resolution", () => {
  it.each`
    width   | height  | factor | fontSize
    ${1000} | ${1000} | ${0.5} | ${50}
    ${4000} | ${1500} | ${1.5} | ${150}
    ${2000} | ${500}  | ${0.5} | ${50}
    ${3000} | ${3000} | ${1.5} | ${150}
  `(
    "2000 × 1000 → $width × $height scales every block's font size by the smaller ratio, $factor, to $fontSize px",
    ({ width, height, fontSize }) => {
      const wallpaper = wallpaperWithBlocksAt({ x: 150, y: 70 }, { x: 1600, y: 800 });

      const refitted = refitTo(wallpaper, { width, height });

      expect(refitted.resolution).toEqual({ width, height });
      expect(refitted.blocks.map((block) => block.fontSize)).toEqual([fontSize, fontSize]);
    },
  );

  // 2000 × 1000 → 1000 × 1000: the factor is 0.5, every box becomes 150 × 50 px,
  // and the new safe area runs from 50 to 950 on both axes (centre 500).
  describe("keeps each block's anchor across, at the anchor distance × 0.5", () => {
    it.each`
      anchor      | x       | why                                               | newX   | newEdge
      ${"start"}  | ${150}  | ${"its left edge is 100 px right of the safe area's"} | ${100} | ${"left edge 50 px right of the new safe area's"}
      ${"centre"} | ${900}  | ${"its centre is 50 px right of the safe area's"}     | ${450} | ${"centre 25 px right of the new safe area's (525)"}
      ${"end"}    | ${1600} | ${"its right edge is 50 px left of the safe area's"}  | ${775} | ${"right edge 25 px left of the new safe area's (925)"}
    `("$anchor: a block at x $x ($why) moves to x $newX, its $newEdge", ({ x, newX }) => {
      const [block] = refitTo(wallpaperWithBlocksAt({ x, y: 70 }), { width: 1000, height: 1000 }).blocks;

      expect(block.x).toBeCloseTo(newX, 9);
    });
  });

  describe("keeps each block's anchor down, at the anchor distance × 0.5", () => {
    it.each`
      anchor      | y      | why                                               | newY   | newEdge
      ${"start"}  | ${70}  | ${"its top edge is 20 px below the safe area's"}      | ${60}  | ${"top edge 10 px below the new safe area's"}
      ${"centre"} | ${400} | ${"its centre is 50 px above the safe area's"}        | ${450} | ${"centre 25 px above the new safe area's (475)"}
      ${"end"}    | ${800} | ${"its bottom edge is 50 px above the safe area's"}   | ${875} | ${"bottom edge 25 px above the new safe area's (925)"}
    `("$anchor: a block at y $y ($why) moves to y $newY, its $newEdge", ({ y, newY }) => {
      const [block] = refitTo(wallpaperWithBlocksAt({ x: 150, y }), { width: 1000, height: 1000 }).blocks;

      expect(block.y).toBeCloseTo(newY, 9);
    });
  });

  it("leaves the wallpaper exactly as it is when the resolution is the same, whatever the anchors", () => {
    const wallpaper = wallpaperWithBlocksAt({ x: 150.3, y: 70.7 }, { x: 900.1, y: 400.3 }, { x: 1600.7, y: 800.1 });

    expect(refitTo(wallpaper, { width: 2000, height: 1000 })).toEqual(wallpaper);
  });

  it("anchors each block on its own: one block per anchor across and down, all re-fitted together", () => {
    const wallpaper = wallpaperWithBlocksAt({ x: 150, y: 800 }, { x: 900, y: 400 }, { x: 1600, y: 70 });

    const blocks = refitTo(wallpaper, { width: 1000, height: 1000 }).blocks;

    expect(blocks.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 100, y: 875 },
      { x: 450, y: 450 },
      { x: 775, y: 60 },
    ]);
  });
});

describe("changing the resolution", () => {
  it("re-fits the starting wallpaper from 1920 × 1080 to 1179 × 2556: the block stays on the bottom-left safe-area edges and its font goes from 96 to 58.95 px", () => {
    const editor = newEditor();

    editor.setResolution({ width: 1179, height: 2556 });

    // Worked by hand: the factor is min(1179 / 1920, 2556 / 1080) = 0.6140625,
    // so the font is 96 × 0.6140625 = 58.95 px. The new safe margin is 5% of
    // 1179 = 58.95 px. The box is 3 × 1.1 × 58.95 = 194.535 px tall, so its top
    // sits at 2556 − 58.95 − 194.535 = 2302.515.
    const wallpaper = editor.getWallpaper();
    expect(wallpaper.resolution).toEqual({ width: 1179, height: 2556 });
    expect(wallpaper.blocks[0].fontSize).toBeCloseTo(58.95, 9);

    const [{ box }] = editor.getView().blocks;
    const { safeArea } = editor.getView();
    expect(box.x).toBeCloseTo(58.95, 9);
    expect(box.x).toBeCloseTo(safeArea.x, 9);
    expect(box.y).toBeCloseTo(2302.515, 9);
    expect(box.y + box.height).toBeCloseTo(safeArea.y + safeArea.height, 9);
  });

  it.each`
    requested                           | kept
    ${{ width: 100, height: 1080 }}     | ${{ width: 320, height: 1080 }}
    ${{ width: 1920, height: 9000 }}    | ${{ width: 1920, height: 8192 }}
    ${{ width: 8193, height: 319 }}     | ${{ width: 8192, height: 320 }}
    ${{ width: -5, height: 0 }}         | ${{ width: 320, height: 320 }}
    ${{ width: 1179.4, height: 2555.6 }} | ${{ width: 1179, height: 2556 }}
  `("keeps each side whole and within 320–8192 px: asking for $requested gives $kept", ({ requested, kept }) => {
    const editor = newEditor();

    editor.setResolution(requested);

    expect(editor.getWallpaper().resolution).toEqual(kept);
  });

  it("re-fits to the clamped resolution: 100 × 1080 becomes 320 × 1080, so the font scales by 320 ÷ 1920 to 16 px", () => {
    const editor = newEditor();

    editor.setResolution({ width: 100, height: 1080 });

    expect(editor.getWallpaper().blocks[0].fontSize).toBeCloseTo(16, 9);
  });

  it.each([
    { width: Number.NaN, height: 1080 },
    { width: 1920, height: Number.NaN },
  ])("ignores a size that isn't a number, $width × $height, without recording a step", (requested) => {
    const editor = newEditor();
    const before = editor.getWallpaper();

    editor.setResolution(requested);

    expect(editor.getWallpaper()).toBe(before);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("is one undo step each time: undo restores the previous resolution and layout exactly, even after a lossy round trip", () => {
    const editor = newEditor();
    const starting = editor.getWallpaper();
    editor.setResolution({ width: 1179, height: 2556 });
    const phone = editor.getWallpaper();

    // Back to 1920 × 1080 scales by min(1920 / 1179, 1080 / 2556) ≈ 0.42, not
    // 1 / 0.614, so the font doesn't return to 96 px (ADR 0001).
    editor.setResolution({ width: 1920, height: 1080 });
    expect(editor.getWallpaper().blocks[0].fontSize).not.toBeCloseTo(96, 0);

    editor.undo();
    expect(editor.getWallpaper()).toEqual(phone);
    editor.undo();
    expect(editor.getWallpaper()).toEqual(starting);
    expect(editor.getView().canUndo).toBe(false);

    editor.redo();
    expect(editor.getWallpaper()).toEqual(phone);
  });

  it("fits the view to the screen after a resolution change, and after undoing or redoing one", () => {
    const editor = newEditor();
    editor.setSettings({ zoom: 2, pan: { x: 300, y: 200 } });

    editor.setResolution({ width: 1179, height: 2556 });
    expect(editor.getSettings().zoom).toBe("fit");

    editor.setSettings({ zoom: 0.5 });
    editor.undo();
    expect(editor.getSettings().zoom).toBe("fit");

    editor.setSettings({ zoom: 3 });
    editor.redo();
    expect(editor.getSettings().zoom).toBe("fit");
  });

  it("leaves the zoom alone for wallpaper changes that keep the resolution", () => {
    const editor = newEditor();
    editor.setSettings({ zoom: 2 });

    editor.setResolution({ width: 1920, height: 1080 });
    editor.setBackground("#1E3A5F");
    editor.undo();
    editor.redo();

    expect(editor.getSettings().zoom).toBe(2);
  });

  it("records no step when the resolution asked for is the current one", () => {
    const editor = newEditor();
    const before = editor.getWallpaper();

    editor.setResolution({ width: 1920, height: 1080 });
    editor.setResolution({ width: 1920.2, height: 1079.8 });

    expect(editor.getWallpaper()).toEqual(before);
    expect(editor.getView().canUndo).toBe(false);
  });
});
