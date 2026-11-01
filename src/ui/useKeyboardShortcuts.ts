import { useEffect } from "react";
import type { Editor, NudgeDirection } from "@/editor";

/** Input types where the browser's own text shortcuts (like undo typing) must keep working. */
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", "password", "number"]);

/** Input types that don't use the arrow keys themselves, so arrows can nudge while one has focus. */
const NO_ARROW_INPUT_TYPES = new Set(["checkbox", "button", "submit", "reset", "color", "file"]);

const NUDGE_KEYS: Partial<Record<string, NudgeDirection>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/**
 * The editor's keyboard shortcuts, listened for on the whole window:
 * Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z redoes, Cmd/Ctrl+D duplicates the
 * selected block, Delete or Backspace deletes it, arrow keys nudge it 1 px
 * (10 px with Shift), and Escape deselects. They're left to the browser in
 * fields that use those keys themselves, so undo in a text field still undoes
 * typing, Backspace still deletes a character and arrows still move the caret.
 * Cmd/Ctrl+D never bookmarks the page, even in a field. Zooming and panning
 * keys belong to the canvas, in `useCanvasNavigation`.
 */
export function useKeyboardShortcuts(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) {
        // Typing keeps the browser's text shortcuts, but never its bookmark shortcut.
        if (isBookmarkShortcut(event)) event.preventDefault();
        return;
      }
      // `key`, not `code`, so Z is wherever the keyboard layout puts it.
      const commandKey = (event.metaKey || event.ctrlKey) && !event.altKey;
      if (commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }

      if (commandKey && !event.shiftKey && event.key.toLowerCase() === "d") {
        // Cancelled even with nothing selected, so it never bookmarks the page instead.
        event.preventDefault();
        editor.duplicate();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditable(event.target) || !editor.getView().selection) return;
        event.preventDefault();
        editor.delete();
        return;
      }

      const direction = NUDGE_KEYS[event.key];
      if (direction && !event.metaKey && !event.ctrlKey && !event.altKey) {
        // With nothing to nudge, the arrows are left to the browser, e.g. to scroll a sidebar.
        if (usesArrowKeys(event.target) || !editor.getView().selection) return;
        event.preventDefault();
        editor.nudge(direction, event.shiftKey ? "large" : "small");
        return;
      }

      if (event.key === "Escape") editor.deselect();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);
}

/** Whether `target` is where text is typed, so keys belong to it rather than to shortcuts. */
export function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

/**
 * Whether this is the browser's bookmark shortcut: Cmd+D on a Mac, where
 * Ctrl+D deletes forward in a text field, and Ctrl+D elsewhere.
 */
function isBookmarkShortcut(event: KeyboardEvent) {
  const onMac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (onMac ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "d";
}

/**
 * Whether focus is in a field or anything else editable, where Delete and
 * Backspace belong to the field, never the wallpaper.
 */
function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/** Whether the arrow keys already do something here: move a caret, step a number, or change a choice. */
function usesArrowKeys(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !NO_ARROW_INPUT_TYPES.has(target.type);
}
