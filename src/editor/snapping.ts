import type { CentreLines, Grid } from "./geometry";
import type { Box, EditorSettings, Resolution } from "./model";

/** How close a moving line must come to a target to snap to it, in screen px, so it feels the same at any zoom. */
const SNAP_DISTANCE = 6;

/** The snap distance in wallpaper px: 6 screen px ÷ the view scale (see `SnapOptions`). */
export function snapDistance(viewScale = 1): number {
  return SNAP_DISTANCE / viewScale;
}

/** How a step of a gesture snaps, as the pointer reports it. */
export interface SnapOptions {
  /**
   * Screen (CSS) px per wallpaper px in the current view, so the snap distance
   * is 6 screen px at any zoom: 6 ÷ this in wallpaper px. Defaults to 1.
   */
  viewScale?: number;
  /** Moves freely, without snapping, as holding Ctrl does. */
  bypassSnapping?: boolean;
}

/** One of a box's three lines on an axis: its start edge (left or top), its centre, or its end edge (right or bottom). */
export type BoxLine = "start" | "centre" | "end";

/** Which of a box's lines are moving, and so snap: those across (x) and those down (y). */
export interface MovingLines {
  x: readonly BoxLine[];
  y: readonly BoxLine[];
}

const ALL_LINES: readonly BoxLine[] = ["start", "centre", "end"];
const EDGES: readonly BoxLine[] = ["start", "end"];

/** Every line of the box: a dragged block snaps by its left, centre and right, and its top, middle and bottom. */
export const WHOLE_BOX: MovingLines = { x: ALL_LINES, y: ALL_LINES };

type Axis = "x" | "y";

/** A vertical line or a horizontal one. */
export type Orientation = "vertical" | "horizontal";

/** A vertical line sits at an x and runs down (along y); a horizontal one sits at a y and runs across (along x). */
const AXES = {
  vertical: { at: "x", along: "y" },
  horizontal: { at: "y", along: "x" },
} as const satisfies Record<Orientation, { at: Axis; along: Axis }>;

const ORIENTATIONS: readonly Orientation[] = ["vertical", "horizontal"];

/** Where a line runs from and to along its length, in wallpaper px. */
interface Span {
  from: number;
  to: number;
}

/** A line a moving box can snap to: at `position` across its axis, running along `from` to `to`. */
export interface SnapTarget extends Span {
  position: number;
}

/** Everything a moving box can snap to: vertical lines (at an x) and horizontal lines (at a y). */
export type SnapTargets = Record<Orientation, SnapTarget[]>;

/**
 * A temporary guide that shows what a moving block lines up with: a vertical
 * line at x = `position` or a horizontal one at y = `position`, running along
 * both the block and what it lines up with.
 */
export interface SmartGuide extends Span {
  orientation: Orientation;
  position: number;
}

/** Where the guides run: the safe area, the grid on it and the centre lines, on a wallpaper of this resolution. */
export interface GuideGeometry {
  resolution: Resolution;
  safeArea: Box;
  grid: Grid;
  centreLines: CentreLines;
}

/**
 * What a block can snap to: the grid lines while the grid is visible, the
 * safe-area edges and centre lines while the safe-area guides are visible,
 * and the edges and centres of `otherBlocks`. Each target runs along what it
 * belongs to: grid lines and safe-area edges along the safe area, centre lines
 * along the whole wallpaper, and a block's lines along that block.
 */
export function snapTargets(
  { resolution, safeArea, grid, centreLines }: GuideGeometry,
  visibility: Pick<EditorSettings, "gridVisible" | "safeAreaVisible">,
  otherBlocks: Box[],
): SnapTargets {
  const targets: SnapTargets = { vertical: [], horizontal: [] };
  const add = (orientation: Orientation, positions: number[], runningAlong: Box) => {
    const span = spanOf(runningAlong, AXES[orientation].along);
    targets[orientation].push(...positions.map((position) => ({ position, ...span })));
  };
  const wallpaper = { x: 0, y: 0, ...resolution };

  if (visibility.gridVisible) {
    add("vertical", grid.verticalLines, safeArea);
    add("horizontal", grid.horizontalLines, safeArea);
  }
  if (visibility.safeAreaVisible) {
    add("vertical", linesOf(safeArea, "x", EDGES), safeArea);
    add("horizontal", linesOf(safeArea, "y", EDGES), safeArea);
    add("vertical", [centreLines.vertical], wallpaper);
    add("horizontal", [centreLines.horizontal], wallpaper);
  }
  for (const block of otherBlocks) {
    for (const orientation of ORIENTATIONS) add(orientation, linesOf(block, AXES[orientation].at, ALL_LINES), block);
  }
  return targets;
}

/** How far the moving lines must shift on each axis to land on the closest target in reach, or null when none is. */
export interface SnapShift {
  x: number | null;
  y: number | null;
}

/**
 * Snaps a box's moving lines to the targets. On each axis independently, the
 * closest pair of a moving line and a target within `distance` (in wallpaper
 * px) wins, and the shift brings that line exactly onto that target.
 */
export function snap(box: Box, moving: MovingLines, targets: SnapTargets, distance: number): SnapShift {
  return {
    x: closestShift(linesOf(box, "x", moving.x), targets.vertical, distance),
    y: closestShift(linesOf(box, "y", moving.y), targets.horizontal, distance),
  };
}

/** A box after snapping, with the smart guides that show what it lines up with. */
export interface SnappedBox {
  box: Box;
  guides: SmartGuide[];
}

/**
 * Snaps a dragged box by all its lines: it moves by each axis's shift (see
 * `snap`), and gets a smart guide along every target it then lines up with.
 */
export function snapDraggedBox(box: Box, targets: SnapTargets, distance: number): SnappedBox {
  const shift = snap(box, WHOLE_BOX, targets, distance);
  const snapped = { ...box, x: box.x + (shift.x ?? 0), y: box.y + (shift.y ?? 0) };
  return { box: snapped, guides: smartGuidesFor(snapped, WHOLE_BOX, targets) };
}

/**
 * The smart guides for a box: one along every target that one of its moving
 * lines lies on, running along both the box and the target.
 */
export function smartGuidesFor(box: Box, moving: MovingLines, targets: SnapTargets): SmartGuide[] {
  return ORIENTATIONS.flatMap((orientation) => {
    const { at, along } = AXES[orientation];
    return guidesAlong(orientation, linesOf(box, at, moving[at]), targets[orientation], spanOf(box, along));
  });
}

/** How far apart a line and a target can be and still count as lined up: floating-point noise, far below a pixel. */
const LINED_UP = 1e-6;

function closestShift(lines: number[], targets: SnapTarget[], distance: number): number | null {
  let best: number | null = null;
  for (const line of lines) {
    for (const { position } of targets) {
      const shift = position - line;
      if (Math.abs(shift) <= distance && (best === null || Math.abs(shift) < Math.abs(best))) best = shift;
    }
  }
  return best;
}

/** One guide per target position that a line lies on, running along `box` and every target there. */
function guidesAlong(orientation: Orientation, lines: number[], targets: SnapTarget[], box: Span): SmartGuide[] {
  // Targets at the same position (a grid line on a safe-area edge, say) make one guide.
  const guides = new Map<number, SmartGuide>();
  for (const target of targets) {
    if (!lines.some((line) => Math.abs(line - target.position) <= LINED_UP)) continue;
    const guide = guides.get(target.position) ?? { orientation, position: target.position, ...box };
    guides.set(target.position, {
      ...guide,
      from: Math.min(guide.from, target.from),
      to: Math.max(guide.to, target.to),
    });
  }
  return [...guides.values()];
}

/** Where a box runs along one axis: from its start edge to its end edge. */
function spanOf(box: Box, axis: Axis): Span {
  return axis === "x" ? { from: box.x, to: box.x + box.width } : { from: box.y, to: box.y + box.height };
}

/** Where a box's lines are on one axis. */
function linesOf(box: Box, axis: Axis, lines: readonly BoxLine[]): number[] {
  const { from, to } = spanOf(box, axis);
  return lines.map((line) => ({ start: from, centre: from + (to - from) / 2, end: to })[line]);
}
