import { safeAreaOf } from "./geometry";
import type { Box, EditorSettings, Point, Resolution } from "./model";

/**
 * For each quick-align position, the axis it moves a block along and where on
 * that axis it lines the block up with the target: 0 is the start, ½ the
 * centre and 1 the end.
 */
const ALIGNMENTS = {
  left: { axis: "x", at: 0 },
  centre: { axis: "x", at: 0.5 },
  right: { axis: "x", at: 1 },
  top: { axis: "y", at: 0 },
  middle: { axis: "y", at: 0.5 },
  bottom: { axis: "y", at: 1 },
} as const satisfies Record<string, { axis: "x" | "y"; at: number }>;

/** Where quick align puts a block: against an edge or the centre of the align target, on one axis. */
export type AlignPosition = keyof typeof ALIGNMENTS;

const SIZE_ALONG = { x: "width", y: "height" } as const;

/** The box quick align lines blocks up with: the safe area, or the whole wallpaper. */
export function alignTargetOf(
  resolution: Resolution,
  { alignTarget, safeMargin }: Pick<EditorSettings, "alignTarget" | "safeMargin">,
): Box {
  return alignTarget === "safe-area" ? safeAreaOf(resolution, safeMargin) : { x: 0, y: 0, ...resolution };
}

/**
 * Where a box's top-left corner goes to line it up with `target` at
 * `position`: its left, centre or right with the target's, or its top, middle
 * or bottom. It moves along that one axis only.
 */
export function alignedPosition(box: Box, target: Box, position: AlignPosition): Point {
  const { axis, at } = ALIGNMENTS[position];
  const size = SIZE_ALONG[axis];
  const alignedStart = target[axis] + at * (target[size] - box[size]);
  return axis === "x" ? { x: alignedStart, y: box.y } : { x: box.x, y: alignedStart };
}
