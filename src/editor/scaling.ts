import type { Box, Point, TextBlock } from "./model";
import { smartGuidesFor, snap, type MovingLines, type SmartGuide, type SnapTargets } from "./snapping";
import type { TextMeasurer } from "./textMeasurer";

/** The smallest font size scaling takes a block down to, in wallpaper px. */
const MIN_FONT_SIZE = 1;

/** The corners of a text block's box, where its corner handles sit. */
export const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

export type Corner = (typeof CORNERS)[number];

/** Which side of the box a corner is on: its left or right edge across, its top or bottom edge down. */
const SIDES = {
  "top-left": { x: "start", y: "start" },
  "top-right": { x: "end", y: "start" },
  "bottom-left": { x: "start", y: "end" },
  "bottom-right": { x: "end", y: "end" },
} as const satisfies Record<Corner, { x: "start" | "end"; y: "start" | "end" }>;

const OPPOSITE: Record<Corner, Corner> = {
  "top-left": "bottom-right",
  "top-right": "bottom-left",
  "bottom-left": "top-right",
  "bottom-right": "top-left",
};

/** Where a corner of a box is, in wallpaper px. */
export function cornerOf(box: Box, corner: Corner): Point {
  const { x, y } = SIDES[corner];
  return { x: x === "start" ? box.x : box.x + box.width, y: y === "start" ? box.y : box.y + box.height };
}

/** A scale in progress: the block as it started, its box then, and the corner whose handle is dragged. */
export interface Scale {
  block: TextBlock;
  start: Box;
  corner: Corner;
}

/** What a scale snaps to, or nothing while snapping is off or bypassed. */
export interface ScaleSnapping {
  targets: SnapTargets;
  /** The snap distance in wallpaper px (see `snapDistance`). */
  distance: number;
}

/** The scaled block, with the smart guides that show what its moving edges line up with. */
export interface ScaledBlock {
  block: TextBlock;
  guides: SmartGuide[];
}

/**
 * The block after its corner handle is dragged by `offset` (in wallpaper px).
 * The box keeps its proportions: it scales about the opposite corner, which
 * stays where it was, by how far along that corner's diagonal the dragged
 * corner now lies. The font size scales with it (old size × new box width ÷
 * old box width, which may be fractional, and never below 1 px), and letter
 * spacing and line height follow because they're relative to it.
 *
 * With `snapping`, the two edges that meet at the dragged corner snap like a
 * dragged box's lines (see `snap`). The box can't keep its proportions and
 * take both, so the edge with the shorter way to go wins and lands exactly on
 * its target.
 */
export function scaleByDrag(
  { block, start, corner }: Scale,
  offset: Point,
  measurer: TextMeasurer,
  snapping?: ScaleSnapping,
): ScaledBlock {
  const minFactor = MIN_FONT_SIZE / block.fontSize;
  let factor = Math.max(minFactor, dragFactor(start, corner, offset));
  let guides: SmartGuide[] = [];
  if (snapping) {
    factor = Math.max(minFactor, snappedFactor(start, corner, factor, snapping));
    guides = smartGuidesFor(scaledBox(start, corner, factor), movingEdges(corner), snapping.targets);
  }
  return { block: placed({ ...block, fontSize: block.fontSize * factor }, start, corner, measurer), guides };
}

/**
 * How much dragging `corner` of `box` by `offset` scales the box: how far
 * along the diagonal from the opposite corner the dragged corner now lies
 * (projected onto that diagonal).
 */
function dragFactor(box: Box, corner: Corner, offset: Point): number {
  const diagonal = diagonalOf(box, corner);
  const moved = { x: diagonal.x + offset.x, y: diagonal.y + offset.y };
  return (moved.x * diagonal.x + moved.y * diagonal.y) / (diagonal.x ** 2 + diagonal.y ** 2);
}

/** The factor that brings the closer of the moving edges exactly onto the target in reach, or `factor` when none is. */
function snappedFactor(box: Box, corner: Corner, factor: number, { targets, distance }: ScaleSnapping): number {
  const scaled = scaledBox(box, corner, factor);
  const shift = snap(scaled, movingEdges(corner), targets, distance);
  if (shift.x === null && shift.y === null) return factor;
  // The edge moves `diagonal` px for each whole step of the factor, measured from the fixed corner.
  const fixed = cornerOf(box, OPPOSITE[corner]);
  const diagonal = diagonalOf(box, corner);
  const edge = cornerOf(scaled, corner);
  const alongX = shift.x !== null && (shift.y === null || Math.abs(shift.x) <= Math.abs(shift.y));
  return alongX ? (edge.x + shift.x! - fixed.x) / diagonal.x : (edge.y + shift.y! - fixed.y) / diagonal.y;
}

/** The two edges that meet at a corner, which move as its handle is dragged. */
function movingEdges(corner: Corner): MovingLines {
  const { x, y } = SIDES[corner];
  return { x: [x], y: [y] };
}

/** From the opposite corner to `corner`. */
function diagonalOf(box: Box, corner: Corner): Point {
  const fixed = cornerOf(box, OPPOSITE[corner]);
  const dragged = cornerOf(box, corner);
  return { x: dragged.x - fixed.x, y: dragged.y - fixed.y };
}

/** `box` scaled by `factor`, keeping the corner opposite `corner` where it was. */
function scaledBox(box: Box, corner: Corner, factor: number): Box {
  return withFixedCorner({ width: box.width * factor, height: box.height * factor }, box, corner);
}

/** The block placed so that the corner of its measured box opposite `corner` is where it was on `start`. */
function placed(block: TextBlock, start: Box, corner: Corner, measurer: TextMeasurer): TextBlock {
  const { x, y } = withFixedCorner(measurer.measure(block), start, corner);
  return { ...block, x, y };
}

/** A box of `size` whose corner opposite `corner` is where it is on `start`. */
function withFixedCorner({ width, height }: { width: number; height: number }, start: Box, corner: Corner): Box {
  const opposite = OPPOSITE[corner];
  const fixed = cornerOf(start, opposite);
  const { x, y } = SIDES[opposite];
  return { x: x === "start" ? fixed.x : fixed.x - width, y: y === "start" ? fixed.y : fixed.y - height, width, height };
}
