import type { Resolution } from "@/editor";
import type { RenderTransform } from "@/render/renderWallpaper";

export interface Size {
  width: number;
  height: number;
}

/**
 * The transform that shows the whole wallpaper centred in an area, as large as
 * fits inside `padding`, keeping the wallpaper's aspect ratio.
 */
export function fitWallpaper(resolution: Resolution, area: Size, padding: number): RenderTransform {
  const scale = Math.max(
    0,
    Math.min((area.width - 2 * padding) / resolution.width, (area.height - 2 * padding) / resolution.height),
  );
  return {
    scale,
    offsetX: (area.width - resolution.width * scale) / 2,
    offsetY: (area.height - resolution.height * scale) / 2,
  };
}
