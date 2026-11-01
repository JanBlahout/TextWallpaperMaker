import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/** The starting block's box is from (54, 709.2) to (630, 1026) with the fake measurer; see editor.test.ts. */
const START = { x: 54, y: 709.2 };
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };

/** An editor with the starting block selected. */
function editorWithBlockSelected() {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  editor.selectAt(INSIDE_STARTING_BLOCK);
  return editor;
}

function startingBlockPosition(editor: ReturnType<typeof createEditor>) {
  const [{ x, y }] = editor.getWallpaper().blocks;
  return { x, y };
}

describe("dragging a text block", () => {
  it("moves the block with the pointer, and the whole drag is one undo step", () => {
    const editor = editorWithBlockSelected();

    editor.beginMove({ x: 100, y: 800 });
    editor.updateMove({ x: 110, y: 790 });
    editor.updateMove({ x: 250, y: 700 });
    expect(startingBlockPosition(editor).x).toBe(204);
    expect(startingBlockPosition(editor).y).toBeCloseTo(609.2, 9);
    editor.updateMove({ x: 400, y: 500 });
    editor.endMove();

    expect(startingBlockPosition(editor).x).toBe(354);
    expect(startingBlockPosition(editor).y).toBeCloseTo(409.2, 9);
    expect(editor.getView().selection?.box.x).toBe(354);

    editor.undo();
    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);

    editor.redo();
    expect(startingBlockPosition(editor).x).toBe(354);
    expect(startingBlockPosition(editor).y).toBeCloseTo(409.2, 9);
  });

  it("moves in whole wallpaper pixels, keeping the block's own fraction, however finely the pointer moves", () => {
    const editor = editorWithBlockSelected();

    // At a zoom like 0.47, one screen pixel is about 2.13 wallpaper px.
    editor.beginMove({ x: 100.4, y: 800 });
    editor.updateMove({ x: 110.7, y: 802.36 });
    editor.endMove();

    expect(startingBlockPosition(editor).x).toBe(64);
    expect(startingBlockPosition(editor).y).toBeCloseTo(711.2, 9);
  });

  it("records no undo step for a click that doesn't move the block", () => {
    const editor = editorWithBlockSelected();

    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: 100.2, y: 799.9 });
    editor.endMove();

    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("moves nothing when nothing is selected", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: 300, y: 300 });
    editor.endMove();

    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("lets a block go past the wallpaper's edge, for deliberate bleed", () => {
    const editor = editorWithBlockSelected();

    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: -200, y: 1000 });
    editor.endMove();

    expect(startingBlockPosition(editor).x).toBe(-246);
    expect(startingBlockPosition(editor).y).toBeCloseTo(909.2, 9);
  });
});

describe("interrupting a drag", () => {
  it("ends the drag at an undo, which undoes it as a whole; later pointer moves move nothing", () => {
    const editor = editorWithBlockSelected();
    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: 200, y: 800 });

    editor.undo();
    editor.updateMove({ x: 300, y: 800 });
    editor.endMove();

    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
    editor.redo();
    expect(startingBlockPosition(editor)).toEqual({ x: 154, y: START.y });
  });

  it("ends the drag at a nudge, so the drag and the nudge are one step each", () => {
    const editor = editorWithBlockSelected();
    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: 200, y: 800 });

    editor.nudge("right");
    editor.updateMove({ x: 300, y: 800 });
    editor.endMove();

    expect(startingBlockPosition(editor)).toEqual({ x: 155, y: START.y });
    editor.undo();
    expect(startingBlockPosition(editor)).toEqual({ x: 154, y: START.y });
    editor.undo();
    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("ends the drag at a deselect, leaving the block where it was dragged to", () => {
    const editor = editorWithBlockSelected();
    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: 200, y: 800 });

    editor.deselect();
    editor.updateMove({ x: 300, y: 800 });
    editor.endMove();

    expect(startingBlockPosition(editor)).toEqual({ x: 154, y: START.y });
    editor.undo();
    expect(startingBlockPosition(editor)).toEqual(START);
  });

  it("drops the drag when a saved wallpaper loads: later pointer moves move nothing", () => {
    const editor = editorWithBlockSelected();
    const saved = editor.serialise();
    editor.beginMove(INSIDE_STARTING_BLOCK);
    editor.updateMove({ x: 200, y: 800 });

    editor.load(saved);
    editor.updateMove({ x: 300, y: 800 });
    editor.endMove();

    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });
});

describe("nudging a text block", () => {
  it("moves the selected block 1 px with a small step and 10 px with a large one", () => {
    const editor = editorWithBlockSelected();

    editor.nudge("right");
    expect(startingBlockPosition(editor).x).toBe(55);
    editor.nudge("down", "large");
    expect(startingBlockPosition(editor).y).toBeCloseTo(719.2, 9);
    editor.nudge("left", "large");
    expect(startingBlockPosition(editor).x).toBe(45);
    editor.nudge("up");
    expect(startingBlockPosition(editor).y).toBeCloseTo(718.2, 9);
  });

  it("makes a run of consecutive nudges one undo step", () => {
    const editor = editorWithBlockSelected();

    editor.nudge("right");
    editor.nudge("right");
    editor.nudge("up", "large");
    editor.nudge("right");

    editor.undo();
    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);

    editor.redo();
    expect(startingBlockPosition(editor).x).toBe(57);
    expect(startingBlockPosition(editor).y).toBeCloseTo(699.2, 9);
  });

  it("ends the run at a wallpaper change, so the nudges before it, the change and the nudges after it are three steps", () => {
    const editor = editorWithBlockSelected();

    editor.nudge("right");
    editor.nudge("right");
    editor.setBackground("#1E3A5F");
    editor.nudge("down");
    editor.nudge("down");

    editor.undo();
    expect(startingBlockPosition(editor)).toEqual({ x: 56, y: START.y });
    expect(editor.getWallpaper().background).toBe("#1E3A5F");
    editor.undo();
    expect(startingBlockPosition(editor)).toEqual({ x: 56, y: START.y });
    expect(editor.getWallpaper().background).toBe("#000000");
    editor.undo();
    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("keeps a colour still being previewed in the picker out of the run: they're separate steps", () => {
    const editor = editorWithBlockSelected();
    editor.setBackground("#1E3A5F", { preview: true });

    editor.nudge("right");
    editor.nudge("right");
    editor.setBackground("#1E3A5F");

    editor.undo();
    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getWallpaper().background).toBe("#1E3A5F");
    editor.undo();
    expect(editor.getWallpaper().background).toBe("#000000");
    expect(editor.getView().canUndo).toBe(false);
  });

  it("does nothing when nothing is selected", () => {
    const editor = editorWithBlockSelected();
    editor.deselect();

    editor.nudge("right");
    editor.nudge("down", "large");

    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });

  it.each<[string, (editor: ReturnType<typeof createEditor>) => void]>([
    ["selecting the block again", (editor) => editor.selectAt(INSIDE_STARTING_BLOCK)],
    ["changing an editor setting", (editor) => editor.setSettings({ gridVisible: false })],
    [
      "a click on the block that doesn't move it",
      (editor) => {
        editor.beginMove(INSIDE_STARTING_BLOCK);
        editor.endMove();
      },
    ],
  ])("ends the run at any other command, such as %s", (_, command) => {
    const editor = editorWithBlockSelected();

    editor.nudge("right");
    command(editor);
    editor.nudge("right");

    editor.undo();
    expect(startingBlockPosition(editor).x).toBe(55);
    editor.undo();
    expect(startingBlockPosition(editor).x).toBe(54);
    expect(editor.getView().canUndo).toBe(false);
  });
});

describe("setting a text block's position", () => {
  it("puts the top-left of the selected block's box at the typed X and Y, each edit one undo step", () => {
    const editor = editorWithBlockSelected();

    editor.setPosition({ x: 300 });
    expect(startingBlockPosition(editor)).toEqual({ x: 300, y: START.y });
    editor.setPosition({ y: 120.5 });
    expect(startingBlockPosition(editor)).toEqual({ x: 300, y: 120.5 });
    expect(editor.getView().selection?.box).toMatchObject({ x: 300, y: 120.5 });

    editor.undo();
    expect(startingBlockPosition(editor)).toEqual({ x: 300, y: START.y });
    editor.undo();
    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("accepts positions past the wallpaper's edge, for deliberate bleed", () => {
    const editor = editorWithBlockSelected();

    editor.setPosition({ x: -120, y: 1000 });

    expect(startingBlockPosition(editor)).toEqual({ x: -120, y: 1000 });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "ignores a coordinate that isn't a finite number (%s), as an emptied field gives, without recording a step",
    (value) => {
      const editor = editorWithBlockSelected();

      editor.setPosition({ x: value });
      editor.setPosition({ x: 300, y: value });

      expect(startingBlockPosition(editor)).toEqual({ x: 300, y: START.y });
      editor.undo();
      expect(editor.getView().canUndo).toBe(false);
    },
  );

  it("does nothing when nothing is selected", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.setPosition({ x: 300, y: 300 });

    expect(startingBlockPosition(editor)).toEqual(START);
    expect(editor.getView().canUndo).toBe(false);
  });
});
