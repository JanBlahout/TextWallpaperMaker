import { CORNERS, cornerOf, toScreen, type Box, type Corner, type Point, type Viewport } from "@/editor";

/** How big a corner handle is drawn, in CSS px. */
const HANDLE_SIZE = 8;
/** How far from its corner a handle can be grabbed, on each axis, in screen px, so it's as easy to hit at any zoom. */
const HANDLE_REACH = 6;
/** The handle's fill; its outline is the selection box's colour. */
const HANDLE_FILL = "rgb(255, 255, 255)";

/**
 * The corner handle of the selected `box` under `screen`, the pointer in
 * screen px, or null when there's none. Each corner is found on screen through
 * the viewport, so a handle reaches 6 screen px from it on each axis, inside or
 * outside the box, at any zoom and pan. When a box is small enough on screen
 * for handles to overlap, the closest corner wins.
 */
export function handleAt(viewport: Viewport, box: Box, screen: Point): Corner | null {
  let closest: { corner: Corner; distance: number } | null = null;
  for (const corner of CORNERS) {
    const { x, y } = toScreen(viewport, cornerOf(box, corner));
    const distance = Math.max(Math.abs(screen.x - x), Math.abs(screen.y - y));
    if (distance <= HANDLE_REACH && (!closest || distance < closest.distance)) closest = { corner, distance };
  }
  return closest?.corner ?? null;
}

/** The cursor class over a corner handle: a resize arrow along the box's diagonal through that corner. */
export function handleCursor(corner: Corner | null): string {
  if (corner === null) return "";
  return corner === "top-left" || corner === "bottom-right" ? "cursor-nwse-resize" : "cursor-nesw-resize";
}

/** Where a box is drawn on the overlay: its edges in canvas px. */
export interface DrawnBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Draws a handle at each corner of the selection box as drawn on the overlay
 * (`drawn`, in canvas px): a white square 8 CSS px across, outlined in the
 * selection box's `colour` and aligned to whole device pixels.
 */
export function drawHandles(ctx: CanvasRenderingContext2D, drawn: DrawnBox, colour: string, pixelRatio: number) {
  const size = Math.round(HANDLE_SIZE * pixelRatio);
  const lineWidth = Math.max(1, Math.round(pixelRatio));
  ctx.save();
  ctx.fillStyle = HANDLE_FILL;
  ctx.strokeStyle = colour;
  ctx.lineWidth = lineWidth;
  for (const x of [drawn.left, drawn.right]) {
    for (const y of [drawn.top, drawn.bottom]) {
      const left = Math.round(x - size / 2);
      const top = Math.round(y - size / 2);
      ctx.fillRect(left, top, size, size);
      ctx.strokeRect(left + lineWidth / 2, top + lineWidth / 2, size - lineWidth, size - lineWidth);
    }
  }
  ctx.restore();
}
