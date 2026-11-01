import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/** The starting block's box is from (54, 709.2) to (630, 1026) with the fake measurer; see editor.test.ts. */
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };

/** An editor with the starting block selected. */
function editorWithBlockSelected() {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  editor.selectAt(INSIDE_STARTING_BLOCK);
  return editor;
}

describe("deleting a text block", () => {
  it("removes the selected block, leaving nothing selected", () => {
    const editor = editorWithBlockSelected();

    editor.delete();

    expect(editor.getWallpaper().blocks).toEqual([]);
    expect(editor.getView().selection).toBeNull();
  });

  it("is one undo step: undo puts the block back where it was in the stacking order, and redo removes it again", () => {
    const editor = editorWithBlockSelected();
    editor.duplicate();
    const [original, copy] = editor.getWallpaper().blocks;
    // Inside the original's box but not the copy's, which starts 21.6 px right and down.
    editor.selectAt({ x: 60, y: 720 });

    editor.delete();
    expect(editor.getWallpaper().blocks).toEqual([copy]);

    editor.undo();
    expect(editor.getWallpaper().blocks).toEqual([original, copy]);
    editor.undo();
    expect(editor.getWallpaper().blocks).toEqual([original]);

    editor.redo();
    editor.redo();
    expect(editor.getWallpaper().blocks).toEqual([copy]);
  });

  it("ends a drag, so the drag and the delete are one undo step each", () => {
    const editor = editorWithBlockSelected();
    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: 200, y: 800 });

    editor.delete();
    editor.updateMove({ x: 300, y: 800 });
    editor.endMove();
    expect(editor.getWallpaper().blocks).toEqual([]);

    editor.undo();
    expect(editor.getWallpaper().blocks.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 154, y: 709.2 }]);
    editor.undo();
    expect(editor.getWallpaper().blocks.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 54, y: 709.2 }]);
  });

  it("does nothing when nothing is selected", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.delete();

    expect(editor.getWallpaper().blocks).toHaveLength(1);
    expect(editor.getView().canUndo).toBe(false);
  });
});
