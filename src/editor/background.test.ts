import { describe, expect, it } from "vitest";
import { createEditor } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

function newEditor() {
  return createEditor({ measurer: fakeTextMeasurer });
}

describe("the background colour", () => {
  it.each([
    ["#1E3A5F", "#1E3A5F"],
    ["#1e3a5f", "#1E3A5F"],
    ["1e3a5f", "#1E3A5F"],
    ["#fff", "#FFFFFF"],
    ["a1c", "#AA11CC"],
    ["  #1E3A5F ", "#1E3A5F"],
  ])("accepts %j as %s", (input, stored) => {
    const editor = newEditor();

    editor.setBackground(input);

    expect(editor.getWallpaper().background).toBe(stored);
  });

  it.each(["", "blue", "#12345", "#1234567", "#GGGGGG", "#1E3A5F80", "# 1E3A5F"])(
    "rejects %j without changing the wallpaper or recording a step",
    (input) => {
      const editor = newEditor();
      const before = editor.getWallpaper();

      editor.setBackground(input, { preview: true });
      editor.setBackground(input);

      expect(editor.getWallpaper()).toEqual(before);
      expect(editor.getView().canUndo).toBe(false);
    },
  );
});
