"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";
import {
  toScreen,
  toWallpaper,
  viewportOf,
  type Editor,
  type EditorSettings,
  type EditorView,
  type Point,
  type Size,
  type Viewport,
  type Wallpaper,
} from "@/editor";
import { loadFontsFor } from "@/render/fontLoading";
import { renderWallpaper, type RenderTransform } from "@/render/renderWallpaper";
import { drawGuides } from "./drawGuides";
import { drawOverlay } from "./drawOverlay";
import { InPlaceTextEditor, type ScreenPoint } from "./InPlaceTextEditor";
import { screenPointOf, useCanvasNavigation } from "./useCanvasNavigation";
import { ZoomControls } from "./ZoomControls";

interface CanvasSize extends Size {
  devicePixelRatio: number;
}

interface WallpaperCanvasProps {
  editor: Editor;
  wallpaper: Wallpaper;
  view: EditorView;
  settings: EditorSettings;
}

/**
 * The on-screen canvas: as big as the space it sits in (not the wallpaper),
 * drawing the part of the wallpaper in view through the renderer at the
 * current zoom × the device pixel ratio, so it stays sharp on high-DPI screens
 * and within browser canvas limits however far it's zoomed in. The guides and
 * the overlay (overflow wash and selection box) are drawn on separate layers
 * above it, which export never sees (ADR 0003). Pressing on a block selects
 * it and dragging moves it, snapping unless Ctrl is held; pressing on empty
 * canvas deselects. Double-clicking a block opens its text for editing in
 * place, in a text field on top. Zooming and panning are in `useCanvasNavigation`.
 */
export function WallpaperCanvas({ editor, wallpaper, view, settings }: WallpaperCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guidesRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(containerRef);
  const dragging = useRef(false);
  /** The drag's latest pointer position and view scale, to re-snap from when Ctrl changes. */
  const lastMove = useRef<{ point: Point; viewScale?: number } | null>(null);
  /** Where the block being edited was double-clicked, for the text field to open there. */
  const [doubleClick, setDoubleClick] = useState<{ id: string; at: ScreenPoint } | null>(null);
  const navigation = useCanvasNavigation(editor, containerRef, size);

  const { resolution } = wallpaper;
  const { zoom, pan } = settings;
  /** How the canvas shows the wallpaper: every layer, the text field and all pointer input go through it. */
  const viewport = useMemo(
    () => (size && size.width > 0 && size.height > 0 ? viewportOf(resolution, { zoom, pan }, size) : null),
    [resolution, zoom, pan, size],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size || !viewport) return;

    let cancelled = false;
    loadFontsFor(wallpaper.blocks).then(
      () => {
        if (cancelled) return;
        const { devicePixelRatio: dpr } = size;
        // Resizing clears the canvas and resets its context; do it only once
        // the frame can be drawn, so the old frame stays up until then.
        const ctx = resizeCanvas(canvas, size);
        if (!ctx) return;
        renderWallpaper(ctx, wallpaper, canvasTransform(viewport, dpr));
      },
      (error: unknown) => console.error(error),
    );
    return () => {
      cancelled = true;
    };
  }, [wallpaper, viewport, size]);

  useEffect(() => {
    drawLayer(guidesRef.current, size, viewport, (ctx, transform, dpr) =>
      drawGuides(ctx, { resolution, view, visibility: settings }, transform, dpr),
    );
  }, [resolution, view, settings, viewport, size]);

  const selectionBox = view.selection?.box ?? null;
  useEffect(() => {
    drawLayer(overlayRef.current, size, viewport, (ctx, transform, dpr) =>
      drawOverlay(ctx, { resolution, selection: selectionBox }, transform, dpr),
    );
  }, [resolution, selectionBox, viewport, size]);

  /** The wallpaper point under the pointer, through the same viewport the layers are drawn with. */
  const wallpaperPoint = (event: PointerEvent<HTMLDivElement>): Point | null => {
    const screen = viewport && screenPointOf(event.currentTarget, viewport.canvas, event);
    return viewport && screen && toWallpaper(viewport, screen);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (navigation.beginPan(event)) return;
    const point = wallpaperPoint(event);
    if (!point) return;
    // Finish any inspector edit first, so it lands before the drag starts.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    editor.selectAt(point);
    editor.beginMove(point);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (navigation.updatePan(event) || !dragging.current) return;
    const point = wallpaperPoint(event);
    if (!point) return;
    // Screen px per wallpaper px, so a drag snaps within the same 6 screen px at any zoom.
    const viewScale = viewport?.zoom;
    lastMove.current = { point, viewScale };
    editor.updateMove(point, { viewScale, bypassSnapping: event.ctrlKey });
  };

  const endDrag = () => {
    if (navigation.endPan() || !dragging.current) return;
    dragging.current = false;
    lastMove.current = null;
    editor.endMove();
  };

  // Pressing or letting go of Ctrl mid-drag unsnaps or re-snaps the block at once, without waiting for the pointer.
  useEffect(() => {
    const onControl = (event: KeyboardEvent) => {
      const last = lastMove.current;
      if (event.key !== "Control" || event.repeat || !dragging.current || !last) return;
      editor.updateMove(last.point, { viewScale: last.viewScale, bypassSnapping: event.ctrlKey });
    };
    window.addEventListener("keydown", onControl);
    window.addEventListener("keyup", onControl);
    return () => {
      window.removeEventListener("keydown", onControl);
      window.removeEventListener("keyup", onControl);
    };
  }, [editor]);

  const onDoubleClick = (event: MouseEvent) => {
    // The double-click's first press has already selected the block under the pointer.
    editor.beginTextEdit();
    const opened = editor.getView().editing;
    setDoubleClick(opened && { id: opened.id, at: { x: event.clientX, y: event.clientY } });
  };

  const editing = view.editing;
  const editingBlock = editing && wallpaper.blocks.find(({ id }) => id === editing.id);

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // On macOS, Ctrl held as the button goes down would open a context menu and break off the drag.
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={onDoubleClick}
      className={`relative h-full w-full touch-none overflow-hidden select-none ${navigation.cursor}`}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Wallpaper canvas"
        className="absolute inset-0 h-full w-full"
      />
      <canvas
        ref={guidesRef}
        aria-hidden
        data-testid="guides"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <canvas
        ref={overlayRef}
        aria-hidden
        data-testid="overlay"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {editing && editingBlock && viewport && (
        <InPlaceTextEditor
          key={editing.id}
          editor={editor}
          block={editingBlock}
          box={editing.box}
          transform={screenTransform(viewport)}
          openAt={doubleClick?.id === editing.id ? doubleClick.at : null}
        />
      )}
      {viewport && <ZoomControls editor={editor} viewport={viewport} />}
    </div>
  );
}

/** Sizes a layer above the wallpaper to the canvas and draws it through the transform every layer shares. */
function drawLayer(
  canvas: HTMLCanvasElement | null,
  size: CanvasSize | null,
  viewport: Viewport | null,
  draw: (ctx: CanvasRenderingContext2D, transform: RenderTransform, devicePixelRatio: number) => void,
) {
  if (!canvas || !size || !viewport) return;
  const ctx = resizeCanvas(canvas, size);
  if (!ctx) return;
  draw(ctx, canvasTransform(viewport, size.devicePixelRatio), size.devicePixelRatio);
}

/** Sizes a canvas to the CSS size × device pixel ratio. Resizing clears it and resets its context. */
function resizeCanvas(canvas: HTMLCanvasElement, size: CanvasSize) {
  const { width, height } = canvasPixelSize(size);
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext("2d");
}

/** A canvas's size in canvas px: its CSS size × the device pixel ratio, in whole pixels. */
function canvasPixelSize({ width, height, devicePixelRatio }: CanvasSize): Size {
  return { width: Math.round(width * devicePixelRatio), height: Math.round(height * devicePixelRatio) };
}

/**
 * Wallpaper px to screen (CSS) px over the canvas: the viewport's
 * wallpaper-to-screen conversion as a transform, for page elements laid on
 * the canvas, such as the in-place text field.
 */
function screenTransform(viewport: Viewport): RenderTransform {
  const origin = toScreen(viewport, { x: 0, y: 0 });
  return { scale: viewport.zoom, offsetX: origin.x, offsetY: origin.y };
}

/** Wallpaper px to canvas px: the screen transform × the device pixel ratio, shared by every layer so the guides sit exactly on the wallpaper. */
function canvasTransform(viewport: Viewport, devicePixelRatio: number): RenderTransform {
  const { scale, offsetX, offsetY } = screenTransform(viewport);
  return { scale: scale * devicePixelRatio, offsetX: offsetX * devicePixelRatio, offsetY: offsetY * devicePixelRatio };
}

/**
 * Tracks the size of the element the canvas fills, and the device pixel ratio.
 * The size is rounded to whole device pixels, as the canvas's pixels are, so
 * screen px are exactly canvas px ÷ the device pixel ratio.
 */
function useCanvasSize(ref: RefObject<HTMLElement | null>): CanvasSize | null {
  const [size, setSize] = useState<CanvasSize | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let ratioQuery: MediaQueryList | undefined;
    const measure = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width * devicePixelRatio) / devicePixelRatio;
      const height = Math.round(rect.height * devicePixelRatio) / devicePixelRatio;
      setSize((previous) =>
        previous?.width === width && previous.height === height && previous.devicePixelRatio === devicePixelRatio
          ? previous
          : { width, height, devicePixelRatio },
      );
      // Re-measure when the window moves to a screen with another pixel ratio.
      ratioQuery?.removeEventListener("change", measure);
      ratioQuery = window.matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      ratioQuery.addEventListener("change", measure);
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    measure();
    return () => {
      resizeObserver.disconnect();
      ratioQuery?.removeEventListener("change", measure);
    };
  }, [ref]);

  return size;
}
