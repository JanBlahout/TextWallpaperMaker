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
 * the viewport, so a handle reaches 6 screen px from it on each axis at any
 * zoom and pan: outside the box, and inside it up to a quarter of the box's
 * size on screen, so the middle of a small block still moves it. Where
 * handles overlap outside a tiny box, the closest corner wins.
 */
export function handleAt(viewport: Viewport, box: Box, screen: Point): Corner | null {
  const middle = toScreen(viewport, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  let closest: { corner: Corner; distance: number } | null = null;
  for (const corner of CORNERS) {
    const at = toScreen(viewport, cornerOf(box, corner));
    const inReach = (["x", "y"] as const).every((axis) => {
      const towardsMiddle = middle[axis] - at[axis];
      // How far the pointer is into the box from this corner on this axis; negative outside it.
      const inward = (screen[axis] - at[axis]) * Math.sign(towardsMiddle);
      return inward >= -HANDLE_REACH && inward <= Math.min(HANDLE_REACH, Math.abs(towardsMiddle) / 2);
    });
    const distance = Math.max(Math.abs(screen.x - at.x), Math.abs(screen.y - at.y));
    if (inReach && (!closest || distance < closest.distance)) closest = { corner, distance };
  }
  return closest?.corner ?? null;
}

/** The cursor over each corner handle: a diagonal double arrow along the box's diagonal through it. */
const CURSORS: Record<Corner, string> = {
  "top-left": "cursor-nwse-resize",
  "top-right": "cursor-nesw-resize",
  "bottom-left": "cursor-nesw-resize",
  "bottom-right": "cursor-nwse-resize",
};

/** The cursor class over a corner handle, or none away from the handles. */
export function handleCursor(corner: Corner | null): string {
  return corner === null ? "" : CURSORS[corner];
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
