import { useEffect } from "react";
import type { Editor } from "@/editor";

/** Input types where the browser's own text shortcuts (like undo typing) must keep working. */
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", "email", "password", "number"]);

/**
 * The editor's keyboard shortcuts, listened for on the whole window:
 * Cmd/Ctrl+Z undoes and Cmd/Ctrl+Shift+Z redoes. They're left to the browser
 * while typing in a text field, so undo there still undoes typing.
 */
export function useKeyboardShortcuts(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntry(event.target)) return;
      // `key`, not `code`, so Z is wherever the keyboard layout puts it.
      const commandKey = (event.metaKey || event.ctrlKey) && !event.altKey;
      if (commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);
}

function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}
