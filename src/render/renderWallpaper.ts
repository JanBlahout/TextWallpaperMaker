import type { LineAlign, TextBlock, Wallpaper } from "@/editor";
import { applyTextStyle, layOutLines } from "./textLayout";

/** Maps wallpaper px to canvas px: canvas = wallpaper × scale + offset. */
export interface RenderTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Draws a wallpaper (background, then each text block line by line) with
 * Canvas 2D. The one renderer behind both the on-screen canvas and the export
 * (ADR 0003). Callers must make sure the wallpaper's fonts have loaded first.
 */
export function renderWallpaper(ctx: CanvasRenderingContext2D, wallpaper: Wallpaper, transform: RenderTransform) {
  ctx.save();
  ctx.setTransform(transform.scale, 0, 0, transform.scale, transform.offsetX, transform.offsetY);
  ctx.fillStyle = wallpaper.background;
  ctx.fillRect(0, 0, wallpaper.resolution.width, wallpaper.resolution.height);
  for (const block of wallpaper.blocks) drawBlock(ctx, block);
  ctx.restore();
}

function drawBlock(ctx: CanvasRenderingContext2D, block: TextBlock) {
  applyTextStyle(ctx, block);
  ctx.fillStyle = block.color;
  ctx.globalAlpha = block.opacity / 100;
  const layout = layOutLines(ctx, block);
  layout.lines.forEach((line, i) => {
    const x = block.x + alignOffset(block.align, layout.width, layout.lineWidths[i]);
    const y = block.y + (i + 0.5) * layout.lineHeightPx;
    ctx.fillText(line, x, y);
  });
}

function alignOffset(align: LineAlign, boxWidth: number, lineWidth: number) {
  if (align === "center") return (boxWidth - lineWidth) / 2;
  if (align === "right") return boxWidth - lineWidth;
  return 0;
}
