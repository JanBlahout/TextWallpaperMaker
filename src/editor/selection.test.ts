import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/**
 * The starting block's box with the fake measurer (see editor.test.ts): from
 * (54, 709.2), 576 px wide (DISCIPLINE) and 316.8 px tall (three lines of
 * 105.6 px), so it ends at (630, 1026).
 */
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

describe("selecting a text block", () => {
  it("selects nothing when the editor opens", () => {
    expect(newEditor().getView().selection).toBeNull();
  });

  it("selects the block whose box contains the clicked point, and reports its box", () => {
    const editor = newEditor();

    editor.selectAt(INSIDE_STARTING_BLOCK);

    const { selection } = editor.getView();
    expect(selection?.id).toBe("block-1");
    expect(selection?.box.x).toBe(54);
    expect(selection?.box.y).toBeCloseTo(709.2, 9);
    expect(selection?.box.width).toBeCloseTo(576, 9);
    expect(selection?.box.height).toBeCloseTo(316.8, 9);
  });

  it("hits anywhere in the measured box, even beside a short line where no text is drawn", () => {
    const editor = newEditor();

    // EQUALS, the second line (y 814.8 to 920.4), is 6 × 57.6 = 345.6 px wide,
    // so it ends at x 399.6, well short of the box's right edge at 630.
    editor.selectAt({ x: 600, y: 870 });

    expect(editor.getView().selection?.id).toBe("block-1");
  });

  it("deselects when empty canvas is clicked, even just outside the box", () => {
    const editor = newEditor();
    editor.selectAt(INSIDE_STARTING_BLOCK);

    editor.selectAt({ x: 631, y: 800 });

    expect(editor.getView().selection).toBeNull();
  });

  it("deselects on request, as Escape does", () => {
    const editor = newEditor();
    editor.selectAt(INSIDE_STARTING_BLOCK);

    editor.deselect();

    expect(editor.getView().selection).toBeNull();
  });

  it("is never an undo step: selecting and deselecting record nothing, and undo leaves the selection alone", () => {
    const editor = newEditor();

    editor.selectAt(INSIDE_STARTING_BLOCK);
    editor.deselect();
    editor.selectAt(INSIDE_STARTING_BLOCK);
    expect(editor.getView().canUndo).toBe(false);

    editor.setBackground("#1E3A5F");
    editor.deselect();
    editor.undo();
    expect(editor.getWallpaper().background).toBe("#000000");
    expect(editor.getView().selection).toBeNull();
    expect(editor.getView().canUndo).toBe(false);

    editor.selectAt(INSIDE_STARTING_BLOCK);
    editor.redo();
    expect(editor.getWallpaper().background).toBe("#1E3A5F");
    expect(editor.getView().selection?.id).toBe("block-1");
  });

  it("starts with nothing selected after loading a saved wallpaper", () => {
    const editor = newEditor();
    const saved = editor.serialise();
    editor.selectAt(INSIDE_STARTING_BLOCK);

    editor.load(saved);

    expect(editor.getView().selection).toBeNull();
  });

  it("tells subscribers when the selection changes", () => {
    const editor = newEditor();
    const seen: (string | null)[] = [];
    editor.subscribe(() => seen.push(editor.getView().selection?.id ?? null));

    editor.selectAt(INSIDE_STARTING_BLOCK);
    editor.deselect();

    expect(seen).toEqual(["block-1", null]);
  });
});
