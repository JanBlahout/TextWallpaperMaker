import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

describe("undo and redo", () => {
  it("makes a committed background change exactly one undo step", () => {
    const editor = newEditor();

    editor.setBackground("#1E3A5F");
    expect(editor.getWallpaper().background).toBe("#1E3A5F");

    editor.undo();
    expect(editor.getWallpaper().background).toBe("#000000");
    expect(editor.getView().canUndo).toBe(false);
  });

  it("makes previews followed by a commit one undo step, like moving around inside a colour picker and releasing it", () => {
    const editor = newEditor();

    editor.setBackground("#101010", { preview: true });
    editor.setBackground("#202020", { preview: true });
    expect(editor.getWallpaper().background).toBe("#202020");
    editor.setBackground("#303030", { preview: true });
    editor.setBackground("#303030");

    editor.undo();
    expect(editor.getWallpaper().background).toBe("#000000");
    expect(editor.getView().canUndo).toBe(false);

    editor.redo();
    expect(editor.getWallpaper().background).toBe("#303030");
  });

  it("records no step for a commit that leaves the wallpaper as it was", () => {
    const editor = newEditor();
    editor.setBackground("#1E3A5F");

    editor.setBackground("#1E3A5F");
    editor.setBackground("#7A1F1F", { preview: true });
    editor.setBackground("#1E3A5F");

    editor.undo();
    expect(editor.getWallpaper().background).toBe("#000000");
  });

  it("undoes a change that is still being previewed as its own step", () => {
    const editor = newEditor();
    editor.setBackground("#1E3A5F");
    editor.setBackground("#7A1F1F", { preview: true });
    expect(editor.getView().canUndo).toBe(true);

    editor.undo();
    expect(editor.getWallpaper().background).toBe("#1E3A5F");

    editor.redo();
    expect(editor.getWallpaper().background).toBe("#7A1F1F");
  });

  it("restores each wallpaper exactly on an undo and redo round trip", () => {
    const editor = newEditor();
    const starting = editor.getWallpaper();
    editor.setBackground("#1E3A5F");
    editor.setBackground("#7A1F1F");
    const latest = editor.getWallpaper();

    editor.undo();
    editor.undo();
    expect(editor.getWallpaper()).toEqual(starting);
    expect(editor.getView().canRedo).toBe(true);

    editor.redo();
    expect(editor.getWallpaper().background).toBe("#1E3A5F");
    editor.redo();
    expect(editor.getWallpaper()).toEqual(latest);
    expect(editor.getView().canRedo).toBe(false);
  });

  it("records only wallpaper changes: editor settings are never an undo step, and undo and redo leave them alone", () => {
    const editor = newEditor();
    editor.setSettings({ gridColumns: 6, gridVisible: false });
    expect(editor.getView().canUndo).toBe(false);

    editor.setBackground("#1E3A5F");
    editor.setSettings({ safeMargin: 10 });
    editor.undo();

    expect(editor.getWallpaper().background).toBe("#000000");
    expect(editor.getView().canUndo).toBe(false);
    expect(editor.getSettings()).toMatchObject({ gridColumns: 6, gridVisible: false, safeMargin: 10 });

    editor.redo();
    expect(editor.getWallpaper().background).toBe("#1E3A5F");
    expect(editor.getSettings()).toMatchObject({ gridColumns: 6, gridVisible: false, safeMargin: 10 });
  });

  it("clears the redo history when a new change follows an undo", () => {
    const editor = newEditor();
    editor.setBackground("#1E3A5F");
    editor.undo();

    editor.setBackground("#7A1F1F");
    expect(editor.getView().canRedo).toBe(false);

    editor.redo();
    expect(editor.getWallpaper().background).toBe("#7A1F1F");
    editor.undo();
    expect(editor.getWallpaper().background).toBe("#000000");
  });
});

describe("subscribing to changes", () => {
  it("tells subscribers about each change, preview, undo and redo, until they unsubscribe", () => {
    const editor = newEditor();
    const seen: string[] = [];
    const unsubscribe = editor.subscribe(() => seen.push(editor.getWallpaper().background));

    editor.setBackground("#101010", { preview: true });
    editor.setBackground("#202020");
    editor.undo();
    editor.redo();
    unsubscribe();
    editor.setBackground("#303030");

    expect(seen).toEqual(["#101010", "#202020", "#000000", "#202020"]);
  });
});
