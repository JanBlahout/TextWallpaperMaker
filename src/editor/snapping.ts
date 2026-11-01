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

/** Every line of the box: a dragged block snaps by its left, centre and right, and its top, middle and bottom. */
export const WHOLE_BOX: MovingLines = { x: ALL_LINES, y: ALL_LINES };

/** A line to snap to: at `position` across its axis, running from `from` to `to` along it, in wallpaper px. */
export interface SnapLine {
  position: number;
  from: number;
  to: number;
}

/** Everything a moving box can snap to: vertical lines (at an x) and horizontal lines (at a y). */
export interface SnapTargets {
  vertical: SnapLine[];
  horizontal: SnapLine[];
}

/**
 * A temporary guide that shows what a moving block lines up with: a vertical
 * line at x = `position` or a horizontal one at y = `position`, running along
 * the block and what it lines up with.
 */
export interface SmartGuide extends SnapLine {
  orientation: "vertical" | "horizontal";
}

/** The wallpaper's structure, as the editor view describes it. */
export interface WallpaperStructure {
  resolution: Resolution;
  safeArea: Box;
  grid: Grid;
  centreLines: CentreLines;
}

/**
 * What a block can snap to: the grid lines while the grid is visible, the
 * safe-area edges and centre lines while the safe-area guides are visible,
 * and the edges and centres of `otherBlocks`.
 */
export function snapTargets(
  { resolution, safeArea, grid, centreLines }: WallpaperStructure,
  visibility: Pick<EditorSettings, "gridVisible" | "safeAreaVisible">,
  otherBlocks: Box[],
): SnapTargets {
  const across = { from: safeArea.y, to: safeArea.y + safeArea.height };
  const down = { from: safeArea.x, to: safeArea.x + safeArea.width };
  const targets: SnapTargets = { vertical: [], horizontal: [] };

  if (visibility.gridVisible) {
    targets.vertical.push(...grid.verticalLines.map((position) => ({ position, ...across })));
    targets.horizontal.push(...grid.horizontalLines.map((position) => ({ position, ...down })));
  }
  if (visibility.safeAreaVisible) {
    // The safe-area edges run along the safe area, and the centre lines across the whole wallpaper.
    targets.vertical.push(
      { position: safeArea.x, ...across },
      { position: safeArea.x + safeArea.width, ...across },
      { position: centreLines.vertical, from: 0, to: resolution.height },
    );
    targets.horizontal.push(
      { position: safeArea.y, ...down },
      { position: safeArea.y + safeArea.height, ...down },
      { position: centreLines.horizontal, from: 0, to: resolution.width },
    );
  }
  for (const block of otherBlocks) {
    const along = { from: block.y, to: block.y + block.height };
    const across = { from: block.x, to: block.x + block.width };
    targets.vertical.push(...linesOf(block, "x", ALL_LINES).map((position) => ({ position, ...along })));
    targets.horizontal.push(...linesOf(block, "y", ALL_LINES).map((position) => ({ position, ...across })));
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
 * lines lies on, running across both the box and the target.
 */
export function smartGuidesFor(box: Box, moving: MovingLines, targets: SnapTargets): SmartGuide[] {
  return [
    ...guidesAlong("vertical", linesOf(box, "x", moving.x), targets.vertical, { from: box.y, to: box.y + box.height }),
    ...guidesAlong("horizontal", linesOf(box, "y", moving.y), targets.horizontal, {
      from: box.x,
      to: box.x + box.width,
    }),
  ];
}

/** How far apart a line and a target can be and still count as lined up: floating-point noise, far below a pixel. */
const LINED_UP = 1e-6;

function closestShift(lines: number[], targets: SnapLine[], distance: number): number | null {
  let best: number | null = null;
  for (const line of lines) {
    for (const { position } of targets) {
      const shift = position - line;
      if (Math.abs(shift) <= distance && (best === null || Math.abs(shift) < Math.abs(best))) best = shift;
    }
  }
  return best;
}

function guidesAlong(
  orientation: SmartGuide["orientation"],
  lines: number[],
  targets: SnapLine[],
  box: { from: number; to: number },
): SmartGuide[] {
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

/** Where a box's lines are on one axis. */
function linesOf(box: Box, axis: "x" | "y", lines: readonly BoxLine[]): number[] {
  const start = axis === "x" ? box.x : box.y;
  const length = axis === "x" ? box.width : box.height;
  return lines.map((line) => ({ start, centre: start + length / 2, end: start + length })[line]);
}
