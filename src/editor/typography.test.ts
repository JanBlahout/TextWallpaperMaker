import { describe, expect, it } from "vitest";
import { blockLines, createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

/** Inside the starting block's box, which runs from (54, 709.2) to (630, 1026) with the fake measurer. */
const INSIDE_STARTING_BLOCK = { x: 100, y: 800 };

/** An editor with the starting block (DISCIPLINE / EQUALS / FREEDOM. in OCR A, 96 px) selected. */
function editorWithBlockSelected() {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  editor.selectAt(INSIDE_STARTING_BLOCK);
  return editor;
}

/** An editor whose starting block has `text` as typed instead, and is selected. */
function editorWithTextSelected(text: string) {
  const editor = createEditor({ measurer: fakeTextMeasurer });
  const saved = JSON.parse(editor.serialise());
  saved.wallpaper.blocks[0].text = text;
  editor.load(JSON.stringify(saved));
  editor.selectAt(INSIDE_STARTING_BLOCK);
  return editor;
}

function startingBlock(editor: ReturnType<typeof createEditor>) {
  return editor.getWallpaper().blocks[0];
}

describe("changing a text block's typography", () => {
  it("re-measures the block's box: at 48 px, DISCIPLINE is 10 × 0.6 × 48 = 288 px wide and three lines are 3 × 1.1 × 48 = 158.4 px tall", () => {
    const editor = editorWithBlockSelected();

    editor.setTypography({ fontSize: 48 });

    expect(startingBlock(editor).fontSize).toBe(48);
    const box = editor.getView().selection?.box;
    expect(box?.width).toBeCloseTo(288, 9);
    expect(box?.height).toBeCloseTo(158.4, 9);
  });

  it.each([
    // DISCIPLINE's ten characters have nine gaps: 576 + 9 × 9.6 = 662.4.
    { change: { letterSpacing: 10 }, width: 662.4, height: 316.8 },
    { change: { lineHeight: 1.5 }, width: 576, height: 432 },
  ])("re-measures the block's box after $change", ({ change, width, height }) => {
    const editor = editorWithBlockSelected();

    editor.setTypography(change);

    const box = editor.getView().selection?.box;
    expect(box?.width).toBeCloseTo(width, 9);
    expect(box?.height).toBeCloseTo(height, 9);
  });

  it("makes each committed change one undo step", () => {
    const editor = editorWithBlockSelected();

    editor.setTypography({ fontSize: 48 });
    editor.setTypography({ lineHeight: 1.4 });

    editor.undo();
    expect(startingBlock(editor)).toMatchObject({ fontSize: 48, lineHeight: 1.1 });
    editor.undo();
    expect(startingBlock(editor)).toMatchObject({ fontSize: 96, lineHeight: 1.1 });
    expect(editor.getView().canUndo).toBe(false);

    editor.redo();
    editor.redo();
    expect(startingBlock(editor)).toMatchObject({ fontSize: 48, lineHeight: 1.4 });
  });

  it("shows previews (moving around a colour picker, dragging the opacity slider) and records them as one step once committed", () => {
    const editor = editorWithBlockSelected();

    editor.setTypography({ opacity: 80 }, { preview: true });
    editor.setTypography({ opacity: 55 }, { preview: true });
    expect(startingBlock(editor).opacity).toBe(55);
    editor.setTypography({ opacity: 40 });

    editor.undo();
    expect(startingBlock(editor).opacity).toBe(100);
    expect(editor.getView().canUndo).toBe(false);
  });

  it("keeps a typed text that isn't a number, a size or line height of 0 or less, an unknown font or line alignment, and invalid hex from changing anything", () => {
    const editor = editorWithBlockSelected();
    const before = editor.getWallpaper();

    editor.setTypography({ fontSize: Number.NaN });
    editor.setTypography({ fontSize: 0 });
    editor.setTypography({ fontSize: -12 });
    editor.setTypography({ lineHeight: 0 });
    editor.setTypography({ letterSpacing: Number.NaN });
    editor.setTypography({ opacity: Number.NaN });
    editor.setTypography({ fontId: "comic-sans" });
    editor.setTypography({ align: "justify" as never });
    editor.setTypography({ color: "#12345" });

    expect(editor.getWallpaper()).toEqual(before);
    expect(editor.getView().canUndo).toBe(false);
  });

  it.each([
    { typed: 150, kept: 100 },
    { typed: -20, kept: 0 },
    { typed: 37.5, kept: 37.5 },
  ])("keeps opacity within 0–100%: $typed becomes $kept", ({ typed, kept }) => {
    const editor = editorWithBlockSelected();

    editor.setTypography({ opacity: typed });

    expect(startingBlock(editor).opacity).toBe(kept);
  });

  it("stores a colour typed in any case, or as #RGB, as uppercase #RRGGBB", () => {
    const editor = editorWithBlockSelected();

    editor.setTypography({ color: "#e6c" });

    expect(startingBlock(editor).color).toBe("#EE66CC");
  });

  it("does nothing when nothing is selected", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });
    const before = editor.getWallpaper();

    editor.setTypography({ fontSize: 48 });

    expect(editor.getWallpaper()).toEqual(before);
    expect(editor.getView().canUndo).toBe(false);
  });
});

describe("uppercase", () => {
  it("changes only how the text looks: the text as typed is kept, and comes back when it's turned off", () => {
    const editor = editorWithTextSelected("Get up.\nDust off.");

    expect(blockLines(startingBlock(editor))).toEqual(["GET UP.", "DUST OFF."]);
    editor.setTypography({ uppercase: false });
    expect(blockLines(startingBlock(editor))).toEqual(["Get up.", "Dust off."]);
    editor.setTypography({ uppercase: true });

    expect(startingBlock(editor).text).toBe("Get up.\nDust off.");
    expect(JSON.parse(editor.serialise()).wallpaper.blocks[0].text).toBe("Get up.\nDust off.");
  });

  it("re-measures the box from the text as it looks: Straße is 6 characters, STRASSE 7", () => {
    const editor = editorWithTextSelected("Straße");
    expect(editor.getView().selection?.box.width).toBeCloseTo(7 * 0.6 * 96, 9);

    editor.setTypography({ uppercase: false });

    expect(editor.getView().selection?.box.width).toBeCloseTo(6 * 0.6 * 96, 9);
    expect(startingBlock(editor).text).toBe("Straße");
  });
});

describe("the font weight", () => {
  it.each([
    { from: "inter", weight: 900, to: "ibm-plex-mono", expected: 700 },
    { from: "ibm-plex-mono", weight: 600, to: "space-mono", expected: 700 },
    { from: "ibm-plex-mono", weight: 500, to: "courier-prime", expected: 400 },
    { from: "inter", weight: 200, to: "helvetica-arial", expected: 400 },
    { from: "space-mono", weight: 700, to: "ocr-a", expected: 400 },
    { from: "inter", weight: 300, to: "ibm-plex-mono", expected: 300 },
  ])(
    "switching from $from at $weight to $to picks the nearest weight $to has: $expected",
    ({ from, weight, to, expected }) => {
      const editor = editorWithBlockSelected();
      editor.setTypography({ fontId: from });
      editor.setTypography({ fontWeight: weight });

      editor.setTypography({ fontId: to });

      expect(startingBlock(editor)).toMatchObject({ fontId: to, fontWeight: expected });
    },
  );

  it("switches font and weight in one step, the weight the new font's", () => {
    const editor = editorWithBlockSelected();

    editor.setTypography({ fontId: "space-mono", fontWeight: 700 });

    expect(startingBlock(editor)).toMatchObject({ fontId: "space-mono", fontWeight: 700 });
    editor.undo();
    expect(startingBlock(editor)).toMatchObject({ fontId: "ocr-a", fontWeight: 400 });
  });

  it("ignores a weight the block's font doesn't have: OCR A has only 400", () => {
    const editor = editorWithBlockSelected();

    editor.setTypography({ fontWeight: 700 });

    expect(startingBlock(editor).fontWeight).toBe(400);
    expect(editor.getView().canUndo).toBe(false);
  });
});
