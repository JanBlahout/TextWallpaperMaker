import type { Resolution } from "./model";

/** The range of a resolution's width and height in px; a requested side is rounded and kept within it. */
export const RESOLUTION_RANGE = { min: 320, max: 8192 } as const;

/** A named resolution offered for convenience; the size matters more than the name. */
export interface Preset extends Resolution {
  name: string;
}

/** The presets, grouped as the resolution selector shows them. */
export const PRESET_GROUPS: readonly { name: "Desktop" | "Mobile"; presets: readonly Preset[] }[] = [
  {
    name: "Desktop",
    presets: [
      { width: 1920, height: 1080, name: "Full HD" },
      { width: 2560, height: 1440, name: "QHD" },
      { width: 3840, height: 2160, name: "4K UHD" },
      { width: 3440, height: 1440, name: "Ultrawide QHD" },
      { width: 2560, height: 1600, name: "MacBook 13″" },
      { width: 3024, height: 1964, name: "MacBook Pro 14″" },
      { width: 3456, height: 2234, name: "MacBook Pro 16″" },
    ],
  },
  {
    name: "Mobile",
    presets: [
      { width: 1179, height: 2556, name: "iPhone 15 · 16" },
      { width: 1206, height: 2622, name: "iPhone 16 Pro · 17" },
      { width: 1290, height: 2796, name: "iPhone 16 Plus" },
      { width: 1080, height: 2400, name: "Android FHD+" },
      { width: 1440, height: 3200, name: "Android QHD+" },
    ],
  },
];

/** Rounds each side to whole pixels and keeps it within RESOLUTION_RANGE. */
export function clampResolution({ width, height }: Resolution): Resolution {
  return { width: clampSide(width), height: clampSide(height) };
}

export function sameResolution(a: Resolution, b: Resolution) {
  return a.width === b.width && a.height === b.height;
}

function clampSide(length: number) {
  return Math.min(RESOLUTION_RANGE.max, Math.max(RESOLUTION_RANGE.min, Math.round(length)));
}
