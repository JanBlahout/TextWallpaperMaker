"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Wallpaper } from "@/editor";
import { loadFontsFor } from "@/render/fontLoading";
import { renderWallpaper } from "@/render/renderWallpaper";
import { fitWallpaper, type Size } from "./fitWallpaper";

/** Space kept around the fitted wallpaper, in CSS px. */
const FIT_PADDING = 40;

interface CanvasSize extends Size {
  devicePixelRatio: number;
}

/**
 * The on-screen canvas: as big as the space it sits in (not the wallpaper),
 * drawing the wallpaper through the renderer fitted to that space, at the
 * device pixel ratio so it stays sharp on high-DPI screens.
 */
export function WallpaperCanvas({ wallpaper }: { wallpaper: Wallpaper }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
        canvas.width = Math.round(size.width * dpr);
        canvas.height = Math.round(size.height * dpr);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderWallpaper(ctx, wallpaper, fitWallpaper(wallpaper.resolution, canvas, FIT_PADDING * dpr));
      },
      (error: unknown) => console.error(error),
    );
    return () => {
      cancelled = true;
    };
  }, [wallpaper, size]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Wallpaper canvas"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
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
