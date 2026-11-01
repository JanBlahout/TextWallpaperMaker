import { describe, expect, it } from "vitest";
import { createEditor, DEFAULT_TYPOGRAPHY } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/** Inside the starting block's box, from (54, 709.2) to (630, 1026) with the fake measurer; see editor.test.ts. */
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

describe("adding text", () => {
  it("adds a TEXT block in the default OCR A style, centred in the safe area, when nothing is selected", () => {
    const editor = newEditor();

    editor.addText();

    const blocks = editor.getWallpaper().blocks;
    expect(blocks).toHaveLength(2);
    const added = blocks[1];
    expect(added).toMatchObject({ text: "TEXT", ...DEFAULT_TYPOGRAPHY });
    // Worked example with the fake measurer: TEXT at 96 px is 4 × 57.6 = 230.4 px
    // wide and 1.1 × 96 = 105.6 px tall. The safe area runs from (54, 54) and is
    // 1812 × 972, so the box's top-left is at 54 + (1812 − 230.4) / 2 = 844.8 and
    // 54 + (972 − 105.6) / 2 = 487.2, and its centre is the wallpaper's (960, 540).
    expect(added.x).toBeCloseTo(844.8, 9);
    expect(added.y).toBeCloseTo(487.2, 9);
  });

  it("copies the selected block's style, but not its text or position, and centres the new box in that style", () => {
    const editor = editorWithStyledBlockSelected();

    editor.addText();

    const added = editor.getWallpaper().blocks.at(-1)!;
    expect(added).toMatchObject({ text: "TEXT", ...STYLE });
    // TEXT at 48 px with 10% (4.8 px) letter spacing between characters is
    // 4 × 28.8 + 3 × 4.8 = 129.6 px wide, and 1.5 × 48 = 72 px tall, so it sits
    // at 54 + (1812 − 129.6) / 2 = 895.2 and 54 + (972 − 72) / 2 = 504.
    expect(added.x).toBeCloseTo(895.2, 9);
    expect(added.y).toBeCloseTo(504, 9);
  });

  it("selects the new block and opens its text for editing straight away", () => {
    const editor = newEditor();
    editor.selectAt(INSIDE_STARTING_BLOCK);

    editor.addText();

    const added = editor.getWallpaper().blocks.at(-1)!;
    const { selection, editing } = editor.getView();
    expect(selection?.id).toBe(added.id);
    expect(editing?.id).toBe(added.id);
    expect(editing?.box.x).toBeCloseTo(844.8, 9);
    expect(editing?.box.width).toBeCloseTo(230.4, 9);
  });

  it("puts each added block on top of the earlier ones, so clicking where they overlap selects the latest", () => {
    const editor = newEditor();

    editor.addText();
    const first = editor.getView().selection!.id;
    editor.addText();
    const second = editor.getView().selection!.id;
    editor.deselect();

    expect(second).not.toBe(first);
    expect(editor.getWallpaper().blocks.map(({ id }) => id)).toEqual(["block-1", first, second]);
    editor.selectAt({ x: 960, y: 540 });
    expect(editor.getView().selection?.id).toBe(second);
  });

  it("gives an added block an id no block in a loaded wallpaper has", () => {
    const editor = newEditor();
    const saved = JSON.parse(editor.serialise());
    saved.wallpaper.blocks = ["block-2", "block-3"].map((id, i) => ({ ...saved.wallpaper.blocks[0], id, y: i * 300 }));
    editor.load(JSON.stringify(saved));

    editor.addText();

    const ids = editor.getWallpaper().blocks.map(({ id }) => id);
    expect(new Set(ids).size).toBe(3);
  });
});

/** A style unlike the default in every field the font allows (OCR A has one weight). */
const STYLE = {
  fontId: "ocr-a",
  fontSize: 48,
  fontWeight: 400,
  letterSpacing: 10,
  lineHeight: 1.5,
  align: "right",
  color: "#FF5A36",
  opacity: 60,
  uppercase: false,
} as const;

/** An editor showing one block in STYLE, "quiet", at (100, 100), selected. */
function editorWithStyledBlockSelected() {
  const editor = newEditor();
  const saved = JSON.parse(editor.serialise());
  saved.wallpaper.blocks = [{ id: "styled", text: "quiet", ...STYLE, x: 100, y: 100 }];
  editor.load(JSON.stringify(saved));
  editor.selectAt({ x: 110, y: 110 });
  expect(editor.getView().selection?.id).toBe("styled");
  return editor;
}
