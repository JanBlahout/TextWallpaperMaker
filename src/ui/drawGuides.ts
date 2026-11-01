import type { EditorSettings, EditorView, Resolution } from "@/editor";
import type { RenderTransform } from "@/render/renderWallpaper";

/**
 * Guide colours: one cyan, so guides read as editor marks rather than part of
 * a monochrome wallpaper, and stay visible on dark and light backgrounds.
 */
const GRID_COLOUR = "rgba(34, 211, 238, 0.2)";
const SAFE_AREA_COLOUR = "rgba(34, 211, 238, 0.65)";
/** Centre-line dashes, in CSS px. */
const CENTRE_DASH = [6, 4];

export interface GuidesToDraw {
  resolution: Resolution;
  view: Pick<EditorView, "safeArea" | "grid" | "centreLines">;
  visibility: Pick<EditorSettings, "gridVisible" | "safeAreaVisible">;
}

/**
 * Draws the guides on the canvas's guides layer, which sits above the
 * wallpaper and is never exported (ADR 0003): the grid on the safe area, then
 * the safe-area edges and the dashed centre lines. Lines are 1 CSS px wide and
 * land on whole device pixels so they stay crisp at any zoom.
 */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  { resolution, view, visibility }: GuidesToDraw,
  transform: RenderTransform,
  pixelRatio: number,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const lineWidth = Math.max(1, Math.round(pixelRatio));
  // Centres a line of `lineWidth` device px on whole pixels.
  const crisp = (position: number) => Math.round(position - lineWidth / 2) + lineWidth / 2;
  const toX = (x: number) => crisp(x * transform.scale + transform.offsetX);
  const toY = (y: number) => crisp(y * transform.scale + transform.offsetY);

  const { safeArea, grid, centreLines } = view;
  const safeLeft = toX(safeArea.x);
  const safeRight = toX(safeArea.x + safeArea.width);
  const safeTop = toY(safeArea.y);
  const safeBottom = toY(safeArea.y + safeArea.height);

  ctx.save();
  ctx.lineWidth = lineWidth;

  if (visibility.gridVisible) {
    // One path, stroked once, so crossings aren't drawn twice and darker.
    ctx.beginPath();
    for (const x of grid.verticalLines) verticalLine(ctx, toX(x), safeTop, safeBottom);
    for (const y of grid.horizontalLines) horizontalLine(ctx, toY(y), safeLeft, safeRight);
    ctx.strokeStyle = GRID_COLOUR;
    ctx.stroke();
  }

  if (visibility.safeAreaVisible) {
    ctx.strokeStyle = SAFE_AREA_COLOUR;
    ctx.beginPath();
    ctx.rect(safeLeft, safeTop, safeRight - safeLeft, safeBottom - safeTop);
    ctx.stroke();

    ctx.beginPath();
    verticalLine(ctx, toX(centreLines.vertical), toY(0), toY(resolution.height));
    horizontalLine(ctx, toY(centreLines.horizontal), toX(0), toX(resolution.width));
    ctx.setLineDash(CENTRE_DASH.map((length) => length * pixelRatio));
    ctx.stroke();
  }

  ctx.restore();
}

function verticalLine(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number) {
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
}

function horizontalLine(ctx: CanvasRenderingContext2D, y: number, left: number, right: number) {
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
}
