import { describe, expect, it } from "vitest";
import { createEditor, type Editor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

describe("saving and loading", () => {
  it("loads a saved wallpaper and editor settings exactly as they were, without the undo history", () => {
    const saving = newEditor();
    saving.setBackground("#1E3A5F");
    saving.setSettings({
      safeMargin: 8,
      gridColumns: 6,
      gridVisible: false,
      safeAreaVisible: false,
      snapping: false,
      alignTarget: "wallpaper",
      zoom: 2,
      pan: { x: 400, y: 300 },
    });

    const loading = newEditor();
    loading.load(saving.serialise());

    expect(loading.getWallpaper()).toEqual(saving.getWallpaper());
    expect(loading.getWallpaper().background).toBe("#1E3A5F");
    expect(loading.getSettings()).toEqual({
      safeMargin: 8,
      gridColumns: 6,
      gridVisible: false,
      safeAreaVisible: false,
      snapping: false,
      alignTarget: "wallpaper",
      zoom: 2,
      pan: { x: 400, y: 300 },
    });
    expect(loading.getView().canUndo).toBe(false);
    expect(loading.getView().canRedo).toBe(false);
  });

  it.each([
    ["nothing saved", null],
    ["an empty string", ""],
    ["text that isn't JSON", "DISCIPLINE EQUALS FREEDOM."],
    ["JSON that isn't an object", "42"],
    ["JSON null", "null"],
    ["an object without a version", "{}"],
  ])("loads the starting wallpaper and default editor settings from %s", (_, saved) => {
    const editor = changedEditor();

    editor.load(saved);

    expectStartingState(editor);
  });

  it.each<[string, (saved: SavedData) => void]>([
    ["a newer version", (saved) => (saved.version = 2)],
    ["the version as text", (saved) => (saved.version = "1")],
    ["no wallpaper", (saved) => delete saved.wallpaper],
    ["no editor settings", (saved) => delete saved.settings],
    ["a background that isn't a hex colour", (saved) => (saved.wallpaper.background = "navy")],
    ["a resolution narrower than 320 px", (saved) => (saved.wallpaper.resolution.width = 319)],
    ["a resolution taller than 8192 px", (saved) => (saved.wallpaper.resolution.height = 8193)],
    ["a fractional resolution", (saved) => (saved.wallpaper.resolution.width = 1920.5)],
    ["text blocks that aren't a list", (saved) => (saved.wallpaper.blocks = {})],
    ["a text block in a font the editor doesn't have", (saved) => (saved.wallpaper.blocks[0].fontId = "comic-sans")],
    ["a text block in a weight its font doesn't have", (saved) => (saved.wallpaper.blocks[0].fontWeight = 700)],
    ["a text block without text", (saved) => delete saved.wallpaper.blocks[0].text],
    ["a text block with a font size of 0", (saved) => (saved.wallpaper.blocks[0].fontSize = 0)],
    ["a text block with an opacity above 100", (saved) => (saved.wallpaper.blocks[0].opacity = 101)],
    ["a text block with an unknown line alignment", (saved) => (saved.wallpaper.blocks[0].align = "justify")],
    ["a text block whose position is text", (saved) => (saved.wallpaper.blocks[0].x = "54")],
    ["two text blocks with the same id", (saved) => saved.wallpaper.blocks.push(saved.wallpaper.blocks[0])],
    ["a safe margin the editor doesn't offer", (saved) => (saved.settings.safeMargin = 7)],
    ["a grid column count above 48", (saved) => (saved.settings.gridColumns = 49)],
    ["a visibility toggle that isn't true or false", (saved) => (saved.settings.gridVisible = "yes")],
    ["an unknown align target", (saved) => (saved.settings.alignTarget = "page")],
    ["a zoom of 0", (saved) => (saved.settings.zoom = 0)],
    ["a pan without a y", (saved) => delete saved.settings.pan.y],
  ])("loads the starting wallpaper and default editor settings from saved data with %s", (_, corrupt) => {
    const saved: SavedData = JSON.parse(changedEditor().serialise());
    corrupt(saved);
    const editor = changedEditor();

    editor.load(JSON.stringify(saved));

    expectStartingState(editor);
  });

  it("loads a saved wallpaper with no text blocks", () => {
    const saved: SavedData = JSON.parse(changedEditor().serialise());
    saved.wallpaper.blocks = [];
    const editor = newEditor();

    editor.load(JSON.stringify(saved));

    expect(editor.getWallpaper()).toEqual({
      resolution: { width: 1920, height: 1080 },
      background: "#1E3A5F",
      blocks: [],
    });
  });
});

/** Saved data parsed back from JSON, so a test can damage it. */
type SavedData = any;

/** An editor whose wallpaper and settings both differ from the starting ones. */
function changedEditor() {
  const editor = newEditor();
  editor.setBackground("#1E3A5F");
  editor.setSettings({ safeMargin: 10, gridColumns: 6 });
  return editor;
}

/** The editor shows what a newly opened editor shows, with nothing to undo. */
function expectStartingState(editor: Editor) {
  const opened = newEditor();
  expect(editor.getWallpaper()).toEqual(opened.getWallpaper());
  expect(editor.getSettings()).toEqual(opened.getSettings());
  expect(editor.getView().canUndo).toBe(false);
}
