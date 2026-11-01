/**
 * The wallpaper and editor-settings model. Vocabulary follows GLOSSARY.md.
 * Every length is in real wallpaper pixels (ADR 0001).
 */

export type LineAlign = "left" | "center" | "right";

/** How a text block's text looks. Shared by blocks, measurement and rendering. */
export interface Typography {
  /** An id from the font registry. */
  fontId: string;
  /** Font size in wallpaper px; may be fractional. */
  fontSize: number;
  fontWeight: number;
  /** Letter spacing as a percentage of the font size. */
  letterSpacing: number;
  /** Line height as a multiplier of the font size. */
  lineHeight: number;
  /** How the lines line up inside the block's box. */
  align: LineAlign;
  /** Text colour as a hex string, e.g. "#F2F2F2". */
  color: string;
  /** Opacity from 0 to 100. */
  opacity: number;
  /** Uppercase changes only how the text looks, never the stored text. */
  uppercase: boolean;
}

/** A block's text with its typography: everything measurement depends on. */
export interface TextContent extends Typography {
  /** The text as typed. Lines are separated by "\n"; nothing wraps (ADR 0002). */
  text: string;
}

/**
 * A text block. Its width and height are never stored: the box always hugs
 * its text, so they come from measurement (ADR 0002).
 */
export interface TextBlock extends TextContent {
  id: string;
  /** X of the box's top-left corner, from the wallpaper's left edge. */
  x: number;
  /** Y of the box's top-left corner, from the wallpaper's top edge. */
  y: number;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface Wallpaper {
  resolution: Resolution;
  /** Solid background colour as a hex string. */
  background: string;
  /** Ordered back to front: later blocks draw on top. */
  blocks: TextBlock[];
}

/** The safe margins to choose from, as percentages of the wallpaper's shorter side. */
export const SAFE_MARGINS = [5, 8, 10] as const;

/** The safe margin as a percentage of the wallpaper's shorter side. */
export type SafeMargin = (typeof SAFE_MARGINS)[number];

/** The range of grid column counts; a requested count is rounded and kept within it. */
export const GRID_COLUMNS_RANGE = { min: 1, max: 48 } as const;

/** What the quick-align actions align against. */
export type AlignTarget = "safe-area" | "wallpaper";

/** "fit" fits the wallpaper to the canvas; a number is a zoom factor (1 = 100%). */
export type Zoom = "fit" | number;

export interface Point {
  x: number;
  y: number;
}

/** Persisted editor preferences; not part of the wallpaper. */
export interface EditorSettings {
  safeMargin: SafeMargin;
  gridColumns: number;
  gridVisible: boolean;
  /** Safe-area guides, including the centre lines. */
  safeAreaVisible: boolean;
  snapping: boolean;
  alignTarget: AlignTarget;
  zoom: Zoom;
  /**
   * Where the canvas is panned to: the wallpaper point (in wallpaper px) shown
   * at the centre of the canvas, so a restored view doesn't depend on the
   * window size. Ignored while zoom is "fit".
   */
  pan: Point;
}

/** An axis-aligned rectangle in wallpaper px. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
