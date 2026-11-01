import type { EditorSettings, Point, Resolution } from "./model";

/** A size in screen px. */
export interface Size {
  width: number;
  height: number;
}

/** Space kept around the wallpaper when it's fitted to the canvas, in screen px. */
const FIT_PADDING = 40;

/** The closest zoom in: one wallpaper px shows as 32 screen px. */
const MAX_ZOOM = 32;

/** The furthest zoom out shows the wallpaper's longer side this many screen px long. */
const MIN_ZOOMED_SIZE = 100;

/** The editor settings that say how the canvas shows the wallpaper. */
export type ViewSettings = Pick<EditorSettings, "zoom" | "pan">;

/**
 * How the canvas shows the wallpaper right now. Screen px are CSS px from the
 * canvas's top-left corner; wallpaper px are the wallpaper's own (ADR 0001).
 */
export interface Viewport {
  resolution: Resolution;
  /** The canvas's size in screen px. */
  canvas: Size;
  /** Screen px per wallpaper px: 1 is 100%. A "fit" zoom setting is resolved to its number. */
  zoom: number;
  /** The wallpaper point shown at the canvas's centre. */
  centre: Point;
}

/** How a canvas of the given size shows the wallpaper with these editor settings. */
export function viewportOf(resolution: Resolution, { zoom, pan }: ViewSettings, canvas: Size): Viewport {
  const fitted = zoom === "fit";
  return {
    resolution,
    canvas,
    // Saved settings may come from anywhere, so they're kept within the limits too.
    zoom: clampZoom(fitted ? fitZoom(resolution, canvas) : zoom, resolution, canvas),
    centre: fitted ? { x: resolution.width / 2, y: resolution.height / 2 } : clampPan(pan, resolution),
  };
}

/** Where a wallpaper point shows on the canvas, in screen px. */
export function toScreen({ canvas, zoom, centre }: Viewport, point: Point): Point {
  return {
    x: (point.x - centre.x) * zoom + canvas.width / 2,
    y: (point.y - centre.y) * zoom + canvas.height / 2,
  };
}

/** The wallpaper point shown at a point on the canvas (in screen px), e.g. under the pointer. */
export function toWallpaper({ canvas, zoom, centre }: Viewport, point: Point): Point {
  return {
    x: (point.x - canvas.width / 2) / zoom + centre.x,
    y: (point.y - canvas.height / 2) / zoom + centre.y,
  };
}

/**
 * The view settings for zooming to `zoom`, keeping the wallpaper point under
 * `point` (in screen px) where it is: the pointer, or by default the canvas's
 * centre.
 */
export function zoomAt(viewport: Viewport, requested: number, point?: Point): { zoom: number; pan: Point } {
  const zoom = clampZoom(requested, viewport.resolution, viewport.canvas);
  const anchor = point ?? { x: viewport.canvas.width / 2, y: viewport.canvas.height / 2 };
  const held = toWallpaper(viewport, anchor);
  const pan = {
    x: held.x - (anchor.x - viewport.canvas.width / 2) / zoom,
    y: held.y - (anchor.y - viewport.canvas.height / 2) / zoom,
  };
  return { zoom, pan: clampPan(pan, viewport.resolution) };
}

/**
 * The view settings for moving the view across the wallpaper by `delta` screen
 * px, as scrolling does: scrolling down shows what's lower down. Space+drag
 * pans by the opposite of how far the pointer moved, so the wallpaper follows it.
 */
export function panBy({ resolution, zoom, centre }: Viewport, delta: Point): { zoom: number; pan: Point } {
  return { zoom, pan: clampPan({ x: centre.x + delta.x / zoom, y: centre.y + delta.y / zoom }, resolution) };
}

/**
 * Keeps a zoom within the limits: no further out than shows the wallpaper's
 * longer side MIN_ZOOMED_SIZE long, or than fits it if that's smaller (on a
 * tiny canvas), and no further in than MAX_ZOOM.
 */
function clampZoom(zoom: number, resolution: Resolution, canvas: Size) {
  const fit = fitZoom(resolution, canvas);
  const smallest = MIN_ZOOMED_SIZE / Math.max(resolution.width, resolution.height);
  // A canvas no bigger than its padding fits nothing; the zoom must stay above 0 all the same.
  const min = fit > 0 ? Math.min(fit, smallest) : smallest;
  return Math.min(Math.max(zoom, min), MAX_ZOOM);
}

/** Keeps the canvas's centre on the wallpaper, so some of it always shows. */
function clampPan(pan: Point, { width, height }: Resolution): Point {
  return { x: Math.min(Math.max(pan.x, 0), width), y: Math.min(Math.max(pan.y, 0), height) };
}

/** The zoom that shows the whole wallpaper as large as fits inside the padding. */
function fitZoom(resolution: Resolution, canvas: Size) {
  return Math.min(
    (canvas.width - 2 * FIT_PADDING) / resolution.width,
    (canvas.height - 2 * FIT_PADDING) / resolution.height,
  );
}
