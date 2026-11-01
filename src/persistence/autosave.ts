import type { Editor } from "@/editor";

/** The localStorage key the wallpaper and editor settings are saved under. */
const STORAGE_KEY = "text-wallpaper-maker";

/** How long changes must pause before they're saved, in ms. */
const SAVE_DELAY_MS = 500;

/**
 * Loads what was saved in this browser into the Editor, then keeps saving it
 * as it changes. Where storage is blocked, the editor opens on the starting
 * wallpaper and isn't saved.
 */
export function persistEditor(editor: Editor) {
  const storage = browserStorage();
  editor.load(readSaved(storage));
  if (storage) saveOnChange(editor, storage);
}

/** The browser's localStorage, or null where it's blocked (e.g. site data is turned off), as reading it then throws. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** What was saved, or null when nothing was or it can't be read. */
function readSaved(storage: Storage | null): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves shortly after each change, once changes pause, and straight away if
 * the page is hidden or left before then, so a refresh or a closed tab loses
 * nothing.
 */
function saveOnChange(editor: Editor, storage: Storage) {
  let pending: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(pending);
    pending = undefined;
    try {
      storage.setItem(STORAGE_KEY, editor.serialise());
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
