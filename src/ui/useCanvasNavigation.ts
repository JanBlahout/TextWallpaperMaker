import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { panBy, viewportOf, zoomAt, type Editor, type Point, type Size, type Viewport } from "@/editor";
import { isTextEntry } from "./useKeyboardShortcuts";

/** Screen px per line, for wheels that scroll by lines (as Firefox does with a mouse). */
const WHEEL_LINE_PX = 16;
/** Cmd/Ctrl+scroll zooms by e^(−deltaY × this), so a pinch zooms about as far as the fingers spread. */
const WHEEL_ZOOM_SPEED = 0.01;
/** The most one wheel event zooms by, as a delta: a mouse wheel's notch zooms about 1.35×, not 2.7×. */
const MAX_WHEEL_ZOOM_DELTA = 30;

/** Safari's own pinch event, which it sends instead of a Ctrl+scroll. */
interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

export interface CanvasNavigation {
  /** Starts a Space+drag pan; returns whether it did, so the press does nothing else. */
  beginPan(event: PointerEvent<HTMLElement>): boolean;
  /** Pans along with the pointer; returns whether a pan is under way. */
  updatePan(event: PointerEvent<HTMLElement>): boolean;
  /** Finishes a Space+drag pan; returns whether there was one. */
  endPan(): boolean;
  /** The cursor class for the canvas: a hand while Space is held. */
  cursor: string;
}

/**
 * Zooming and panning the canvas, which fills `containerRef`'s element and is
 * `size` screen px: Cmd/Ctrl+scroll and trackpad pinch zoom towards the
 * pointer, scrolling and Space+drag pan, Shift+1 fits the wallpaper to the
 * canvas and Shift+0 shows it at 100%. Zoom and pan are editor settings, so
 * none of this is an undo step.
 */
export function useCanvasNavigation(
  editor: Editor,
  containerRef: RefObject<HTMLElement | null>,
  size: Size | null,
): CanvasNavigation {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  /** The Space+drag under way: its pointer, where it was pressed (in screen px), and the view then. */
  const spaceDrag = useRef<{ pointerId: number; from: Point; viewport: Viewport } | null>(null);
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // Wheel and pinch. Listened for directly, as React's wheel listener can't prevent the page from zooming.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    /** The view as a Safari pinch started; Safari's scale is relative to it. */
    let pinchStart: Viewport | null = null;

    const onWheel = (event: WheelEvent) => {
      const viewport = viewportNow(editor, sizeRef.current);
      if (!viewport) return;
      event.preventDefault();
      const delta = wheelDelta(event, viewport.canvas);
      if (event.ctrlKey || event.metaKey) {
        if (pinchStart) return;
        const pointer = screenPointOf(container, viewport.canvas, event);
        if (!pointer) return;
        const step = Math.min(Math.max(delta.y, -MAX_WHEEL_ZOOM_DELTA), MAX_WHEEL_ZOOM_DELTA);
        editor.setSettings(zoomAt(viewport, viewport.zoom * Math.exp(-step * WHEEL_ZOOM_SPEED), pointer));
      } else {
        editor.setSettings(panBy(viewport, delta));
      }
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      pinchStart = viewportNow(editor, sizeRef.current);
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      if (!pinchStart) return;
      const gesture = event as GestureEvent;
      const pointer = screenPointOf(container, pinchStart.canvas, gesture);
      if (pointer) editor.setSettings(zoomAt(pinchStart, pinchStart.zoom * gesture.scale, pointer));
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      pinchStart = null;
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("gesturestart", onGestureStart);
    container.addEventListener("gesturechange", onGestureChange);
    container.addEventListener("gestureend", onGestureEnd);
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("gesturestart", onGestureStart);
      container.removeEventListener("gesturechange", onGestureChange);
      container.removeEventListener("gestureend", onGestureEnd);
    };
  }, [editor, containerRef]);

  // Space, Shift+1 and Shift+0, on the whole window like the other shortcuts.
  useEffect(() => {
    /** The element the keyboard last moved the focus to; one focused by a click doesn't keep Space. */
    let keyboardFocused: EventTarget | null = null;
    const onFocusIn = (event: FocusEvent) => {
      // Asked as focus arrives: once a key is pressed, the browser counts any focus as from the keyboard.
      keyboardFocused = event.target instanceof Element && event.target.matches(":focus-visible") ? event.target : null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const modified = event.metaKey || event.ctrlKey || event.altKey;
      if (event.code === "Space" && !modified && !usesSpaceKey(event.target, keyboardFocused)) {
        // Holding Space would otherwise scroll the page.
        event.preventDefault();
        // A control focused by a click would be pressed again when Space comes up.
        if (event.target instanceof HTMLElement) event.target.blur();
        setSpaceHeld(true);
        return;
      }
      // `code`, not `key`: Shift changes the key to "!" or ")" on some layouts and leaves it a digit on others.
      if (!event.shiftKey || modified || isTextEntry(event.target)) return;
      if (event.code === "Digit1") {
        event.preventDefault();
        editor.setSettings({ zoom: "fit" });
      } else if (event.code === "Digit0") {
        const viewport = viewportNow(editor, sizeRef.current);
        if (!viewport) return;
        event.preventDefault();
        editor.setSettings(zoomAt(viewport, 1));
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    // A Space released in another window never arrives here.
    const onBlur = () => setSpaceHeld(false);

    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [editor]);

  return {
    beginPan(event) {
      if (!spaceHeld) return false;
      const viewport = viewportNow(editor, sizeRef.current);
      const from = viewport && screenPointOf(event.currentTarget, viewport.canvas, event);
      if (viewport && from) {
        event.currentTarget.setPointerCapture(event.pointerId);
        spaceDrag.current = { pointerId: event.pointerId, from, viewport };
        setPanning(true);
      }
      return true;
    },
    updatePan(event) {
      const drag = spaceDrag.current;
      if (!drag) return false;
      const to = event.pointerId === drag.pointerId && screenPointOf(event.currentTarget, drag.viewport.canvas, event);
      // The wallpaper follows the pointer, so the view moves the other way.
      if (to) editor.setSettings(panBy(drag.viewport, { x: drag.from.x - to.x, y: drag.from.y - to.y }));
      return true;
    },
    endPan() {
      if (!spaceDrag.current) return false;
      spaceDrag.current = null;
      setPanning(false);
      return true;
    },
    cursor: panning ? "cursor-grabbing" : spaceHeld ? "cursor-grab" : "",
  };
}

/**
 * The view as it is now, read from the Editor rather than from the last
 * render, so each of a quick run of wheel events builds on the one before.
 * Null until the canvas has a size.
 */
function viewportNow(editor: Editor, canvas: Size | null): Viewport | null {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  return viewportOf(editor.getWallpaper().resolution, editor.getSettings(), canvas);
}

/**
 * The point under the pointer in screen px: from the top-left corner of
 * `element`, which the canvas fills, scaled to the canvas's size in case its
 * layout box differs from it by a fraction of a pixel. Null while the element
 * isn't laid out (e.g. hidden in a narrow window), as no point is under the pointer then.
 */
export function screenPointOf(
  element: Element,
  canvas: Size,
  { clientX, clientY }: Pick<MouseEvent, "clientX" | "clientY">,
): Point | null {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

/** How far a wheel event scrolls, in screen px. */
function wheelDelta(event: WheelEvent, canvas: Size): Point {
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return { x: event.deltaX * canvas.width, y: event.deltaY * canvas.height };
  }
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1;
  return { x: event.deltaX * unit, y: event.deltaY * unit };
}

/**
 * Whether Space belongs to the focused element rather than to panning: while
 * typing, or on a control the keyboard moved the focus to (pressing a button,
 * ticking a box, opening a list). A control focused by a click doesn't keep Space.
 */
function usesSpaceKey(target: EventTarget | null, keyboardFocused: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (isTextEntry(target) || target.isContentEditable) return true;
  return target === keyboardFocused && target.matches("input, textarea, select, button, summary, [role='button']");
}
