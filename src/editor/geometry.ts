import type { Box, Resolution, SafeMargin } from "./model";

/** The safe area: the wallpaper inset on every side by the safe margin % of its shorter side. */
export function safeAreaOf({ width, height }: Resolution, safeMargin: SafeMargin): Box {
  const inset = (safeMargin / 100) * Math.min(width, height);
  return { x: inset, y: inset, width: width - 2 * inset, height: height - 2 * inset };
}
