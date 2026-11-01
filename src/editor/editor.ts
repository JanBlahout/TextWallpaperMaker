import { alignedPosition, alignTargetOf, type AlignPosition } from "./align";
import { parseHexColor } from "./color";
import { centreLinesOf, gridOf, safeAreaOf, type CentreLines, type Grid } from "./geometry";
import { createHistory } from "./history";
import {
  GRID_COLUMNS_RANGE,
  type Box,
  type EditorSettings,
  type Point,
  type Resolution,
  type TextBlock,
  type Typography,
  type Wallpaper,
} from "./model";
import { refit } from "./refit";
import { clampResolution, sameResolution } from "./resolution";
import { deserialise, serialise } from "./serialisation";
import {
  snapDistance,
  snapDraggedBox,
  snapTargets,
  type SmartGuide,
  type SnapOptions,
  type SnapTargets,
} from "./snapping";
import { isBlank, newTextBlock } from "./textBlocks";
import type { TextMeasurer } from "./textMeasurer";
import { withTypography } from "./typography";

export interface EditorOptions {
  /** Measures text; the app passes the canvas measurer, tests a deterministic fake. */
  measurer: TextMeasurer;
}

/** How a wallpaper change is recorded in the undo history. */
export interface ChangeOptions {
  /** Show the change without recording an undo step yet; a later commit records it. */
  preview?: boolean;
}

export type NudgeDirection = "left" | "right" | "up" | "down";

/** How far one nudge moves a block, in wallpaper px: arrow keys take a small step, Shift+arrow a large one. */
const NUDGE_STEPS = { small: 1, large: 10 } as const;

export type NudgeStep = keyof typeof NUDGE_STEPS;

/** How far a duplicate lands right and down of its original, as a fraction of the wallpaper's shorter side. */
const DUPLICATE_OFFSET = 0.02;

/**
 * A gesture in progress: a drag (the block, where the pointer grabbed it,
 * where its box started, what it can snap to and the smart guides showing),
 * a run of nudges, or a session of editing a block's text in place. Each is
 * one undo step.
 */
type Gesture =
  | { kind: "move"; id: string; grab: Point; start: Box; targets: SnapTargets; guides: SmartGuide[] }
  | { kind: "nudge" }
  | { kind: "edit"; id: string };

/** A text block's id with its box, measured from its text. */
export interface BlockBox {
  id: string;
  box: Box;
}

/** What the UI reads: everything derived from the wallpaper, the editor settings, the selection and the undo history. */
export interface EditorView {
  /** Each block's box, measured from its text, in drawing order. */
  blocks: BlockBox[];
  /** The selected block, or null when nothing is selected. */
  selection: BlockBox | null;
  /** The block whose text is being edited in place (always the selected one), or null. */
  editing: BlockBox | null;
  /** The region inside the safe margin. */
  safeArea: Box;
  /** The grid on the safe area. */
  grid: Grid;
  /** The lines through the wallpaper's centre. */
  centreLines: CentreLines;
  /** What the dragged block is snapped to right now; empty when nothing is. */
  smartGuides: SmartGuide[];
  /** Whether there is a wallpaper change to undo. */
  canUndo: boolean;
  /** Whether there is an undone wallpaper change to redo. */
  canRedo: boolean;
}

/**
 * The editor core: owns the wallpaper, the editor settings, the selection and
 * the undo history. Plain TypeScript with no React or browser APIs, so it can
 * be tested on its own.
 */
export interface Editor {
  getWallpaper(): Wallpaper;
  getSettings(): EditorSettings;
  getView(): EditorView;
  /**
   * Changes editor settings. They aren't part of the wallpaper, so this is never
   * an undo step, and zooming or panning alone doesn't end a drag or a run of nudges.
   */
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
  /**
   * What clicking the canvas does: selects the topmost block whose box
   * contains `point` (in wallpaper px), or deselects when there's none.
   * Selection is never an undo step.
   */
  selectAt(point: Point): void;
  /** Clears the selection, as Escape does. Never an undo step. */
  deselect(): void;
  /**
   * Starts dragging the selected block, grabbed at `point` (in wallpaper px).
   * Does nothing when nothing is selected. The block follows each
   * `updateMove`, and `endMove`, or any other command, makes the whole drag
   * one undo step.
   */
  beginMove(point: Point): void;
  /**
   * Moves the dragged block by how far the pointer has moved since
   * `beginMove`, in whole wallpaper px. While snapping is on and not bypassed,
   * the block's left, centre and right then snap to the closest vertical
   * target within 6 screen px, and its top, middle and bottom to the closest
   * horizontal one: grid lines while the grid is visible, safe-area edges and
   * centre lines while the safe-area guides are, and other blocks' edges and
   * centres. The view reports smart guides for what it lines up with.
   */
  updateMove(point: Point, options?: SnapOptions): void;
  /** Finishes the drag, recording it as one undo step if the block moved. */
  endMove(): void;
  /**
   * Moves the selected block one step in `direction`. Does nothing when nothing
   * is selected. A run of consecutive nudges is one undo step, which any other
   * command ends.
   */
  nudge(direction: NudgeDirection, step?: NudgeStep): void;
  /**
   * Moves the selected block so its box's top-left corner is at the given X
   * and/or Y (in wallpaper px), as typed in the inspector: one undo step. A
   * coordinate that isn't a finite number is ignored.
   */
  setPosition(position: Partial<Point>): void;
  /**
   * Quick align: lines the selected block's box up with the align target in
   * the editor settings (the safe area or the whole wallpaper), as one undo
   * step. Left, centre and right move it across; top, middle and bottom move
   * it up or down. Does nothing when nothing is selected.
   */
  align(position: AlignPosition): void;
  /**
   * Copies the selected block, right and down by 2% of the wallpaper's shorter
   * side and on top of every other block, and selects the copy: one undo step.
   * Does nothing when nothing is selected.
   */
  duplicate(): void;
  /** Removes the selected block, leaving nothing selected: one undo step. Does nothing when nothing is selected. */
  delete(): void;
  /**
   * Changes the selected block's typography, as set in the inspector (see
   * `withTypography` for which values are accepted). Does nothing when nothing
   * is selected. A commit is one undo step; `{ preview: true }` shows the change
   * without recording a step yet, e.g. while dragging a slider.
   */
  setTypography(changes: Partial<Typography>, options?: ChangeOptions): void;
  /**
   * Adds a text block reading "TEXT" on top of the others, its box centred in
   * the safe area, in the selected block's style, or the default style when
   * nothing is selected. The new block is selected and its text opened for
   * editing in place, so adding it and typing into it are one undo step.
   */
  addText(): void;
  /**
   * Opens the selected block's text for editing in place, as double-clicking
   * it does. Does nothing when nothing is selected. Each `setText` shows
   * straight away, and `endTextEdit`, or any other command, makes the whole
   * session one undo step.
   */
  beginTextEdit(): void;
  /**
   * Sets the selected block's text as typed, with lines separated by "\n";
   * uppercase only changes how it looks. While the block is being edited in
   * place, this is part of that session. Otherwise, as in the inspector, a
   * commit is one undo step and `{ preview: true }` shows the text without
   * recording a step yet. Text that's blank (empty, or only spaces and line
   * breaks) when it's committed or the session ends deletes the block, in the
   * same step. Does nothing when nothing is selected.
   */
  setText(text: string, options?: ChangeOptions): void;
  /** Finishes editing the block's text in place, recording the session as one undo step if the text changed. */
  endTextEdit(): void;
  /** Reverts the latest wallpaper change. */
  undo(): void;
  /** Re-applies the latest undone wallpaper change. */
  redo(): void;
  /**
   * Resets the wallpaper to the starting wallpaper as one undo step, so it
   * needs no confirmation. The editor settings stay as they are, except that a
   * change of resolution fits the view to the screen, as it always does.
   */
  newWallpaper(): void;
  /** The wallpaper and editor settings in the saved format, for `load` to read back. */
  serialise(): string;
  /**
   * Replaces the wallpaper and editor settings with saved ones and starts a
   * fresh undo history, with nothing selected. Missing (null), unreadable or unrecognised data loads
   * the starting wallpaper and default editor settings instead.
   */
  load(saved: string | null): void;
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
  /** The selected block's id. Session-only: never part of the wallpaper or the undo history. */
  let selectedId: string | null = null;
  /** The open gesture, whose changes are previewed until it ends as one undo step. */
  let gesture: Gesture | null = null;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  /** Opens a gesture. Whatever was showing is recorded first, so it never joins the gesture's step. */
  function startGesture(next: Gesture) {
    endGesture();
    history.commit(history.present);
    gesture = next;
  }

  /**
   * Ends the open gesture, recording it as one undo step. Every command does
   * this first, except one that carries the gesture on. Returns the id of the
   * block it deleted for being left blank by an edit, or null.
   */
  function endGesture(): string | null {
    if (!gesture) return null;
    const ended = gesture;
    gesture = null;
    if (ended.kind === "edit" && hasBlankText(history.present, ended.id)) {
      // A block that shows nothing would only clutter the wallpaper, so it goes, in the edit's own step.
      if (selectedId === ended.id) selectedId = null;
      history.commit(withoutBlock(history.present, ended.id));
      return ended.id;
    }
    history.commit(history.present);
    return null;
  }

  /** Removes the selected block, leaving nothing selected, as one undo step. */
  function deleteSelected() {
    const block = selectedBlock();
    if (!block) return;
    selectedId = null;
    change(withoutBlock(history.present, block.id));
  }


  /** Every wallpaper change outside a gesture goes through here, so each one lands in the undo history. */
  function change(next: Wallpaper, { preview = false }: ChangeOptions = {}) {
    const deleted = endGesture();
    // `next` was made from the wallpaper before the edit it ended took a blank
    // block away; the block stays gone, unless `next` is fresh and gives that id text.
    if (deleted !== null && hasBlankText(next, deleted)) next = withoutBlock(next, deleted);
    if (preview) history.preview(next);
    else history.commit(next);
    changed();
  }

  /** Shows a step of the open gesture; the gesture is recorded when it ends. */
  function continueGesture(next: Wallpaper) {
    history.preview(next);
    changed();
  }

  /** Undoes or redoes. Landing on another resolution fits the view to the screen, as changing it does. */
  function stepThroughHistory(move: () => void) {
    endGesture();
    const { resolution } = history.present;
    move();
    // A selected block the step took away stays forgotten, so its id can't select a later block.
    if (!selectedBlock()) selectedId = null;
    if (!sameResolution(resolution, history.present.resolution)) settings = { ...settings, zoom: "fit" };
    changed();
  }

  /** The id of the block whose text is being edited in place, or null. */
  function editingId(): string | null {
    return gesture?.kind === "edit" ? gesture.id : null;
  }

  function selectedBlock(): TextBlock | undefined {
    return history.present.blocks.find(({ id }) => id === selectedId);
  }

  /** Where the guides run under the current settings. */
  function guideGeometry() {
    const { resolution } = history.present;
    const safeArea = safeAreaOf(resolution, settings.safeMargin);
    return { resolution, safeArea, grid: gridOf(safeArea, settings.gridColumns), centreLines: centreLinesOf(resolution) };
  }

  function blockBoxes(): BlockBox[] {
    return history.present.blocks.map((block) => {
      const { width, height } = measurer.measure(block);
      return { id: block.id, box: { x: block.x, y: block.y, width, height } };
    });
  }

  return {
    getWallpaper: () => history.present,
    getSettings: () => settings,
    getView: () => {
      const wallpaper = history.present;
      const safeArea = safeAreaOf(wallpaper.resolution, settings.safeMargin);
      const blocks = blockBoxes();
      return {
        blocks,
        selection: blocks.find(({ id }) => id === selectedId) ?? null,
        editing: blocks.find(({ id }) => id === editingId()) ?? null,
        safeArea,
        grid: gridOf(safeArea, settings.gridColumns),
        centreLines: centreLinesOf(wallpaper.resolution),
        smartGuides: gesture?.kind === "move" ? gesture.guides : [],
        canUndo: history.canUndo,
        canRedo: history.canRedo,
      };
    },
    setSettings: (changes) => {
      // Zooming and panning only change how the wallpaper is shown, so a drag carries on through them.
      if (Object.keys(changes).some((key) => key !== "zoom" && key !== "pan")) endGesture();
      const next = { ...settings, ...changes };
      // A column count that isn't a number can't make a grid, so it's ignored.
      next.gridColumns = Number.isNaN(next.gridColumns) ? settings.gridColumns : clampGridColumns(next.gridColumns);
      // A zoom or pan that isn't a finite number couldn't be saved, so it's ignored too.
      if (next.zoom !== "fit" && !(Number.isFinite(next.zoom) && next.zoom > 0)) next.zoom = settings.zoom;
      if (!Number.isFinite(next.pan.x) || !Number.isFinite(next.pan.y)) next.pan = settings.pan;
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
    selectAt: (point) => {
      endGesture();
      // Later blocks draw on top, so the last one under the point wins.
      selectedId = blockBoxes().findLast(({ box }) => contains(box, point))?.id ?? null;
      changed();
    },
    deselect: () => {
      endGesture();
      selectedId = null;
      changed();
    },
    beginMove: (point) => {
      endGesture();
      const block = selectedBlock();
      if (!block) return;
      const boxes = blockBoxes();
      const start = boxes.find(({ id }) => id === block.id)!.box;
      const others = boxes.filter(({ id }) => id !== block.id).map(({ box }) => box);
      const targets = snapTargets(guideGeometry(), settings, others);
      startGesture({ kind: "move", id: block.id, grab: point, start, targets, guides: [] });
    },
    updateMove: (point, { viewScale, bypassSnapping = false } = {}) => {
      if (gesture?.kind !== "move") return;
      const { id, grab, start, targets } = gesture;
      // Whole wallpaper pixels, like nudges, so positions stay tidy at any zoom; a snap lands exactly.
      const offset = { x: Math.round(point.x - grab.x), y: Math.round(point.y - grab.y) };
      const moved = { ...start, x: start.x + offset.x, y: start.y + offset.y };
      // A click that doesn't move the block leaves it where it is, even beside a guide.
      const snaps = settings.snapping && !bypassSnapping && (offset.x !== 0 || offset.y !== 0);
      const { box, guides } = snaps
        ? snapDraggedBox(moved, targets, snapDistance(viewScale))
        : { box: moved, guides: [] };
      gesture = { ...gesture, guides };
      continueGesture(withPosition(history.present, id, { x: box.x, y: box.y }));
    },
    endMove: () => {
      if (gesture?.kind !== "move") return;
      endGesture();
      changed();
    },
    nudge: (direction, step = "small") => {
      const block = selectedBlock();
      if (!block) return;
      if (gesture?.kind !== "nudge") startGesture({ kind: "nudge" });
      const distance = NUDGE_STEPS[step];
      const { x, y } = block;
      const position = {
        left: { x: x - distance, y },
        right: { x: x + distance, y },
        up: { x, y: y - distance },
        down: { x, y: y + distance },
      }[direction];
      continueGesture(withPosition(history.present, block.id, position));
    },
    setPosition: (position) => {
      const block = selectedBlock();
      if (!block) return;
      // A coordinate that isn't a finite number (an emptied field) is ignored.
      const finiteOr = (current: number, value: number | undefined) =>
        value !== undefined && Number.isFinite(value) ? value : current;
      change(
        withPosition(history.present, block.id, { x: finiteOr(block.x, position.x), y: finiteOr(block.y, position.y) }),
      );
    },
    align: (position) => {
      const selection = blockBoxes().find(({ id }) => id === selectedId);
      if (!selection) return;
      const target = alignTargetOf(history.present.resolution, settings);
      change(withPosition(history.present, selection.id, alignedPosition(selection.box, target, position)));
    },
    duplicate: () => {
      const block = selectedBlock();
      if (!block) return;
      const wallpaper = history.present;
      const { width, height } = wallpaper.resolution;
      const offset = DUPLICATE_OFFSET * Math.min(width, height);
      const copy = { ...block, id: unusedBlockId(wallpaper), x: block.x + offset, y: block.y + offset };
      selectedId = copy.id;
      change(withBlockOnTop(wallpaper, copy));
    },
    delete: deleteSelected,
    addText: () => {
      const safeArea = safeAreaOf(history.present.resolution, settings.safeMargin);
      const block = newTextBlock(unusedBlockId(history.present), selectedBlock() ?? DEFAULT_TYPOGRAPHY, safeArea, measurer);
      startGesture({ kind: "edit", id: block.id });
      selectedId = block.id;
      continueGesture(withBlockOnTop(history.present, block));
    },
    beginTextEdit: () => {
      const block = selectedBlock();
      if (!block || editingId() === block.id) return;
      startGesture({ kind: "edit", id: block.id });
      changed();
    },
    setText: (text, options) => {
      const block = selectedBlock();
      if (!block) return;
      if (editingId() === block.id) continueGesture(withText(history.present, block.id, text));
      else if (isBlank(text) && !options?.preview) deleteSelected();
      else change(withText(history.present, block.id, text), options);
    },
    endTextEdit: () => {
      if (!editingId()) return;
      endGesture();
      changed();
    },
    setTypography: (changes, options) => {
      const block = selectedBlock();
      if (!block) return;
      change(withBlock(history.present, block.id, (current) => withTypography(current, changes)), options);
    },
    undo: () => stepThroughHistory(() => history.undo()),
    redo: () => stepThroughHistory(() => history.redo()),
    newWallpaper: () => {
      const starting = startingWallpaper(measurer, settings);
      if (!sameResolution(starting.resolution, history.present.resolution)) settings = { ...settings, zoom: "fit" };
      change(starting);
    },
    serialise: () => serialise({ wallpaper: history.present, settings }),
    load: (saved) => {
      const loaded = deserialise(saved);
      settings = loaded?.settings ?? DEFAULT_SETTINGS;
      // A fresh start: no gesture carries over, and nothing is selected.
      gesture = null;
      selectedId = null;
      history.reset(loaded?.wallpaper ?? startingWallpaper(measurer, settings));
      changed();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The wallpaper with one block moved so its box's top-left corner is at `position`. */
function withPosition(wallpaper: Wallpaper, id: string, position: Point): Wallpaper {
  return withBlock(wallpaper, id, (block) => ({ ...block, ...position }));
}

/** The wallpaper with one block replaced by `update`'s version of it. */
function withBlock(wallpaper: Wallpaper, id: string, update: (block: TextBlock) => TextBlock): Wallpaper {
  return { ...wallpaper, blocks: wallpaper.blocks.map((block) => (block.id === id ? update(block) : block)) };
}

/** The wallpaper with `block` added on top of the others: later blocks draw on top. */
function withBlockOnTop(wallpaper: Wallpaper, block: TextBlock): Wallpaper {
  return { ...wallpaper, blocks: [...wallpaper.blocks, block] };
}

/** Whether the wallpaper has a block `id` whose text is blank. */
function hasBlankText(wallpaper: Wallpaper, id: string): boolean {
  const block = wallpaper.blocks.find((candidate) => candidate.id === id);
  return block !== undefined && isBlank(block.text);
}

/** The wallpaper without one block. */
function withoutBlock(wallpaper: Wallpaper, id: string): Wallpaper {
  return { ...wallpaper, blocks: wallpaper.blocks.filter((block) => block.id !== id) };
}

/** The wallpaper with one block's text replaced, as typed. */
function withText(wallpaper: Wallpaper, id: string, text: string): Wallpaper {
  return withBlock(wallpaper, id, (block) => ({ ...block, text }));
}

/** A block id the wallpaper doesn't use yet, like "block-2". */
function unusedBlockId(wallpaper: Wallpaper) {
  const used = new Set(wallpaper.blocks.map(({ id }) => id));
  let n = wallpaper.blocks.length + 1;
  while (used.has(`block-${n}`)) n++;
  return `block-${n}`;
}

/** Whether `point` is inside `box` or on its edge. */
function contains(box: Box, point: Point) {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

/** Rounds a column count to a whole number and keeps it within GRID_COLUMNS_RANGE. */
function clampGridColumns(columns: number) {
  return Math.min(GRID_COLUMNS_RANGE.max, Math.max(GRID_COLUMNS_RANGE.min, Math.round(columns)));
}
