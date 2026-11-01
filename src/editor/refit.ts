import { safeAreaOf } from "./geometry";
import type { Resolution, SafeMargin, Wallpaper } from "./model";
import { sameResolution } from "./resolution";
import type { TextMeasurer } from "./textMeasurer";

export interface RefitOptions {
  /** The safe margin that anchors are measured from, at both the old and the new resolution. */
  safeMargin: SafeMargin;
  measurer: TextMeasurer;
}

/**
 * Re-fits a wallpaper to a new resolution (ADR 0001). Every text block's font
 * size is multiplied by one common factor: the smaller of new width ÷ old width
 * and new height ÷ old height, so everything stays in frame. On each axis, the
 * block keeps its anchor: it's placed in the new safe area at its anchor
 * distance × the factor. The same resolution leaves the wallpaper as it is.
 */
export function refit(wallpaper: Wallpaper, resolution: Resolution, { safeMargin, measurer }: RefitOptions): Wallpaper {
  // Re-placing blocks by a factor of 1 could still move them by rounding errors.
  if (sameResolution(resolution, wallpaper.resolution)) return wallpaper;
  const factor = Math.min(
    resolution.width / wallpaper.resolution.width,
    resolution.height / wallpaper.resolution.height,
  );
  const from = safeAreaOf(wallpaper.resolution, safeMargin);
  const to = safeAreaOf(resolution, safeMargin);

  return {
    ...wallpaper,
    resolution,
    blocks: wallpaper.blocks.map((block) => {
      const before = measurer.measure(block);
      const scaled = { ...block, fontSize: block.fontSize * factor };
      // Measured again rather than scaled, so the anchored edge lands exactly
      // even if real text doesn't measure perfectly in proportion.
      const after = measurer.measure(scaled);
      return {
        ...scaled,
        x: keepAnchor({
          block: { start: block.x, size: before.width },
          safeArea: { start: from.x, size: from.width },
          newSize: after.width,
          newSafeArea: { start: to.x, size: to.width },
          factor,
        }),
        y: keepAnchor({
          block: { start: block.y, size: before.height },
          safeArea: { start: from.y, size: from.height },
          newSize: after.height,
          newSafeArea: { start: to.y, size: to.height },
          factor,
        }),
      };
    }),
  };
}

/** A block's or a safe area's extent along one axis. */
interface Span {
  start: number;
  size: number;
}

/**
 * Where a block's re-fitted span starts on one axis. Its anchor is whichever is
 * closest: its start to the safe area's start, its centre to the safe area's
 * centre, or its end to the safe area's end (a tie goes to the earlier one).
 * The re-fitted span, `newSize` long, keeps that anchor `factor` × as far from
 * the same point of the new safe area.
 */
function keepAnchor({
  block,
  safeArea,
  newSize,
  newSafeArea,
  factor,
}: {
  block: Span;
  safeArea: Span;
  newSize: number;
  newSafeArea: Span;
  factor: number;
}): number {
  // 0 is the start, ½ the centre and 1 the end of a span.
  const anchors = [0, 0.5, 1].map((at) => ({
    at,
    distance: block.start + at * block.size - (safeArea.start + at * safeArea.size),
  }));
  const anchor = anchors.reduce((closest, candidate) =>
    Math.abs(candidate.distance) < Math.abs(closest.distance) ? candidate : closest,
  );
  return newSafeArea.start + anchor.at * newSafeArea.size + anchor.distance * factor - anchor.at * newSize;
}
