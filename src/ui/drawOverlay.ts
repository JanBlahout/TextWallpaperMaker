import type { Box, Resolution } from "@/editor";
import type { RenderTransform } from "@/render/renderWallpaper";

/**
 * The canvas surround's colour (Tailwind's neutral-950), mostly opaque: it
 * leaves the surround unchanged and fades text that runs past the wallpaper.
 */
const OVERFLOW_WASH = "rgba(10, 10, 10, 0.75)";
/** A soft blue, apart from the cyan guides, that shows on dark and light backgrounds. */
const SELECTION_COLOUR = "rgba(96, 165, 250, 0.9)";

export interface OverlayToDraw {
  resolution: Resolution;
  /** The selected block's box, or null when nothing is selected. */
  selection: Box | null;
}

/**
 * Draws the overlay layer, which sits above the guides and is never exported
 * (ADR 0003): a wash over everything outside the wallpaper, so the part of a
 * block past its edge shows faded (the export crops it), then the selected
 * block's bounding box, 1 CSS px wide on whole device pixels.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  { resolution, selection }: OverlayToDraw,
  transform: RenderTransform,
  pixelRatio: number,
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  const toX = (x: number) => x * transform.scale + transform.offsetX;
  const toY = (y: number) => y * transform.scale + transform.offsetY;

  // Rounded outwards, so the wash never darkens the wallpaper's own edge pixels.
  const left = Math.floor(toX(0));
  const top = Math.floor(toY(0));
  const right = Math.ceil(toX(resolution.width));
  const bottom = Math.ceil(toY(resolution.height));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.rect(left, top, right - left, bottom - top);
  ctx.fillStyle = OVERFLOW_WASH;
  ctx.fill("evenodd");

  if (selection) {
    const lineWidth = Math.max(1, Math.round(pixelRatio));
    // Centres a line of `lineWidth` device px on whole pixels.
    const crisp = (position: number) => Math.round(position - lineWidth / 2) + lineWidth / 2;
    const boxLeft = crisp(toX(selection.x));
    const boxTop = crisp(toY(selection.y));
    ctx.beginPath();
    ctx.rect(
      boxLeft,
      boxTop,
      crisp(toX(selection.x + selection.width)) - boxLeft,
      crisp(toY(selection.y + selection.height)) - boxTop,
    );
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = SELECTION_COLOUR;
    ctx.stroke();
  }
  ctx.restore();
}
