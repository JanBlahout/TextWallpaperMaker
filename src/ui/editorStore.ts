import { create } from "zustand";
import { createEditor, DEFAULT_TYPOGRAPHY, type Editor, type EditorSettings, type EditorView, type Wallpaper } from "@/editor";
import { persistEditor } from "@/persistence/autosave";
import { createCanvasTextMeasurer } from "@/render/canvasTextMeasurer";
import { fontsLoadedFor, loadFontsFor } from "@/render/fontLoading";

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
 * Creates the Editor with the wallpaper saved in this browser, once its fonts
 * have loaded, so text is never measured or drawn in a fallback font. Safe to
 * call more than once.
 */
export function startEditor(): Promise<void> {
  editorStarted ??= createSavedEditor().then(
    (editor) => {
      editor.subscribe(() => {
        useEditorStore.setState(snapshotOf(editor));
        remeasureOnceFontsLoad(editor);
      });
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

async function createSavedEditor() {
  // The starting wallpaper is measured as the Editor is created, and again on New wallpaper.
  await loadFontsFor([DEFAULT_TYPOGRAPHY]);
  const editor = createEditor({ measurer: createCanvasTextMeasurer() });
  persistEditor(editor);
  // Saved text blocks may use other fonts.
  await loadFontsFor(editor.getWallpaper().blocks);
  return editor;
}

/**
 * A newly chosen font (or a new character in a hosted font) may still be
 * loading when the Editor measures its block, which then gets the fallback
 * font's box. The renderer waits for the font before drawing; this measures
 * the blocks again once it has loaded, so the box matches what's drawn.
 */
function remeasureOnceFontsLoad(editor: Editor) {
  const { blocks } = editor.getWallpaper();
  if (fontsLoadedFor(blocks)) return;
  loadFontsFor(blocks).then(
    () => useEditorStore.setState(snapshotOf(editor)),
    (error: unknown) => console.error(error),
  );
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
