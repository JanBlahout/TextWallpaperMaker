import type { Editor } from "@/editor";

/** The localStorage key the wallpaper and editor settings are saved under. */
const STORAGE_KEY = "text-wallpaper-maker";

/** How long changes must pause before they're saved, in ms. */
const SAVE_DELAY_MS = 500;

/**
 * Loads what was saved in this browser into the Editor, then saves it shortly
 * after each change, and straight away if the page is hidden or left before
 * then, so a refresh or a closed tab loses nothing. Where storage is blocked,
 * the editor opens on the starting wallpaper and isn't saved.
 */
export function persistEditor(editor: Editor) {
  let storage: Storage | null = null;
  let saved: string | null = null;
  try {
    storage = window.localStorage;
    saved = storage.getItem(STORAGE_KEY);
  } catch {
    // Storage is blocked, e.g. site data is turned off: there's nothing to load.
  }
  editor.load(saved);
  if (!storage) return;

  const store = storage;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(pending);
    pending = undefined;
    try {
      store.setItem(STORAGE_KEY, editor.serialise());
    } catch (error) {
      // Storage is full or blocked. Editing carries on; the next change tries again.
      console.warn("The wallpaper could not be saved.", error);
    }
  };
  const saveIfPending = () => {
    if (pending !== undefined) save();
  };

  editor.subscribe(() => {
    clearTimeout(pending);
    pending = setTimeout(save, SAVE_DELAY_MS);
  });
  window.addEventListener("pagehide", saveIfPending);
  document.addEventListener("visibilitychange", saveIfPending);
}
