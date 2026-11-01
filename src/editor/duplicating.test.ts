import { describe, expect, it } from "vitest";
import { createEditor, type TextBlock, type Wallpaper } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/** The starting block's box is from (54, 709.2) to (630, 1026) with the fake measurer; see editor.test.ts. */
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };

/** An editor with the starting block selected. */
function editorWithBlockSelected() {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  editor.selectAt(INSIDE_STARTING_BLOCK);
  return editor;
}

describe("duplicating a text block", () => {
  it("places a copy right and down by 2% of the shorter side, on top, and selects it", () => {
    const editor = editorWithBlockSelected();

    editor.duplicate();

    const [original, copy] = editor.getWallpaper().blocks;
    // 2% of 1080, the starting wallpaper's shorter side, is 21.6 px.
    expect(original).toMatchObject({ id: "block-1", x: 54, y: 709.2 });
    expect(copy.id).not.toBe("block-1");
    expect(copy.x).toBeCloseTo(75.6, 9);
    expect(copy.y).toBeCloseTo(730.8, 9);
    expect(editor.getView().selection?.id).toBe(copy.id);
  });

  it("copies everything but the id and position, and puts the copy on top of every block", () => {
    const editor = editorWithStyledBlockUnderAnother();

    editor.selectAt(INSIDE_STYLED_BLOCK);
    editor.duplicate();

    const blocks = editor.getWallpaper().blocks;
    expect(blocks.map(({ id }) => id).slice(0, 2)).toEqual(["styled", "on-top"]);
    const copy = blocks[2];
    expect(["styled", "on-top"]).not.toContain(copy.id);
    // 2% of 1170, the portrait wallpaper's shorter side (its width), is 23.4 px.
    expect(copy).toEqual({ ...STYLED_BLOCK, id: copy.id, x: expect.closeTo(123.4, 9), y: expect.closeTo(223.4, 9) });
    expect(editor.getView().selection?.id).toBe(copy.id);
  });

  it("is one undo step, which takes the copy away and redo brings back", () => {
    const editor = editorWithBlockSelected();
    const before = editor.getWallpaper();

    editor.duplicate();
    const duplicated = editor.getWallpaper();
    editor.undo();

    expect(editor.getWallpaper()).toEqual(before);
    expect(editor.getView().selection).toBeNull();
    expect(editor.getView().canUndo).toBe(false);

    editor.redo();
    expect(editor.getWallpaper()).toEqual(duplicated);
  });

  it("forgets the selected copy once undo takes it away, so redo brings it back unselected", () => {
    const editor = editorWithBlockSelected();
    editor.duplicate();

    editor.undo();
    editor.redo();

    expect(editor.getWallpaper().blocks).toHaveLength(2);
    expect(editor.getView().selection).toBeNull();
  });

  it("ends a run of nudges, so the nudges and the duplicate are one undo step each", () => {
    const editor = editorWithBlockSelected();

    editor.nudge("right");
    editor.nudge("right");
    editor.duplicate();

    expect(editor.getWallpaper().blocks.map(({ x }) => x)).toEqual([56, expect.closeTo(77.6, 9)]);
    editor.undo();
    expect(editor.getWallpaper().blocks.map(({ x }) => x)).toEqual([56]);
    editor.undo();
    expect(editor.getWallpaper().blocks.map(({ x }) => x)).toEqual([54]);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("cascades when repeated, each copy with its own id, offset from the one before", () => {
    const editor = editorWithBlockSelected();

    editor.duplicate();
    editor.duplicate();

    const blocks = editor.getWallpaper().blocks;
    expect(new Set(blocks.map(({ id }) => id)).size).toBe(3);
    expect(blocks[2].x).toBeCloseTo(97.2, 9);
    expect(blocks[2].y).toBeCloseTo(752.4, 9);
    expect(editor.getView().selection?.id).toBe(blocks[2].id);
  });

  it("does nothing when nothing is selected", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.duplicate();

    expect(editor.getWallpaper().blocks).toHaveLength(1);
    expect(editor.getView().canUndo).toBe(false);
  });
});

/** A block whose typography differs from the defaults in every way the one font allows. */
const STYLED_BLOCK = {
  id: "styled",
  text: "Hello\nworld",
  fontId: "ocr-a",
  fontSize: 50,
  fontWeight: 400,
  letterSpacing: 10,
  lineHeight: 1.5,
  align: "center",
  color: "#FF8800",
  opacity: 60,
  uppercase: false,
  x: 100,
  y: 200,
} satisfies TextBlock;

/** Inside the styled block's box, which with the fake measurer is from (100, 200) to (270, 350). */
const INSIDE_STYLED_BLOCK = { x: 150, y: 250 };

/** An editor on a portrait 1170 × 2532 wallpaper with the styled block, and another block drawn above it. */
function editorWithStyledBlockUnderAnother() {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  const saved: { wallpaper: Wallpaper } = JSON.parse(editor.serialise());
  saved.wallpaper.resolution = { width: 1170, height: 2532 };
  saved.wallpaper.blocks = [STYLED_BLOCK, { ...saved.wallpaper.blocks[0], id: "on-top", x: 500, y: 1500 }];
  editor.load(JSON.stringify(saved));
  return editor;
}
