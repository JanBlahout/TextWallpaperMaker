import { describe, expect, it } from "vitest";
import { createEditor, panBy, toScreen, toWallpaper, viewportOf, zoomAt } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

const FULL_HD = { width: 1920, height: 1080 };
/** A canvas where a fitted 1920 × 1080 wallpaper is exactly half size: (1040 − 2 × 40) ÷ 1920 = 0.5. */
const CANVAS = { width: 1040, height: 640 };
const FIT = { zoom: "fit", pan: { x: 0, y: 0 } } as const;

describe("fitting the wallpaper to the canvas", () => {
  it("shows the whole wallpaper centred, as large as fits 40 screen px in from the canvas's edges", () => {
    const viewport = viewportOf(FULL_HD, FIT, CANVAS);

    expect(viewport.zoom).toBe(0.5);
    // 960 × 540 on screen: 40 px in from the sides, (640 − 540) ÷ 2 = 50 px from the top and bottom.
    expect(toScreen(viewport, { x: 0, y: 0 })).toEqual({ x: 40, y: 50 });
    expect(toScreen(viewport, { x: 1920, y: 1080 })).toEqual({ x: 1000, y: 590 });
  });
});

describe("a set zoom and pan", () => {
  it("at 100%, shows one wallpaper px per screen px, with the pan point at the canvas's centre", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 1, pan: { x: 300, y: 800 } }, CANVAS);

    expect(viewport.zoom).toBe(1);
    expect(toScreen(viewport, { x: 300, y: 800 })).toEqual({ x: 520, y: 320 });
    expect(toScreen(viewport, { x: 310, y: 790 })).toEqual({ x: 530, y: 310 });
  });

  it("at 200%, shows each wallpaper px as two screen px", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 2, pan: { x: 300, y: 800 } }, CANVAS);

    expect(toScreen(viewport, { x: 310, y: 790 })).toEqual({ x: 540, y: 300 });
  });

  it("converts a screen point back to the wallpaper point shown there, as pointer input needs", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 2, pan: { x: 300, y: 800 } }, CANVAS);

    expect(toWallpaper(viewport, { x: 540, y: 300 })).toEqual({ x: 310, y: 790 });
    expect(toWallpaper(viewport, { x: 521, y: 320 })).toEqual({ x: 300.5, y: 800 });
  });
});

describe("zooming", () => {
  it("towards a point keeps the wallpaper point under it in place, as Cmd/Ctrl+scroll and pinch do", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 1, pan: { x: 300, y: 800 } }, CANVAS);
    // At 100%, screen (720, 120) shows wallpaper (300 + 200, 800 − 200) = (500, 600).
    const pointer = { x: 720, y: 120 };

    const zoomed = zoomAt(viewport, 2, pointer);

    // At 200% the canvas's centre is half as far away: (500 − 100, 600 + 100).
    expect(zoomed).toEqual({ zoom: 2, pan: { x: 400, y: 700 } });
    expect(toScreen(viewportOf(FULL_HD, zoomed, CANVAS), { x: 500, y: 600 })).toEqual(pointer);
  });

  it("without a point, zooms about the canvas's centre, as the zoom buttons and Shift+0 do", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 1, pan: { x: 300, y: 800 } }, CANVAS);

    expect(zoomAt(viewport, 0.5)).toEqual({ zoom: 0.5, pan: { x: 300, y: 800 } });
  });

  it("from a fitted view, starts from the fitted zoom and the wallpaper's centre", () => {
    const viewport = viewportOf(FULL_HD, FIT, CANVAS);

    expect(zoomAt(viewport, viewport.zoom * 2)).toEqual({ zoom: 1, pan: { x: 960, y: 540 } });
  });
});

describe("panning", () => {
  it("moves the view by screen px, so scrolling 100 px down at 200% shows what was 50 wallpaper px lower", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 2, pan: { x: 300, y: 800 } }, CANVAS);

    expect(panBy(viewport, { x: 40, y: 100 })).toEqual({ zoom: 2, pan: { x: 320, y: 850 } });
  });

  it("from a fitted view, keeps the fitted zoom as a number", () => {
    const viewport = viewportOf(FULL_HD, FIT, CANVAS);

    expect(panBy(viewport, { x: 0, y: -100 })).toEqual({ zoom: 0.5, pan: { x: 960, y: 340 } });
  });
});

describe("zoom limits", () => {
  it("stop zooming in at 3200%, still keeping the point under the pointer in place", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 16, pan: { x: 300, y: 800 } }, CANVAS);
    // At 1600%, screen (720, 120) shows wallpaper (300 + 200 ÷ 16, 800 − 200 ÷ 16) = (312.5, 787.5).

    const zoomed = zoomAt(viewport, 64, { x: 720, y: 120 });

    expect(zoomed).toEqual({ zoom: 32, pan: { x: 306.25, y: 793.75 } });
  });

  it("stop zooming out once the wallpaper's longer side is 100 screen px, so it never shrinks to nothing", () => {
    const viewport = viewportOf(FULL_HD, FIT, CANVAS);

    const zoomed = viewportOf(FULL_HD, zoomAt(viewport, 0.001), CANVAS);

    const left = toScreen(zoomed, { x: 0, y: 0 }).x;
    const right = toScreen(zoomed, { x: 1920, y: 0 }).x;
    expect(right - left).toBeCloseTo(100, 9);
  });

  it("never turn a zoom out into a zoom in, even when the fitted wallpaper is smaller than that on a tiny canvas", () => {
    // Fitted, the wallpaper is (160 − 80) = 80 screen px wide.
    const viewport = viewportOf(FULL_HD, FIT, { width: 160, height: 160 });

    expect(zoomAt(viewport, viewport.zoom / 2).zoom).toBe(viewport.zoom);
  });

  it("show a saved zoom beyond them within them", () => {
    expect(viewportOf(FULL_HD, { zoom: 1000, pan: { x: 300, y: 800 } }, CANVAS).zoom).toBe(32);
    expect(viewportOf(FULL_HD, { zoom: 0.0001, pan: { x: 300, y: 800 } }, CANVAS).zoom).toBeCloseTo(100 / 1920, 9);
  });

  it("keep the zoom above 0 on a canvas no bigger than its padding, so screen and wallpaper px still convert", () => {
    const viewport = viewportOf(FULL_HD, FIT, { width: 60, height: 60 });

    expect(viewport.zoom).toBeGreaterThan(0);
  });
});

describe("pan limits", () => {
  it("stop panning once the canvas's centre reaches the wallpaper's edge, so the wallpaper never goes out of view", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 1, pan: { x: 300, y: 800 } }, CANVAS);

    expect(panBy(viewport, { x: -1000, y: 1000 })).toEqual({ zoom: 1, pan: { x: 0, y: 1080 } });
  });

  it("keep zooming towards a point beyond the wallpaper's edge from leaving the canvas's centre off it", () => {
    const viewport = viewportOf(FULL_HD, FIT, CANVAS);

    // Screen (10, 10) is in the space around the fitted wallpaper, above and left of its corner.
    expect(zoomAt(viewport, 8, { x: 10, y: 10 }).pan).toEqual({ x: 3.75, y: 0 });
  });

  it("show a saved pan off the wallpaper with the canvas's centre on its edge", () => {
    const viewport = viewportOf(FULL_HD, { zoom: 1, pan: { x: -500, y: 5000 } }, CANVAS);

    expect(viewport.centre).toEqual({ x: 0, y: 1080 });
  });
});

describe("zoom and pan in the editor", () => {
  it("are editor settings, never undo steps, and undo leaves them as they are", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });
    const view = () => viewportOf(editor.getWallpaper().resolution, editor.getSettings(), CANVAS);

    editor.setSettings(zoomAt(view(), 2, { x: 720, y: 120 }));
    editor.setSettings(panBy(view(), { x: 100, y: 0 }));
    expect(editor.getView().canUndo).toBe(false);
    const zoomedAndPanned = editor.getSettings();

    editor.setBackground("#1E3A5F");
    editor.undo();

    expect(editor.getWallpaper().background).toBe("#000000");
    expect(editor.getSettings()).toEqual(zoomedAndPanned);
  });
});
