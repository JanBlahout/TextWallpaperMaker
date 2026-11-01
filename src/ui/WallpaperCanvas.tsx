"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { Editor, EditorSettings, EditorView, Point, Resolution, Wallpaper } from "@/editor";
import { loadFontsFor } from "@/render/fontLoading";
import { renderWallpaper, type RenderTransform } from "@/render/renderWallpaper";
import { drawGuides } from "./drawGuides";
import { drawOverlay } from "./drawOverlay";
import { fitWallpaper, type Size } from "./fitWallpaper";

/** Space kept around the fitted wallpaper, in CSS px. */
const FIT_PADDING = 40;

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
 * drawing the wallpaper through the renderer fitted to that space, at the
 * device pixel ratio so it stays sharp on high-DPI screens. The guides and
 * the overlay (overflow wash and selection box) are drawn on separate layers
 * above it, which export never sees (ADR 0003). Pressing on a block selects
 * it and dragging moves it, snapping unless Ctrl is held; pressing on empty
 * canvas deselects.
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size || size.width === 0 || size.height === 0) return;

    let cancelled = false;
    loadFontsFor(wallpaper.blocks).then(
      () => {
        if (cancelled) return;
        const { devicePixelRatio: dpr } = size;
        // Resizing clears the canvas and resets its context; do it only once
        // the frame can be drawn, so the old frame stays up until then.
        const ctx = resizeCanvas(canvas, size);
        if (!ctx) return;
        renderWallpaper(ctx, wallpaper, canvasTransform(wallpaper.resolution, canvas, dpr));
      },
      (error: unknown) => console.error(error),
    );
    return () => {
      cancelled = true;
    };
  }, [wallpaper, size]);

  const { resolution } = wallpaper;
  useEffect(() => {
    drawLayer(guidesRef.current, size, resolution, (ctx, transform, dpr) =>
      drawGuides(ctx, { resolution, view, visibility: settings }, transform, dpr),
    );
  }, [resolution, view, settings, size]);

  const selectionBox = view.selection?.box ?? null;
  useEffect(() => {
    drawLayer(overlayRef.current, size, resolution, (ctx, transform, dpr) =>
      drawOverlay(ctx, { resolution, selection: selectionBox }, transform, dpr),
    );
  }, [resolution, selectionBox, size]);

  /** The wallpaper point under the pointer, through the same transform the layers are drawn with. */
  const wallpaperPoint = (event: PointerEvent): Point | null => {
    const canvas = overlayRef.current;
    if (!canvas || !size) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    // CSS px from the canvas's corner, to canvas px, to wallpaper px.
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    const { scale, offsetX, offsetY } = canvasTransform(resolution, canvas, size.devicePixelRatio);
    return { x: (canvasX - offsetX) / scale, y: (canvasY - offsetY) / scale };
  };

  /** Screen (CSS) px per wallpaper px, so a drag snaps within the same 6 screen px at any zoom. */
  const viewScale = () => {
    const canvas = overlayRef.current;
    if (!canvas || !size) return undefined;
    return canvasTransform(resolution, canvas, size.devicePixelRatio).scale / size.devicePixelRatio;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
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
    if (!dragging.current) return;
    const point = wallpaperPoint(event);
    if (!point) return;
    const scale = viewScale();
    lastMove.current = { point, viewScale: scale };
    editor.updateMove(point, { viewScale: scale, bypassSnapping: event.ctrlKey });
  };

  const endDrag = () => {
    if (!dragging.current) return;
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

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // On macOS, Ctrl held as the button goes down would open a context menu and break off the drag.
      onContextMenu={(event) => event.preventDefault()}
      className="relative h-full w-full touch-none overflow-hidden select-none"
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
    </div>
  );
}

/** Sizes a layer above the wallpaper to the canvas and draws it through the transform every layer shares. */
function drawLayer(
  canvas: HTMLCanvasElement | null,
  size: CanvasSize | null,
  resolution: Resolution,
  draw: (ctx: CanvasRenderingContext2D, transform: RenderTransform, devicePixelRatio: number) => void,
) {
  if (!canvas || !size || size.width === 0 || size.height === 0) return;
  const ctx = resizeCanvas(canvas, size);
  if (!ctx) return;
  draw(ctx, canvasTransform(resolution, canvas, size.devicePixelRatio), size.devicePixelRatio);
}

/** Sizes a canvas to the CSS size × device pixel ratio. Resizing clears it and resets its context. */
function resizeCanvas(canvas: HTMLCanvasElement, size: CanvasSize) {
  canvas.width = Math.round(size.width * size.devicePixelRatio);
  canvas.height = Math.round(size.height * size.devicePixelRatio);
  return canvas.getContext("2d");
}

/** Wallpaper px to canvas px, shared by every layer so the guides sit exactly on the wallpaper. */
function canvasTransform(resolution: Resolution, canvas: Size, devicePixelRatio: number): RenderTransform {
  return fitWallpaper(resolution, canvas, FIT_PADDING * devicePixelRatio);
}

/** Tracks the CSS size of the element the canvas fills, and the device pixel ratio. */
function useCanvasSize(ref: RefObject<HTMLElement | null>): CanvasSize | null {
  const [size, setSize] = useState<CanvasSize | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let ratioQuery: MediaQueryList | undefined;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      const devicePixelRatio = window.devicePixelRatio || 1;
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
