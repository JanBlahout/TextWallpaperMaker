import { describe, expect, it } from "vitest";
import { createEditor, DEFAULT_SETTINGS, DEFAULT_TYPOGRAPHY, type Editor, type EditorSettings, type Point } from "./index";
import { serialise } from "./serialisation";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/**
 * Guide lines on a 1920 × 1080 wallpaper at the default 5% safe margin and 12
 * columns (see guides.test.ts): the safe area runs from 54 to 1866 across and
 * 54 to 1026 down, grid lines are 151 px apart across (54, 205, 356, 507, …)
 * and 162 px apart down (54, 216, 378, 540, …), and the centre lines run
 * through (960, 540).
 *
 * Blocks here are at 100 px with line height 1, so the fake measurer makes
 * each character 60 px wide and each line 100 px tall: "ABCD" is exactly
 * 240 × 100 px.
 */

interface BlockAt extends Point {
  /** "ABCD" (240 × 100 px) unless given. */
  text?: string;
}

/** An editor on a 1920 × 1080 wallpaper with blocks at the given top-left corners, the first one selected. */
function editorWith(positions: BlockAt[], settings: Partial<EditorSettings> = {}): Editor {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  const blocks = positions.map(({ text = "ABCD", ...position }, i) => ({
    id: `block-${i + 1}`,
    ...DEFAULT_TYPOGRAPHY,
    text,
    fontSize: 100,
    lineHeight: 1,
    ...position,
  }));
  editor.load(
    serialise({
      wallpaper: { resolution: { width: 1920, height: 1080 }, background: "#000000", blocks },
      settings: { ...DEFAULT_SETTINGS, ...settings },
    }),
  );
  const [first] = positions;
  editor.selectAt({ x: first.x + 1, y: first.y + 1 });
  return editor;
}

/** Starts dragging the selected block and moves the pointer by `offset`, leaving the drag open. */
function dragBy(editor: Editor, offset: Point, options?: Parameters<Editor["updateMove"]>[1]) {
  const { box } = editor.getView().selection!;
  const grab = { x: box.x + 10, y: box.y + 10 };
  editor.beginMove(grab);
  editor.updateMove({ x: grab.x + offset.x, y: grab.y + offset.y }, options);
}

/** The smart guides showing, vertical ones first, each left to right or top to bottom. */
function smartGuides(editor: Editor) {
  const order = { vertical: 0, horizontal: 1 };
  return editor
    .getView()
    .smartGuides.toSorted((a, b) => order[a.orientation] - order[b.orientation] || a.position - b.position);
}

/** The selected block's top-left corner. */
function selectedPosition(editor: Editor): Point {
  const { x, y } = editor.getView().selection!.box;
  return { x, y };
}

describe("snapping a dragged block to the grid", () => {
  it("snaps the block's left edge to a grid line within 6 px, and a smart guide shows it until the drop", () => {
    const editor = editorWith([{ x: 400, y: 250 }], { safeAreaVisible: false });

    // 400 − 197 = 203, 2 px left of the grid line at 205.
    dragBy(editor, { x: -197, y: 0 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 205, y: 250 });
    expect(editor.getView().smartGuides).toEqual([
      // The grid line runs down the safe area, and the block is inside it.
      { orientation: "vertical", position: 205, from: 54, to: 1026 },
    ]);

    editor.endMove();
    expect(selectedPosition(editor)).toEqual({ x: 205, y: 250 });
    expect(editor.getView().smartGuides).toEqual([]);
  });
});

describe("snapping a dragged block to the safe area and centre lines", () => {
  it("snaps the block's centre to the vertical centre line, with a smart guide down the whole wallpaper", () => {
    const editor = editorWith([{ x: 400, y: 250 }], { gridVisible: false });

    // The centre moves from 520 to 957, 3 px left of the centre line at 960.
    dragBy(editor, { x: 437, y: 0 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 840, y: 250 });
    expect(editor.getView().smartGuides).toEqual([{ orientation: "vertical", position: 960, from: 0, to: 1080 }]);
  });

  it("snaps the block's bottom edge exactly onto a safe-area edge, even at a fractional position", () => {
    // An 8% safe margin is 86.4 px, so the safe area's bottom edge is at 1080 − 86.4 = 993.6.
    const editor = editorWith([{ x: 400, y: 250 }], { gridVisible: false, safeMargin: 8 });

    // The bottom edge moves from 350 to 991, 2.6 px above the safe-area edge.
    dragBy(editor, { x: 0, y: 641 }, { viewScale: 1 });

    expect(selectedPosition(editor).y).toBeCloseTo(893.6, 9);
    const [guide] = editor.getView().smartGuides;
    expect(guide.orientation).toBe("horizontal");
    expect(guide.position).toBeCloseTo(993.6, 9);
    // Along the safe area's bottom edge, from 86.4 to 1920 − 86.4.
    expect(guide.from).toBeCloseTo(86.4, 9);
    expect(guide.to).toBeCloseTo(1833.6, 9);
  });

  it("snaps the block's middle to the horizontal centre line", () => {
    const editor = editorWith([{ x: 400, y: 250 }], { gridVisible: false });

    // The middle moves from 300 to 545, 5 px below the centre line at 540.
    dragBy(editor, { x: 0, y: 245 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 400, y: 490 });
    expect(editor.getView().smartGuides).toEqual([{ orientation: "horizontal", position: 540, from: 0, to: 1920 }]);
  });
});

describe("snapping a dragged block to other blocks", () => {
  it("snaps to another block's edges and centres, with smart guides across both blocks", () => {
    const editor = editorWith(
      [
        { x: 400, y: 250 },
        // 120 × 200 px, from (900, 600) to (1020, 800), its centre at x 960.
        { x: 900, y: 600, text: "AB\nCD" },
      ],
      { gridVisible: false, safeAreaVisible: false },
    );

    // The dragged block's centre moves to 956, 4 px left of the other's centre;
    // its bottom edge to 598, 2 px above the other's top edge.
    dragBy(editor, { x: 436, y: 248 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 840, y: 500 });
    expect(smartGuides(editor)).toEqual([
      // From the dragged block's top (500) to the other's bottom (800).
      { orientation: "vertical", position: 960, from: 500, to: 800 },
      // From the dragged block's left (840) to its right (1080), past the other's.
      { orientation: "horizontal", position: 600, from: 840, to: 1080 },
    ]);
  });
});

describe("the snap distance", () => {
  // 6 screen px is 6 ÷ the view scale in wallpaper px.
  it.each`
    viewScale | reach  | snapsFrom | missesFrom
    ${0.25}   | ${24}  | ${24}     | ${25}
    ${0.5}    | ${12}  | ${12}     | ${13}
    ${1}      | ${6}   | ${6}      | ${7}
    ${2}      | ${3}   | ${3}      | ${4}
    ${4}      | ${1.5} | ${1}      | ${2}
  `(
    "is $reach wallpaper px at a view scale of $viewScale: it snaps from $snapsFrom px away but not from $missesFrom",
    ({ viewScale, snapsFrom, missesFrom }) => {
      const near = editorWith([{ x: 400, y: 250 }], { gridVisible: false });
      // The centre moves from 520 to `snapsFrom` px left of the centre line at 960.
      dragBy(near, { x: 440 - snapsFrom, y: 0 }, { viewScale });
      expect(selectedPosition(near).x).toBe(840);

      const far = editorWith([{ x: 400, y: 250 }], { gridVisible: false });
      dragBy(far, { x: 440 - missesFrom, y: 0 }, { viewScale });
      expect(selectedPosition(far).x).toBe(840 - missesFrom);
      expect(far.getView().smartGuides).toEqual([]);
    },
  );

  it("lets the closest match win on an axis, and leaves an axis with nothing in reach following the pointer", () => {
    const editor = editorWith(
      [
        { x: 400, y: 250 },
        // Its left edge at 700.
        { x: 700, y: 700, text: "ABC" },
        // Its left edge at 946.
        { x: 946, y: 900, text: "AB" },
      ],
      { gridVisible: false, safeAreaVisible: false },
    );

    // The dragged block's left edge moves to 704, 4 px right of one block's
    // left edge, and its right edge to 944, 2 px left of the other's.
    dragBy(editor, { x: 304, y: 37 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 706, y: 287 });
    expect(smartGuides(editor)).toEqual([{ orientation: "vertical", position: 946, from: 287, to: 1000 }]);
  });
});

describe("hidden guides", () => {
  it("aren't snapped to: with the grid hidden, a block moves freely past a grid line", () => {
    const editor = editorWith([{ x: 400, y: 250 }], { gridVisible: false });

    // The left edge moves to 203, 2 px left of the grid line at 205.
    dragBy(editor, { x: -197, y: 0 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 203, y: 250 });
    expect(editor.getView().smartGuides).toEqual([]);
  });

  it("aren't snapped to: with the safe-area guides hidden too, a block moves freely past the centre lines", () => {
    const editor = editorWith([{ x: 400, y: 250 }], { gridVisible: false, safeAreaVisible: false });

    // The centre moves to 957, 3 px left of the centre line at 960, and the middle to 543, 3 px below it.
    dragBy(editor, { x: 437, y: 243 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 837, y: 493 });
    expect(editor.getView().smartGuides).toEqual([]);
  });
});

describe("turning snapping off", () => {
  it("moves the block freely with the Snapping setting off", () => {
    const editor = editorWith([{ x: 400, y: 250 }], { snapping: false });

    dragBy(editor, { x: -197, y: 0 }, { viewScale: 1 });

    expect(selectedPosition(editor)).toEqual({ x: 203, y: 250 });
    expect(editor.getView().smartGuides).toEqual([]);
  });

  it("moves the block freely while Ctrl is held, and snaps again once it's released", () => {
    const editor = editorWith([{ x: 400, y: 250 }]);
    const grab = { x: 410, y: 260 };
    editor.beginMove(grab);

    // The left edge moves to 203, 2 px left of the grid line at 205.
    editor.updateMove({ x: 213, y: 260 }, { viewScale: 1, bypassSnapping: true });
    expect(selectedPosition(editor)).toEqual({ x: 203, y: 250 });
    expect(editor.getView().smartGuides).toEqual([]);

    editor.updateMove({ x: 213, y: 260 }, { viewScale: 1 });
    expect(selectedPosition(editor)).toEqual({ x: 205, y: 250 });
  });
});

describe("what never snaps", () => {
  it("nudges never snap: each moves the block exactly 1 or 10 px, even beside a guide", () => {
    // The left edge is 2 px left of the grid line at 205.
    const editor = editorWith([{ x: 203, y: 250 }]);

    editor.nudge("right");
    expect(selectedPosition(editor)).toEqual({ x: 204, y: 250 });
    expect(editor.getView().smartGuides).toEqual([]);
    editor.nudge("right", "large");
    expect(selectedPosition(editor)).toEqual({ x: 214, y: 250 });
    editor.nudge("left", "large");
    editor.nudge("left");
    expect(selectedPosition(editor)).toEqual({ x: 203, y: 250 });
    expect(editor.getView().smartGuides).toEqual([]);
  });

  it("leaves a block where it is when it's clicked without being moved, even beside a guide", () => {
    // The left edge is 2 px left of the grid line at 205.
    const editor = editorWith([{ x: 203, y: 250 }]);

    editor.beginMove({ x: 213, y: 260 });
    editor.updateMove({ x: 213.3, y: 259.8 }, { viewScale: 1 });
    expect(editor.getView().smartGuides).toEqual([]);
    editor.endMove();

    expect(selectedPosition(editor)).toEqual({ x: 203, y: 250 });
    expect(editor.getView().canUndo).toBe(false);
  });
});
