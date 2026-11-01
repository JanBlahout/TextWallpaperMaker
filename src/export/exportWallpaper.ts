import type { Resolution, Wallpaper } from "@/editor";
import { createCanvas2D } from "@/render/canvas2d";
import { loadFontsFor } from "@/render/fontLoading";
import { renderWallpaper } from "@/render/renderWallpaper";

export function exportFileName({ width, height }: Resolution) {
  return `wallpaper-${width}x${height}.png`;
}

/**
 * Renders the wallpaper on an off-screen canvas of exactly its resolution (scale
 * 1, never multiplied by the device pixel ratio) and downloads it as a PNG.
 * Guides and other editor-only drawing live in a separate layer and never get here.
 */
export async function exportWallpaper(wallpaper: Wallpaper) {
  await loadFontsFor(wallpaper.blocks);

  const ctx = createCanvas2D(wallpaper.resolution.width, wallpaper.resolution.height);
  renderWallpaper(ctx, wallpaper, { scale: 1, offsetX: 0, offsetY: 0 });

  const png = await new Promise<Blob>((resolve, reject) =>
    ctx.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png"),
  );
  download(png, exportFileName(wallpaper.resolution));
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
