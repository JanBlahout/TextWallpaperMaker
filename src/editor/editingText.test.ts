import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/** Inside the starting block's box, from (54, 709.2) to (630, 1026) with the fake measurer; see editor.test.ts. */
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };
const STARTING_TEXT = "DISCIPLINE\nEQUALS\nFREEDOM.";

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

/** What double-clicking the starting block does. */
function editorEditingStartingBlock() {
  const editor = newEditor();
  editor.selectAt(INSIDE_STARTING_BLOCK);
  editor.beginTextEdit();
  return editor;
}

function startingText(editor: ReturnType<typeof newEditor>) {
  return editor.getWallpaper().blocks[0].text;
}

describe("editing a block's text in place", () => {
  it("opens the selected block for editing", () => {
    const editor = editorEditingStartingBlock();

    expect(editor.getView().editing?.id).toBe("block-1");
  });

  it("opens nothing when nothing is selected, as double-clicking empty canvas does", () => {
    const editor = newEditor();
    editor.selectAt({ x: 1500, y: 200 });

    editor.beginTextEdit();

    expect(editor.getView().editing).toBeNull();
  });

  it("shows each keystroke straight away, the box hugging the text, and makes the whole session one undo step", () => {
    const editor = editorEditingStartingBlock();

    editor.setText("GET UP.");
    editor.setText("GET UP.\n");
    editor.setText("GET UP.\nDUST OFF.");
    expect(startingText(editor)).toBe("GET UP.\nDUST OFF.");
    // DUST OFF. is 9 × 57.6 = 518.4 px wide; two lines are 2 × 105.6 = 211.2 px tall.
    expect(editor.getView().editing?.box.width).toBeCloseTo(518.4, 9);
    expect(editor.getView().editing?.box.height).toBeCloseTo(211.2, 9);
    editor.endTextEdit();

    expect(editor.getView().editing).toBeNull();
    expect(editor.getView().selection?.id).toBe("block-1");
    expect(startingText(editor)).toBe("GET UP.\nDUST OFF.");
    editor.undo();
    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
    editor.redo();
    expect(startingText(editor)).toBe("GET UP.\nDUST OFF.");
  });

  it("makes adding a block and typing into it one undo step", () => {
    const editor = newEditor();
    const starting = editor.getWallpaper();

    editor.addText();
    editor.setText("R");
    editor.setText("RELOAD.");
    editor.endTextEdit();
    expect(editor.getWallpaper().blocks.at(-1)?.text).toBe("RELOAD.");

    editor.undo();
    expect(editor.getWallpaper()).toEqual(starting);
    expect(editor.getView().canUndo).toBe(false);
    editor.redo();
    expect(editor.getWallpaper().blocks.at(-1)?.text).toBe("RELOAD.");
  });

  it("stores the text as typed: uppercase changes only how it looks", () => {
    const editor = editorEditingStartingBlock();
    expect(editor.getWallpaper().blocks[0].uppercase).toBe(true);

    editor.setText("Get up.");
    editor.endTextEdit();

    expect(startingText(editor)).toBe("Get up.");
  });
});

describe("editing a block's text in the inspector", () => {
  /** The starting block selected, not opened for editing in place. */
  function editorWithBlockSelected() {
    const editor = newEditor();
    editor.selectAt(INSIDE_STARTING_BLOCK);
    return editor;
  }

  it("makes a committed change one undo step", () => {
    const editor = editorWithBlockSelected();

    editor.setText("GET UP.\nDUST OFF.");

    expect(startingText(editor)).toBe("GET UP.\nDUST OFF.");
    expect(editor.getView().editing).toBeNull();
    editor.undo();
    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("shows previews while typing, and makes them and the commit one undo step", () => {
    const editor = editorWithBlockSelected();

    editor.setText("G", { preview: true });
    editor.setText("GET UP.", { preview: true });
    expect(startingText(editor)).toBe("GET UP.");
    editor.setText("GET UP.");

    editor.undo();
    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("deletes the block when blank text is committed, as one undo step, but not while it's only previewed", () => {
    const editor = editorWithBlockSelected();

    editor.setText("", { preview: true });
    expect(editor.getWallpaper().blocks).toHaveLength(1);
    editor.setText("");

    expect(editor.getWallpaper().blocks).toEqual([]);
    expect(editor.getView().selection).toBeNull();
    editor.undo();
    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("does nothing when nothing is selected", () => {
    const editor = newEditor();

    editor.setText("GET UP.");

    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
  });
});

describe("interrupting an edit", () => {
  it("ends the session when the canvas is clicked, keeping what was typed as one undo step", () => {
    const editor = editorEditingStartingBlock();
    editor.setText("GET UP.");

    editor.selectAt({ x: 1500, y: 200 });
    editor.setText("ignored");

    expect(editor.getView().editing).toBeNull();
    expect(startingText(editor)).toBe("GET UP.");
    editor.undo();
    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("ends the session at an undo, which undoes it as a whole", () => {
    const editor = editorEditingStartingBlock();
    editor.setText("GET UP.");

    editor.undo();

    expect(editor.getView().editing).toBeNull();
    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
    editor.redo();
    expect(startingText(editor)).toBe("GET UP.");
  });

  it("deletes an emptied block when adding text ends its session, and the new block takes its style", () => {
    const editor = editorEditingStartingBlock();
    editor.setText("");

    editor.addText();

    const blocks = editor.getWallpaper().blocks;
    expect(blocks.map(({ text }) => text)).toEqual(["TEXT"]);
    expect(blocks[0].fontSize).toBe(96);
    expect(editor.getView().editing?.id).toBe(blocks[0].id);
  });

  it("drops the session when a saved wallpaper loads", () => {
    const editor = editorEditingStartingBlock();
    const saved = editor.serialise();

    editor.load(saved);
    editor.setText("ignored");

    expect(editor.getView().editing).toBeNull();
    expect(startingText(editor)).toBe(STARTING_TEXT);
  });
});

describe("finishing an edit with empty text", () => {
  it("deletes the block, in the same undo step as the edit", () => {
    const editor = editorEditingStartingBlock();

    editor.setText("");
    expect(editor.getWallpaper().blocks).toHaveLength(1);
    editor.endTextEdit();

    expect(editor.getWallpaper().blocks).toEqual([]);
    expect(editor.getView().selection).toBeNull();
    expect(editor.getView().editing).toBeNull();
    editor.undo();
    expect(startingText(editor)).toBe(STARTING_TEXT);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("leaves no trace of a block that was added and then emptied", () => {
    const editor = newEditor();
    const starting = editor.getWallpaper();

    editor.addText();
    editor.setText("");
    editor.endTextEdit();

    expect(editor.getWallpaper()).toEqual(starting);
    expect(editor.getView().selection).toBeNull();
    expect(editor.getView().canUndo).toBe(false);
  });

  it("counts text of only spaces and line breaks as empty, since it would be just as invisible", () => {
    const editor = editorEditingStartingBlock();

    editor.setText(" \n ");
    editor.endTextEdit();

    expect(editor.getWallpaper().blocks).toEqual([]);
  });

  it("keeps the spaces and line breaks around visible text, as typed", () => {
    const editor = editorEditingStartingBlock();

    editor.setText("\n  GET UP. \n");
    editor.endTextEdit();

    expect(startingText(editor)).toBe("\n  GET UP. \n");
  });
});
