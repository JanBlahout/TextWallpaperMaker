import { create } from "zustand";
import { createEditor, DEFAULT_TYPOGRAPHY, type Editor } from "@/editor";
import { createCanvasTextMeasurer } from "@/render/canvasTextMeasurer";
import { loadFontsFor } from "@/render/fontLoading";

type EditorStore =
  | { phase: "loading"; editor: null; error: null }
  | { phase: "ready"; editor: Editor; error: null }
  | { phase: "failed"; editor: null; error: string };

/** Holds the Editor for React. The UI only reads from it and sends it commands. */
export const useEditorStore = create<EditorStore>()(() => ({ phase: "loading", editor: null, error: null }));

let editorStarted: Promise<void> | undefined;

/**
 * Creates the Editor once the starting wallpaper's font has loaded, so text is
 * never measured or drawn in a fallback font. Safe to call more than once.
 */
export function startEditor(): Promise<void> {
  editorStarted ??= loadFontsFor([DEFAULT_TYPOGRAPHY]).then(
    () => useEditorStore.setState({ phase: "ready", editor: createEditor({ measurer: createCanvasTextMeasurer() }) }),
    (error: unknown) =>
      useEditorStore.setState({
        phase: "failed",
        error: error instanceof Error ? error.message : "The editor could not start.",
      }),
  );
  return editorStarted;
}

/** The current wallpaper, or null until the Editor has started. */
export function useWallpaper() {
  return useEditorStore((state) => state.editor?.getWallpaper() ?? null);
}
