import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

describe("New wallpaper", () => {
  it("resets the wallpaper to the starting wallpaper as one undo step, so undo restores the previous wallpaper", () => {
    const editor = newEditor();
    const starting = editor.getWallpaper();
    editor.setBackground("#1E3A5F");
    editor.setBackground("#7A1F1F");
    const previous = editor.getWallpaper();

    editor.newWallpaper();
    expect(editor.getWallpaper()).toEqual(starting);

    editor.undo();
    expect(editor.getWallpaper()).toEqual(previous);

    editor.redo();
    expect(editor.getWallpaper()).toEqual(starting);

    editor.undo();
    editor.undo();
    expect(editor.getWallpaper().background).toBe("#1E3A5F");
  });

  it("leaves the editor settings as they are", () => {
    const editor = newEditor();
    editor.setSettings({ gridColumns: 6, gridVisible: false, snapping: false, zoom: 2 });
    editor.setBackground("#1E3A5F");

    editor.newWallpaper();

    expect(editor.getSettings()).toMatchObject({ gridColumns: 6, gridVisible: false, snapping: false, zoom: 2 });
  });

  it("places the starting block at the bottom-left of the safe area as it is now", () => {
    const editor = newEditor();
    editor.setSettings({ safeMargin: 10 });
    editor.setBackground("#1E3A5F");

    editor.newWallpaper();

    // 10% of 1080 is 108 px; the fake measurer makes the box 316.8 px tall,
    // so its top is at 1080 − 108 − 316.8 = 655.2.
    const [block] = editor.getWallpaper().blocks;
    expect(block.x).toBe(108);
    expect(block.y).toBeCloseTo(655.2, 9);
  });

  it("records no undo step when the wallpaper is already the starting wallpaper, even just after loading it", () => {
    const loaded = newEditor();
    loaded.load(newEditor().serialise());

    loaded.newWallpaper();

    expect(loaded.getView().canUndo).toBe(false);
  });
});
