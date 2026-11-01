import { describe, expect, it } from "vitest";
import { createEditor, DEFAULT_TYPOGRAPHY, type Box, type Editor, type EditorSettings, type Point } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/**
 * Blocks here are at 100 px with line height 1, so the fake measurer makes
 * each character 60 px wide and each line 100 px tall: "ABCD" is exactly
 * 240 × 100 px.
 *
 * A corner drag scales the box about the opposite corner by how far along its
 * diagonal the dragged corner has moved. Dragging the bottom-right corner of a
 * 240 × 100 box by (120, 50) moves it 1.5 × along the diagonal, so the box
 * becomes 360 × 150 and the font size 100 × 360 ÷ 240 = 150.
 */

interface BlockAt extends Point {
  /** "ABCD" (240 × 100 px) unless given. */
  text?: string;
  letterSpacing?: number;
  lineHeight?: number;
}

/**
 * An editor on a 1920 × 1080 wallpaper with a block at the given top-left
 * corner, selected, and any `others` after it.
 */
function editorWith(selected: BlockAt, settings: Partial<EditorSettings> = {}, others: BlockAt[] = []): Editor {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  // The starting wallpaper, saved, with these blocks and settings in place.
  const saved = JSON.parse(editor.serialise());
  saved.wallpaper.blocks = [selected, ...others].map(({ text = "ABCD", ...block }, i) => ({
    id: `block-${i + 1}`,
    ...DEFAULT_TYPOGRAPHY,
    text,
    fontSize: 100,
    lineHeight: 1,
    ...block,
  }));
  Object.assign(saved.settings, settings);
  editor.load(JSON.stringify(saved));
  editor.selectAt({ x: selected.x + 1, y: selected.y + 1 });
  return editor;
}

function selectedBox(editor: Editor): Box {
  return editor.getView().selection!.box;
}

function fontSize(editor: Editor): number {
  return editor.getWallpaper().blocks[0].fontSize;
}

describe("scaling a text block by its corner handle", () => {
  it("scales the font size by the new box width ÷ the old, keeping the opposite corner where it was", () => {
    const editor = editorWith({ x: 400, y: 250 }, { snapping: false });

    // Grabbed on the bottom-right corner, at (640, 350).
    editor.beginScale("bottom-right", { x: 640, y: 350 });
    editor.updateScale({ x: 760, y: 400 });

    expect(fontSize(editor)).toBeCloseTo(150, 9);
    const box = selectedBox(editor);
    expect(box.x).toBe(400);
    expect(box.y).toBe(250);
    expect(box.width).toBeCloseTo(360, 9);
    expect(box.height).toBeCloseTo(150, 9);
  });

  // The box runs from (400, 250) to (640, 350); each handle is dragged 1.5 × along its diagonal.
  it.each`
    corner            | grab                    | drag                     | fixed                   | scaledTopLeft
    ${"top-left"}     | ${{ x: 400, y: 250 }}   | ${{ x: -120, y: -50 }}   | ${{ x: 640, y: 350 }}   | ${{ x: 280, y: 200 }}
    ${"top-right"}    | ${{ x: 640, y: 250 }}   | ${{ x: 120, y: -50 }}    | ${{ x: 400, y: 350 }}   | ${{ x: 400, y: 200 }}
    ${"bottom-left"}  | ${{ x: 400, y: 350 }}   | ${{ x: -120, y: 50 }}    | ${{ x: 640, y: 250 }}   | ${{ x: 280, y: 250 }}
    ${"bottom-right"} | ${{ x: 640, y: 350 }}   | ${{ x: 120, y: 50 }}     | ${{ x: 400, y: 250 }}   | ${{ x: 400, y: 250 }}
  `(
    "keeps the $fixed.x, $fixed.y corner fixed while the $corner handle is dragged",
    ({ corner, grab, drag, fixed, scaledTopLeft }) => {
      const editor = editorWith({ x: 400, y: 250 }, { snapping: false });

      editor.beginScale(corner, grab);
      editor.updateScale({ x: grab.x + drag.x, y: grab.y + drag.y });

      expect(fontSize(editor)).toBeCloseTo(150, 9);
      const box = selectedBox(editor);
      expect(box.x).toBeCloseTo(scaledTopLeft.x, 9);
      expect(box.y).toBeCloseTo(scaledTopLeft.y, 9);
      // The fixed corner is one of the box's corners, exactly where it was.
      const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x, y: box.y + box.height },
        { x: box.x + box.width, y: box.y + box.height },
      ];
      expect(corners.some(({ x, y }) => Math.abs(x - fixed.x) < 1e-9 && Math.abs(y - fixed.y) < 1e-9)).toBe(true);
    },
  );

  it("shrinks the block when the handle is dragged in towards the opposite corner", () => {
    const editor = editorWith({ x: 400, y: 250 }, { snapping: false });

    editor.beginScale("bottom-right", { x: 640, y: 350 });
    editor.updateScale({ x: 580, y: 325 });

    expect(fontSize(editor)).toBeCloseTo(75, 9);
    expect(selectedBox(editor)).toMatchObject({ x: 400, y: 250 });
    expect(selectedBox(editor).width).toBeCloseTo(180, 9);
  });

  it("keeps letter spacing and line height as they are, so they scale with the font size", () => {
    // 10% letter spacing is 10 px between characters at 100 px, so "ABCD" is
    // 4 × 60 + 3 × 10 = 270 px wide; a line height of 1.2 makes it 120 px tall.
    const editor = editorWith({ x: 400, y: 250, letterSpacing: 10, lineHeight: 1.2 }, { snapping: false });

    // 1.5 × along the 270 × 120 diagonal.
    editor.beginScale("bottom-right", { x: 670, y: 370 });
    editor.updateScale({ x: 805, y: 430 });

    const [block] = editor.getWallpaper().blocks;
    expect(block.fontSize).toBeCloseTo(150, 9);
    expect(block.letterSpacing).toBe(10);
    expect(block.lineHeight).toBe(1.2);
    expect(selectedBox(editor).width).toBeCloseTo(405, 9);
    expect(selectedBox(editor).height).toBeCloseTo(180, 9);
  });

  it("allows a fractional font size", () => {
    const editor = editorWith({ x: 400, y: 250 }, { snapping: false });

    // 1 px right moves the corner (241 × 240 + 100 × 100) ÷ (240² + 100²) = 67840 ÷ 67600 along the diagonal.
    editor.beginScale("bottom-right", { x: 640, y: 350 });
    editor.updateScale({ x: 641, y: 350 });

    expect(fontSize(editor)).toBeCloseTo(6784000 / 67600, 9);
  });

  it("never takes the font size below 1 px, however far the handle is dragged past the opposite corner", () => {
    const editor = editorWith({ x: 400, y: 250 }, { snapping: false });

    editor.beginScale("bottom-right", { x: 640, y: 350 });
    editor.updateScale({ x: 100, y: 50 });

    expect(fontSize(editor)).toBe(1);
    expect(selectedBox(editor)).toMatchObject({ x: 400, y: 250 });
    expect(selectedBox(editor).width).toBeCloseTo(2.4, 9);
  });
});

describe("undoing a scale", () => {
  it("makes the whole scale one undo step, however many steps the drag had", () => {
    const editor = editorWith({ x: 400, y: 250 }, { snapping: false });

    editor.beginScale("top-left", { x: 400, y: 250 });
    editor.updateScale({ x: 390, y: 240 });
    editor.updateScale({ x: 350, y: 230 });
    editor.updateScale({ x: 280, y: 200 });
    editor.endScale();
    expect(fontSize(editor)).toBeCloseTo(150, 9);

    editor.undo();
    expect(editor.getWallpaper().blocks[0]).toMatchObject({ fontSize: 100, x: 400, y: 250 });
    expect(editor.getView().canUndo).toBe(false);

    editor.redo();
    expect(fontSize(editor)).toBeCloseTo(150, 9);
    expect(selectedBox(editor).x).toBeCloseTo(280, 9);
    expect(selectedBox(editor).y).toBeCloseTo(200, 9);
  });

  it("records no undo step for a click on a handle that doesn't move it", () => {
    const editor = editorWith({ x: 400, y: 250 }, { snapping: false });

    editor.beginScale("bottom-right", { x: 640, y: 350 });
    editor.updateScale({ x: 640.3, y: 349.8 });
    editor.endScale();

    expect(editor.getWallpaper().blocks[0]).toMatchObject({ fontSize: 100, x: 400, y: 250 });
    expect(editor.getView().canUndo).toBe(false);
  });

  it("does nothing when nothing is selected", () => {
    const editor = editorWith({ x: 400, y: 250 }, { snapping: false });
    editor.deselect();

    editor.beginScale("bottom-right", { x: 640, y: 350 });
    editor.updateScale({ x: 760, y: 400 });
    editor.endScale();

    expect(fontSize(editor)).toBe(100);
    expect(editor.getView().canUndo).toBe(false);
  });
});

/**
 * Guide lines on a 1920 × 1080 wallpaper at the default 5% safe margin and 12
 * columns (see guides.test.ts): the safe area runs from 54 to 1866 across and
 * 54 to 1026 down, grid lines are 151 px apart across (54, 205, 356, 507,
 * 658, 809, …) and 162 px apart down (54, 216, 378, …), and the centre lines
 * run through (960, 540).
 *
 * "ABCDEFG" at (356, 250) is 420 × 100 px, so its left edge sits on the grid
 * line at 356 and its right edge is at 776.
 */
describe("snapping a scaled block", () => {
  /** Drags the bottom-right handle of "ABCDEFG" at (356, 250) by (31, 7), leaving the scale open. */
  function scaleTowardsGridLine(editor: Editor, options?: Parameters<Editor["updateScale"]>[1]) {
    editor.beginScale("bottom-right", { x: 776, y: 350 });
    // The corner moves (451 × 420 + 107 × 100) ÷ (420² + 100²) ≈ 1.0736 × along
    // the diagonal: the right edge to about 806.9, 2.1 px left of the grid line
    // at 809, and the bottom edge to about 357.4, far from any line across.
    editor.updateScale({ x: 807, y: 357 }, options);
  }

  it("snaps the moving right edge exactly onto a grid line, giving the exact fractional font size", () => {
    const editor = editorWith({ x: 356, y: 250, text: "ABCDEFG" }, { safeAreaVisible: false });

    scaleTowardsGridLine(editor, { viewScale: 1 });

    // The box goes from 420 to 809 − 356 = 453 px wide, so the font size is 100 × 453 ÷ 420.
    expect(fontSize(editor)).toBeCloseTo(45300 / 420, 9);
    const box = selectedBox(editor);
    expect(box.x).toBe(356);
    expect(box.y).toBe(250);
    expect(box.x + box.width).toBeCloseTo(809, 9);
    // Only the moving edges show smart guides: the fixed left edge on the grid line at 356 doesn't.
    expect(editor.getView().smartGuides).toEqual([{ orientation: "vertical", position: 809, from: 54, to: 1026 }]);

    editor.endScale();
    expect(editor.getView().smartGuides).toEqual([]);
    expect(fontSize(editor)).toBeCloseTo(45300 / 420, 9);
  });

  it("lets the moving edge with the shorter way to go win, since the box can't take both and keep its proportions", () => {
    const editor = editorWith(
      { x: 400, y: 250 },
      { gridVisible: false, safeAreaVisible: false },
      // 120 × 100 px, from (680, 366) to (800, 466).
      [{ x: 680, y: 366, text: "AB" }],
    );

    // 1.15 × along the diagonal: the right edge to 676, 4 px left of the other
    // block's left edge, and the bottom edge to 365, 1 px above its top edge.
    editor.beginScale("bottom-right", { x: 640, y: 350 });
    editor.updateScale({ x: 676, y: 365 }, { viewScale: 1 });

    // The bottom edge wins: 116 px tall instead of 100, so the right edge is at 400 + 240 × 1.16 = 678.4.
    expect(fontSize(editor)).toBeCloseTo(116, 9);
    expect(selectedBox(editor).y + selectedBox(editor).height).toBeCloseTo(366, 9);
    expect(selectedBox(editor).x + selectedBox(editor).width).toBeCloseTo(678.4, 9);
    expect(editor.getView().smartGuides).toEqual([
      // From the scaled block's left (400) to the other block's right (800).
      { orientation: "horizontal", position: 366, from: 400, to: 800 },
    ]);
  });

  it("scales freely while Ctrl is held, and snaps again once it's released", () => {
    const editor = editorWith({ x: 356, y: 250, text: "ABCDEFG" }, { safeAreaVisible: false });

    scaleTowardsGridLine(editor, { viewScale: 1, bypassSnapping: true });
    // 100 × (451 × 420 + 107 × 100) ÷ (420² + 100²), with the right edge about 2.1 px short of the grid line.
    expect(fontSize(editor)).toBeCloseTo(20012000 / 186400, 9);
    expect(editor.getView().smartGuides).toEqual([]);

    editor.updateScale({ x: 807, y: 357 }, { viewScale: 1 });
    expect(fontSize(editor)).toBeCloseTo(45300 / 420, 9);
  });

  it("scales freely with the Snapping setting off", () => {
    const editor = editorWith({ x: 356, y: 250, text: "ABCDEFG" }, { safeAreaVisible: false, snapping: false });

    scaleTowardsGridLine(editor, { viewScale: 1 });

    expect(fontSize(editor)).toBeCloseTo(20012000 / 186400, 9);
    expect(editor.getView().smartGuides).toEqual([]);
  });

  it("snaps within 6 screen px at any zoom: 12 wallpaper px at a view scale of 0.5, but not at 1", () => {
    // 1.0545 × along the diagonal: the right edge to about 798.9, 10.1 px left of the grid line at 809.
    const drag = (editor: Editor, viewScale: number) => {
      editor.beginScale("bottom-right", { x: 776, y: 350 });
      editor.updateScale({ x: 799, y: 355 }, { viewScale });
    };

    const zoomedOut = editorWith({ x: 356, y: 250, text: "ABCDEFG" }, { safeAreaVisible: false });
    drag(zoomedOut, 0.5);
    expect(fontSize(zoomedOut)).toBeCloseTo(45300 / 420, 9);

    const actualSize = editorWith({ x: 356, y: 250, text: "ABCDEFG" }, { safeAreaVisible: false });
    drag(actualSize, 1);
    // 100 × (443 × 420 + 105 × 100) ÷ (420² + 100²).
    expect(fontSize(actualSize)).toBeCloseTo(19656000 / 186400, 9);
    expect(actualSize.getView().smartGuides).toEqual([]);
  });
});
