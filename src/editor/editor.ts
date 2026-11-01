import { parseHexColor } from "./color";
import { centreLinesOf, gridOf, safeAreaOf, type CentreLines, type Grid } from "./geometry";
import { createHistory } from "./history";
import type { Box, EditorSettings, Resolution, TextBlock, Typography, Wallpaper } from "./model";
import { refit } from "./refit";
import { clampResolution, sameResolution } from "./resolution";
import type { TextMeasurer } from "./textMeasurer";

export interface EditorOptions {
  /** Measures text; the app passes the canvas measurer, tests a deterministic fake. */
  measurer: TextMeasurer;
}

/** How a wallpaper change is recorded in the undo history. */
export interface ChangeOptions {
  /** Show the change without recording an undo step yet; a later commit records it. */
  preview?: boolean;
}

/** What the UI reads: everything derived from the wallpaper, the editor settings and the undo history. */
export interface EditorView {
  /** Each block's box, measured from its text, in drawing order. */
  blocks: { id: string; box: Box }[];
  /** The region inside the safe margin. */
  safeArea: Box;
  /** The grid on the safe area. */
  grid: Grid;
  /** The lines through the wallpaper's centre. */
  centreLines: CentreLines;
  /** Whether there is a wallpaper change to undo. */
  canUndo: boolean;
  /** Whether there is an undone wallpaper change to redo. */
  canRedo: boolean;
}

/**
 * The editor core: owns the wallpaper, the editor settings and the undo
 * history. Plain TypeScript with no React or browser APIs, so it can be tested
 * on its own.
 */
export interface Editor {
  getWallpaper(): Wallpaper;
  getSettings(): EditorSettings;
  getView(): EditorView;
  /** Changes editor settings. They aren't part of the wallpaper, so this is never an undo step. */
  setSettings(changes: Partial<EditorSettings>): void;
  /**
   * Sets the wallpaper's background colour from a hex colour as typed or picked
   * ("#RRGGBB" or "#RGB"; see `parseHexColor`). Anything else is ignored. A
   * commit makes everything since the last undo step one step; `{ preview: true }`
   * shows the colour without recording a step yet, e.g. while moving around
   * inside a colour picker.
   */
  setBackground(hex: string, options?: ChangeOptions): void;
  /**
   * Moves the wallpaper to a new resolution, re-fitting its text blocks (see
   * `refit`), as one undo step. Each side is rounded and kept within
   * RESOLUTION_RANGE first; a side that isn't a number is ignored.
   */
  setResolution(resolution: Resolution): void;
  /** Reverts the latest wallpaper change. */
  undo(): void;
  /** Re-applies the latest undone wallpaper change. */
  redo(): void;
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

/** Wallpapers are plain data built the same way, so equal ones serialise identically. */
function sameWallpaper(a: Wallpaper, b: Wallpaper) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export function createEditor({ measurer }: EditorOptions): Editor {
  let settings = DEFAULT_SETTINGS;
  const history = createHistory(startingWallpaper(measurer, settings), sameWallpaper);
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  /** Every wallpaper change goes through here, so each one lands in the undo history. */
  function change(next: Wallpaper, { preview = false }: ChangeOptions = {}) {
    if (preview) history.preview(next);
    else history.commit(next);
    changed();
  }

  /** Undoes or redoes. Landing on another resolution fits the view to the screen, as changing it does. */
  function travel(move: () => void) {
    const { resolution } = history.present;
    move();
    if (!sameResolution(resolution, history.present.resolution)) settings = { ...settings, zoom: "fit" };
    changed();
  }

  return {
    getWallpaper: () => history.present,
    getSettings: () => settings,
    getView: () => {
      const wallpaper = history.present;
      const safeArea = safeAreaOf(wallpaper.resolution, settings.safeMargin);
      return {
        blocks: wallpaper.blocks.map((block) => {
          const { width, height } = measurer.measure(block);
          return { id: block.id, box: { x: block.x, y: block.y, width, height } };
        }),
        safeArea,
        grid: gridOf(safeArea, settings.gridColumns),
        centreLines: centreLinesOf(wallpaper.resolution),
        canUndo: history.canUndo,
        canRedo: history.canRedo,
      };
    },
    setSettings: (changes) => {
      const next = { ...settings, ...changes };
      // A column count that isn't a number can't make a grid, so it's ignored.
      next.gridColumns = Number.isNaN(next.gridColumns) ? settings.gridColumns : clampGridColumns(next.gridColumns);
      settings = next;
      changed();
    },
    setBackground: (hex, options) => {
      const background = parseHexColor(hex);
      if (background === null) return;
      change({ ...history.present, background }, options);
    },
    setResolution: (requested) => {
      // A side that isn't a number can't make a resolution, so it's ignored.
      if (Number.isNaN(requested.width) || Number.isNaN(requested.height)) return;
      const resolution = clampResolution(requested);
      if (sameResolution(resolution, history.present.resolution)) return;
      settings = { ...settings, zoom: "fit" };
      change(refit(history.present, resolution, { safeMargin: settings.safeMargin, measurer }));
    },
    undo: () => travel(() => history.undo()),
    redo: () => travel(() => history.redo()),
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
