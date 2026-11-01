import { centreLinesOf, gridOf, safeAreaOf, type CentreLines, type Grid } from "./geometry";
import type { Box, EditorSettings, TextBlock, Typography, Wallpaper } from "./model";
import type { TextMeasurer } from "./textMeasurer";

export interface EditorOptions {
  /** Measures text; the app passes the canvas measurer, tests a deterministic fake. */
  measurer: TextMeasurer;
}

/** What the UI reads: everything derived from the wallpaper and the editor settings. */
export interface EditorView {
  /** Each block's box, measured from its text, in drawing order. */
  blocks: { id: string; box: Box }[];
  /** The region inside the safe margin. */
  safeArea: Box;
  /** The grid on the safe area. */
  grid: Grid;
  /** The lines through the wallpaper's centre. */
  centreLines: CentreLines;
}

/**
 * The editor core: owns the wallpaper and the editor settings. Plain TypeScript
 * with no React or browser APIs, so it can be tested on its own.
 */
export interface Editor {
  getWallpaper(): Wallpaper;
  getSettings(): EditorSettings;
  getView(): EditorView;
  /** Changes editor settings. They aren't part of the wallpaper, so this is never an undo step. */
  setSettings(changes: Partial<EditorSettings>): void;
  /** Calls `listener` after every change; returns a function that stops it. */
  subscribe(listener: () => void): () => void;
}

/** The style of the starting block, and of new blocks when nothing is selected. */
export const DEFAULT_TYPOGRAPHY: Typography = {
  fontId: "ocr-a",
  fontSize: 96,
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: 1.1,
  align: "left",
  color: "#F2F2F2",
  opacity: 100,
  uppercase: true,
};

export const DEFAULT_SETTINGS: EditorSettings = {
  safeMargin: 5,
  gridColumns: 12,
  gridVisible: true,
  safeAreaVisible: true,
  snapping: true,
  alignTarget: "safe-area",
  zoom: "fit",
  pan: { x: 0, y: 0 },
};

/** The range of grid column counts; a requested count is rounded and kept within it. */
export const GRID_COLUMNS_RANGE = { min: 1, max: 48 } as const;

/**
 * The example the editor opens on: "DISCIPLINE / EQUALS / FREEDOM." on a black
 * 1920 × 1080 wallpaper, its box placed from its measured size at the
 * bottom-left of the safe area.
 */
function startingWallpaper(measurer: TextMeasurer, settings: EditorSettings): Wallpaper {
  const resolution = { width: 1920, height: 1080 };
  const content = { text: "DISCIPLINE\nEQUALS\nFREEDOM.", ...DEFAULT_TYPOGRAPHY };
  const { height } = measurer.measure(content);
  const safeArea = safeAreaOf(resolution, settings.safeMargin);
  const block: TextBlock = {
    id: "block-1",
    ...content,
    x: safeArea.x,
    y: safeArea.y + safeArea.height - height,
  };
  return { resolution, background: "#000000", blocks: [block] };
}

export function createEditor({ measurer }: EditorOptions): Editor {
  let settings = DEFAULT_SETTINGS;
  const wallpaper = startingWallpaper(measurer, settings);
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  return {
    getWallpaper: () => wallpaper,
    getSettings: () => settings,
    getView: () => {
      const safeArea = safeAreaOf(wallpaper.resolution, settings.safeMargin);
      return {
        blocks: wallpaper.blocks.map((block) => {
          const { width, height } = measurer.measure(block);
          return { id: block.id, box: { x: block.x, y: block.y, width, height } };
        }),
        safeArea,
        grid: gridOf(safeArea, settings.gridColumns),
        centreLines: centreLinesOf(wallpaper.resolution),
      };
    },
    setSettings: (changes) => {
      const next = { ...settings, ...changes };
      // A column count that isn't a number can't make a grid, so it's ignored.
      next.gridColumns = Number.isNaN(next.gridColumns) ? settings.gridColumns : clampGridColumns(next.gridColumns);
      settings = next;
      changed();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Rounds a column count to a whole number and keeps it within GRID_COLUMNS_RANGE. */
function clampGridColumns(columns: number) {
  return Math.min(GRID_COLUMNS_RANGE.max, Math.max(GRID_COLUMNS_RANGE.min, Math.round(columns)));
}
