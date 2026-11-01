import type { Box, Resolution, SafeMargin } from "./model";

/** The safe area: the wallpaper inset on every side by the safe margin % of its shorter side. */
export function safeAreaOf({ width, height }: Resolution, safeMargin: SafeMargin): Box {
  const inset = (safeMargin / 100) * Math.min(width, height);
  return { x: inset, y: inset, width: width - 2 * inset, height: height - 2 * inset };
}

/** The grid built on the safe area. Lengths and line positions are in wallpaper px. */
export interface Grid {
  columns: number;
  rows: number;
  columnWidth: number;
  rowHeight: number;
  /** X of every vertical grid line, left to right; the first and last are the safe-area edges. */
  verticalLines: number[];
  /** Y of every horizontal grid line, top to bottom; the first and last are the safe-area edges. */
  horizontalLines: number[];
}

/**
 * Columns evenly divide the safe-area width. Rows are as many as make cells
 * closest to square (the nearest whole number to height ÷ column width, at
 * least 1), and evenly divide the safe-area height.
 */
export function gridOf(safeArea: Box, columns: number): Grid {
  const columnWidth = safeArea.width / columns;
  const rows = Math.max(1, Math.round(safeArea.height / columnWidth));
  return {
    columns,
    rows,
    columnWidth,
    rowHeight: safeArea.height / rows,
    verticalLines: divide(safeArea.x, safeArea.width, columns),
    horizontalLines: divide(safeArea.y, safeArea.height, rows),
  };
}

/** The positions that split [start, start + length] into `parts` equal parts, both ends included. */
function divide(start: number, length: number, parts: number): number[] {
  return Array.from({ length: parts + 1 }, (_, i) => (i === parts ? start + length : start + (i * length) / parts));
}

/** Where the centre lines run: the vertical one's x and the horizontal one's y. */
export interface CentreLines {
  vertical: number;
  horizontal: number;
}

export function centreLinesOf({ width, height }: Resolution): CentreLines {
  return { vertical: width / 2, horizontal: height / 2 };
}
