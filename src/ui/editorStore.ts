import { create } from "zustand";
import { createEditor, DEFAULT_TYPOGRAPHY, type Editor, type EditorSettings, type EditorView, type Wallpaper } from "@/editor";
import { createCanvasTextMeasurer } from "@/render/canvasTextMeasurer";
import { loadFontsFor } from "@/render/fontLoading";

/** What React reads from the Editor, refreshed after every change so selectors see new objects. */
interface EditorSnapshot {
  wallpaper: Wallpaper;
  settings: EditorSettings;
  view: EditorView;
}

type EditorStore =
  | { phase: "loading"; editor: null; error: null }
  | ({ phase: "ready"; editor: Editor; error: null } & EditorSnapshot)
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
    () => {
      const editor = createEditor({ measurer: createCanvasTextMeasurer() });
      editor.subscribe(() => useEditorStore.setState(snapshotOf(editor)));
      useEditorStore.setState({ phase: "ready", editor, error: null, ...snapshotOf(editor) });
    },
    (error: unknown) =>
      useEditorStore.setState({
        phase: "failed",
        error: error instanceof Error ? error.message : "The editor could not start.",
      }),
  );
  return editorStarted;
}

function snapshotOf(editor: Editor): EditorSnapshot {
  return { wallpaper: editor.getWallpaper(), settings: editor.getSettings(), view: editor.getView() };
}

/** The Editor, to send commands to, or null until it has started. */
export function useEditor() {
  return useEditorStore((state) => state.editor);
}

/** The current wallpaper, or null until the Editor has started. */
export function useWallpaper() {
  return useEditorStore((state) => (state.phase === "ready" ? state.wallpaper : null));
}

/** The current editor settings, or null until the Editor has started. */
export function useSettings() {
  return useEditorStore((state) => (state.phase === "ready" ? state.settings : null));
}

/** The Editor's derived view, or null until the Editor has started. */
export function useView() {
  return useEditorStore((state) => (state.phase === "ready" ? state.view : null));
}
