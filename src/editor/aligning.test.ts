import { describe, expect, it } from "vitest";
import { createEditor, type AlignPosition, type Editor, type Point, type Resolution } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/** Inside the starting block's box, from (54, 709.2) to (630, 1026) with the fake measurer. */
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };

/** Where the block is moved before aligning: off every alignment, so each one moves it. */
const OFF_ALIGNMENT = { x: 300, y: 300 };

/** The starting block selected, on a wallpaper of `resolution`, and moved off every alignment. */
function editorWithBlockSelected(resolution: Resolution = { width: 1920, height: 1080 }) {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  editor.selectAt(INSIDE_STARTING_BLOCK);
  editor.setResolution(resolution);
  editor.setPosition(OFF_ALIGNMENT);
  return editor;
}

function blockPosition(editor: Editor) {
  const [{ x, y }] = editor.getWallpaper().blocks;
  return { x, y };
}

/** Positions come from sums of fractional lengths, so they're compared to within floating-point error. */
function expectPosition(editor: Editor, expected: Point) {
  const { x, y } = blockPosition(editor);
  expect(x).toBeCloseTo(expected.x, 9);
  expect(y).toBeCloseTo(expected.y, 9);
}

type Expected = Record<AlignPosition, Point>;

/**
 * Where each action puts the starting block, worked out by hand. Centring is
 * the same against both targets, since the safe area is inset equally on every side.
 */
describe.each<{ name: string; resolution: Resolution; safeArea: Expected; wallpaper: Expected }>([
  {
    // The box is 576 × 316.8. The safe area is 54 px in from every edge: (54, 54) to (1866, 1026).
    name: "a 1920 × 1080 desktop wallpaper",
    resolution: { width: 1920, height: 1080 },
    safeArea: {
      left: { x: 54, y: 300 },
      centre: { x: 672, y: 300 },
      right: { x: 1290, y: 300 },
      top: { x: 300, y: 54 },
      middle: { x: 300, y: 381.6 },
      bottom: { x: 300, y: 709.2 },
    },
    wallpaper: {
      left: { x: 0, y: 300 },
      centre: { x: 672, y: 300 },
      right: { x: 1344, y: 300 },
      top: { x: 300, y: 0 },
      middle: { x: 300, y: 381.6 },
      bottom: { x: 300, y: 763.2 },
    },
  },
  {
    // Re-fitting scales the font by 1179 ÷ 1920 to 58.95 px, so the box is 353.7 × 194.535.
    // The safe area is 58.95 px in from every edge: (58.95, 58.95) to (1120.05, 2497.05).
    name: "a 1179 × 2556 phone wallpaper",
    resolution: { width: 1179, height: 2556 },
    safeArea: {
      left: { x: 58.95, y: 300 },
      centre: { x: 412.65, y: 300 },
      right: { x: 766.35, y: 300 },
      top: { x: 300, y: 58.95 },
      middle: { x: 300, y: 1180.7325 },
      bottom: { x: 300, y: 2302.515 },
    },
    wallpaper: {
      left: { x: 0, y: 300 },
      centre: { x: 412.65, y: 300 },
      right: { x: 825.3, y: 300 },
      top: { x: 300, y: 0 },
      middle: { x: 300, y: 1180.7325 },
      bottom: { x: 300, y: 2361.465 },
    },
  },
])("quick align on $name", ({ resolution, safeArea, wallpaper }) => {
  const positions = Object.keys(safeArea) as AlignPosition[];

  it.each(positions)("aligns the selected block %s against the safe area by default", (position) => {
    const editor = editorWithBlockSelected(resolution);

    editor.align(position);

    expectPosition(editor, safeArea[position]);
  });

  it.each(positions)("aligns the selected block %s against the whole wallpaper when that's the align target", (position) => {
    const editor = editorWithBlockSelected(resolution);
    editor.setSettings({ alignTarget: "wallpaper" });

    editor.align(position);

    expectPosition(editor, wallpaper[position]);
  });
});

describe("quick align and undo", () => {
  it("makes each align action one undo step", () => {
    const editor = editorWithBlockSelected();

    editor.align("right");
    editor.align("top");
    expectPosition(editor, { x: 1290, y: 54 });

    editor.undo();
    expectPosition(editor, { x: 1290, y: 300 });
    editor.undo();
    expect(blockPosition(editor)).toEqual(OFF_ALIGNMENT);
    editor.redo();
    editor.redo();
    expectPosition(editor, { x: 1290, y: 54 });
  });

  it("ends a run of nudges, so the nudges and the alignment are one step each", () => {
    const editor = editorWithBlockSelected();
    editor.nudge("down");
    editor.nudge("down");

    editor.align("left");
    editor.nudge("right");

    expect(blockPosition(editor)).toEqual({ x: 55, y: 302 });
    editor.undo();
    expect(blockPosition(editor)).toEqual({ x: 54, y: 302 });
    editor.undo();
    expect(blockPosition(editor)).toEqual({ x: 300, y: 302 });
    editor.undo();
    expect(blockPosition(editor)).toEqual(OFF_ALIGNMENT);
  });

  it("records no undo step when the block is already aligned", () => {
    const editor = editorWithBlockSelected();
    editor.align("left");

    editor.align("left");
    editor.undo();

    expect(blockPosition(editor)).toEqual(OFF_ALIGNMENT);
  });

  it("does nothing when nothing is selected", () => {
    const editor = editorWithBlockSelected();
    editor.deselect();

    editor.align("left");
    editor.undo();

    expect(blockPosition(editor)).toEqual({ x: 54, y: 709.2 });
    expect(editor.getView().canUndo).toBe(false);
  });
});

describe("the align target", () => {
  it("is the safe area by default", () => {
    expect(createEditor({ measurer: fakeTextMeasurer }).getSettings().alignTarget).toBe("safe-area");
  });

  it("is the safe area at the current safe margin", () => {
    const editor = editorWithBlockSelected();
    editor.setSettings({ safeMargin: 10 });

    editor.align("left");
    editor.align("bottom");

    // 10% of 1080 is 108; the box is 316.8 tall.
    expectPosition(editor, { x: 108, y: 655.2 });
  });

  it("changing it is never an undo step", () => {
    const editor = editorWithBlockSelected();
    editor.setSettings({ alignTarget: "wallpaper" });

    editor.undo();

    expect(editor.getSettings().alignTarget).toBe("wallpaper");
  });
});
