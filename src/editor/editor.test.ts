import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

describe("the starting wallpaper", () => {
  it("is a black 1920 × 1080 wallpaper with one DISCIPLINE / EQUALS / FREEDOM. block in OCR A", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });
    const wallpaper = editor.getWallpaper();

    expect(wallpaper.resolution).toEqual({ width: 1920, height: 1080 });
    expect(wallpaper.background).toBe("#000000");
    expect(wallpaper.blocks).toHaveLength(1);
    expect(wallpaper.blocks[0]).toMatchObject({
      text: "DISCIPLINE\nEQUALS\nFREEDOM.",
      fontId: "ocr-a",
      fontSize: 96,
      lineHeight: 1.1,
      letterSpacing: 0,
      align: "left",
      uppercase: true,
      color: "#F2F2F2",
      opacity: 100,
    });
  });

  it("sits its block's box on the left and bottom safe-area edges, 54 px in from the wallpaper's edges", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    // Worked example with the fake measurer: the widest line, DISCIPLINE, is
    // 10 × 0.6 × 96 = 576 px; three lines are 3 × 1.1 × 96 = 316.8 px tall.
    // The safe margin is 5% of the shorter side (1080) = 54 px, so the box's
    // bottom is at 1080 − 54 = 1026 and its top at 1026 − 316.8 = 709.2.
    const [{ box }] = editor.getView().blocks;
    expect(box.x).toBe(54);
    expect(box.y).toBeCloseTo(709.2, 9);
    expect(box.width).toBeCloseTo(576, 9);
    expect(box.height).toBeCloseTo(316.8, 9);

    const [block] = editor.getWallpaper().blocks;
    expect(block.x).toBe(54);
    expect(block.y).toBeCloseTo(709.2, 9);
  });

  it("opens with a 5% safe margin, 12 visible grid columns, safe-area guides, snapping on, aligning to the safe area, fitted to the screen", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    expect(editor.getSettings()).toEqual({
      safeMargin: 5,
      gridColumns: 12,
      gridVisible: true,
      safeAreaVisible: true,
      snapping: true,
      alignTarget: "safe-area",
      zoom: "fit",
      pan: { x: 0, y: 0 },
    });
  });
});
