"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { EditorSettings, EditorView, Resolution, Wallpaper } from "@/editor";
import { loadFontsFor } from "@/render/fontLoading";
import { renderWallpaper, type RenderTransform } from "@/render/renderWallpaper";
import { drawGuides } from "./drawGuides";
import { fitWallpaper, type Size } from "./fitWallpaper";

/** Space kept around the fitted wallpaper, in CSS px. */
const FIT_PADDING = 40;

interface CanvasSize extends Size {
  devicePixelRatio: number;
}

interface WallpaperCanvasProps {
  wallpaper: Wallpaper;
  view: EditorView;
  settings: EditorSettings;
}

/**
 * The on-screen canvas: as big as the space it sits in (not the wallpaper),
 * drawing the wallpaper through the renderer fitted to that space, at the
 * device pixel ratio so it stays sharp on high-DPI screens. The guides are
 * drawn on a separate layer above it, which export never sees (ADR 0003).
 */
export function WallpaperCanvas({ wallpaper, view, settings }: WallpaperCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guidesRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(containerRef);

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
    const canvas = guidesRef.current;
    if (!canvas || !size || size.width === 0 || size.height === 0) return;
    const ctx = resizeCanvas(canvas, size);
    if (!ctx) return;
    const dpr = size.devicePixelRatio;
    drawGuides(ctx, { resolution, view, visibility: settings }, canvasTransform(resolution, canvas, dpr), dpr);
  }, [resolution, view, settings, size]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
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
    </div>
  );
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
