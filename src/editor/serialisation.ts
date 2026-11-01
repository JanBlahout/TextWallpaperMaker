import { findFont } from "@/fonts/registry";
import { parseHexColor } from "./color";
import {
  ALIGN_TARGETS,
  GRID_COLUMNS_RANGE,
  LINE_ALIGNS,
  SAFE_MARGINS,
  type EditorSettings,
  type Point,
  type Resolution,
  type TextBlock,
  type Wallpaper,
} from "./model";
import { RESOLUTION_RANGE } from "./resolution";

/** What the Editor saves: the wallpaper and the editor settings, never the undo history or the selection. */
export interface SavedEditor {
  wallpaper: Wallpaper;
  settings: EditorSettings;
}

/**
 * The saved format's version. Changing the shape of the wallpaper or the
 * editor settings needs a new version (and a migration from the old one, to
 * keep people's wallpapers); data of any other version loads as unrecognised.
 */
const SAVE_VERSION = 1;

/** The wallpaper and editor settings as versioned JSON. */
export function serialise({ wallpaper, settings }: SavedEditor): string {
  return JSON.stringify({ version: SAVE_VERSION, wallpaper, settings });
}

/**
 * Reads what `serialise` wrote. Returns null when `saved` is missing,
 * unreadable or unrecognised: another version, or anything that isn't a
 * wallpaper and editor settings the editor can show, such as a font it doesn't
 * have or a resolution outside the range.
 */
export function deserialise(saved: string | null): SavedEditor | null {
  if (saved === null) return null;
  try {
    const data = readRecord(JSON.parse(saved));
    if (data.version !== SAVE_VERSION) return null;
    return { wallpaper: readWallpaper(data.wallpaper), settings: readSettings(data.settings) };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof UnrecognisedData) return null;
    throw error;
  }
}

// The readers rebuild each value field by field, in the order the Editor builds
// them, so unknown fields are dropped and a loaded wallpaper serialises exactly
// like an equal one the Editor made. Each throws UnrecognisedData on a bad value.

function readWallpaper(value: unknown): Wallpaper {
  const { resolution, background, blocks } = readRecord(value);
  const wallpaper = {
    resolution: readResolution(resolution),
    background: readColor(background),
    blocks: readList(blocks).map(readBlock),
  };
  const ids = new Set(wallpaper.blocks.map((block) => block.id));
  if (ids.size !== wallpaper.blocks.length) unrecognised();
  return wallpaper;
}

function readResolution(value: unknown): Resolution {
  const { width, height } = readRecord(value);
  return { width: readWholeNumber(width, RESOLUTION_RANGE), height: readWholeNumber(height, RESOLUTION_RANGE) };
}

function readBlock(value: unknown): TextBlock {
  const block = readRecord(value);
  const font = (typeof block.fontId === "string" && findFont(block.fontId)) || unrecognised();
  return {
    id: readString(block.id, (id) => id.length > 0),
    text: readString(block.text),
    fontId: font.id,
    fontSize: readNumber(block.fontSize, (size) => size > 0),
    fontWeight: readOneOf(block.fontWeight, font.weights),
    letterSpacing: readNumber(block.letterSpacing),
    lineHeight: readNumber(block.lineHeight, (height) => height > 0),
    align: readOneOf(block.align, LINE_ALIGNS),
    color: readColor(block.color),
    opacity: readNumber(block.opacity, (opacity) => opacity >= 0 && opacity <= 100),
    uppercase: readBoolean(block.uppercase),
    x: readNumber(block.x),
    y: readNumber(block.y),
  };
}

function readSettings(value: unknown): EditorSettings {
  const settings = readRecord(value);
  return {
    safeMargin: readOneOf(settings.safeMargin, SAFE_MARGINS),
    gridColumns: readWholeNumber(settings.gridColumns, GRID_COLUMNS_RANGE),
    gridVisible: readBoolean(settings.gridVisible),
    safeAreaVisible: readBoolean(settings.safeAreaVisible),
    snapping: readBoolean(settings.snapping),
    alignTarget: readOneOf(settings.alignTarget, ALIGN_TARGETS),
    zoom: settings.zoom === "fit" ? "fit" : readNumber(settings.zoom, (zoom) => zoom > 0),
    pan: readPoint(settings.pan),
  };
}

function readPoint(value: unknown): Point {
  const { x, y } = readRecord(value);
  return { x: readNumber(x), y: readNumber(y) };
}

/** A hex colour, stored as uppercase "#RRGGBB" like the editor stores it. */
function readColor(value: unknown): string {
  return (typeof value === "string" && parseHexColor(value)) || unrecognised();
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) unrecognised();
  return value as Record<string, unknown>;
}

function readList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : unrecognised();
}

function readString(value: unknown, isValid: (value: string) => boolean = () => true): string {
  return typeof value === "string" && isValid(value) ? value : unrecognised();
}

/** A finite number; JSON has no NaN or Infinity. */
function readNumber(value: unknown, isValid: (value: number) => boolean = () => true): number {
  return typeof value === "number" && Number.isFinite(value) && isValid(value) ? value : unrecognised();
}

function readWholeNumber(value: unknown, range: { min: number; max: number }): number {
  return readNumber(value, (number) => Number.isInteger(number) && number >= range.min && number <= range.max);
}

function readBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : unrecognised();
}

function readOneOf<T>(value: unknown, options: readonly T[]): T {
  return options.includes(value as T) ? (value as T) : unrecognised();
}

class UnrecognisedData extends Error {}

function unrecognised(): never {
  throw new UnrecognisedData();
}
