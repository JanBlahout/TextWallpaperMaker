import { safeAreaOf } from "./geometry";
import type { Box, EditorSettings, TextBlock, Typography, Wallpaper } from "./model";
import type { TextMeasurer } from "./textMeasurer";

export interface EditorOptions {
  /** Measures text; the app passes the canvas measurer, tests a deterministic fake. */
  measurer: TextMeasurer;
}

/** What the UI reads: everything derived from the wallpaper. */
export interface EditorView {
  /** Each block's box, measured from its text, in drawing order. */
  blocks: { id: string; box: Box }[];
}

/**
 * The editor core: owns the wallpaper and the editor settings. Plain TypeScript
 * with no React or browser APIs, so it can be tested on its own.
 */
export interface Editor {
  getWallpaper(): Wallpaper;
  getSettings(): EditorSettings;
  getView(): EditorView;
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
  const settings = DEFAULT_SETTINGS;
  const wallpaper = startingWallpaper(measurer, settings);

  return {
    getWallpaper: () => wallpaper,
    getSettings: () => settings,
    getView: () => ({
      blocks: wallpaper.blocks.map((block) => {
        const { width, height } = measurer.measure(block);
        return { id: block.id, box: { x: block.x, y: block.y, width, height } };
      }),
    }),
  };
}
