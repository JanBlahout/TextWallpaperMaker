import { describe, expect, it } from "vitest";
import { createEditor, gridOf, safeAreaOf } from "./index";
import { fakeTextMeasurer } from "./testing/fakeTextMeasurer";

describe("guides on the starting 1920 × 1080 wallpaper", () => {
  it("has a safe area 54 px (5% of 1080) in from every edge", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    expect(editor.getView().safeArea).toEqual({ x: 54, y: 54, width: 1812, height: 972 });
  });

  it("has a grid of 12 columns of 151 px and 6 rows of 162 px whose outermost lines are the safe-area edges", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });
    const { grid } = editor.getView();

    expect(grid).toMatchObject({ columns: 12, rows: 6, columnWidth: 151, rowHeight: 162 });
    expect(grid.verticalLines).toEqual([54, 205, 356, 507, 658, 809, 960, 1111, 1262, 1413, 1564, 1715, 1866]);
    expect(grid.horizontalLines).toEqual([54, 216, 378, 540, 702, 864, 1026]);
  });

  it("has centre lines through the wallpaper's centre", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    expect(editor.getView().centreLines).toEqual({ vertical: 960, horizontal: 540 });
  });
});

describe("changing the guide settings", () => {
  it("choosing an 8% safe margin insets the safe area 86.4 px and rebuilds the grid on it", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.setSettings({ safeMargin: 8 });

    expect(editor.getSettings().safeMargin).toBe(8);
    const { safeArea, grid } = editor.getView();
    expect(safeArea.x).toBeCloseTo(86.4, 9);
    expect(safeArea.width).toBeCloseTo(1747.2, 9);
    expect(grid.columnWidth).toBeCloseTo(145.6, 9);
    expect(grid.verticalLines[0]).toBeCloseTo(86.4, 9);
  });

  it("choosing 6 grid columns makes 6 columns of 302 px and 3 rows of 324 px", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.setSettings({ gridColumns: 6 });

    expect(editor.getSettings().gridColumns).toBe(6);
    expect(editor.getView().grid).toMatchObject({ columns: 6, rows: 3, columnWidth: 302, rowHeight: 324 });
  });

  it.each`
    requested    | kept
    ${0}         | ${1}
    ${-3}        | ${1}
    ${60}        | ${48}
    ${7.6}       | ${8}
    ${Number.NaN} | ${12}
  `("keeps the column count a whole number from 1 to 48: asking for $requested gives $kept", ({ requested, kept }) => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.setSettings({ gridColumns: requested });

    expect(editor.getSettings().gridColumns).toBe(kept);
    expect(editor.getView().grid.columns).toBe(kept);
  });

  it("shows and hides the grid and the safe-area guides independently", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });

    editor.setSettings({ gridVisible: false });
    expect(editor.getSettings()).toMatchObject({ gridVisible: false, safeAreaVisible: true });

    editor.setSettings({ safeAreaVisible: false });
    expect(editor.getSettings()).toMatchObject({ gridVisible: false, safeAreaVisible: false });

    editor.setSettings({ gridVisible: true });
    expect(editor.getSettings()).toMatchObject({ gridVisible: true, safeAreaVisible: false });
  });

  it("tells subscribers when the settings change, until they unsubscribe", () => {
    const editor = createEditor({ measurer: fakeTextMeasurer });
    let changes = 0;
    const unsubscribe = editor.subscribe(() => changes++);

    editor.setSettings({ safeMargin: 10 });
    expect(changes).toBe(1);

    unsubscribe();
    editor.setSettings({ safeMargin: 5 });
    expect(changes).toBe(1);
  });
});

describe("safe margin and grid geometry", () => {
  // Worked by hand: inset = margin % × the shorter side; 12 columns share the
  // safe-area width; rows = nearest whole number to safe height ÷ column width.
  it.each`
    width   | height  | safeMargin | inset    | safeWidth | safeHeight | columnWidth | rows  | rowHeight
    ${1920} | ${1080} | ${5}       | ${54}    | ${1812}   | ${972}     | ${151}      | ${6}  | ${162}
    ${1920} | ${1080} | ${8}       | ${86.4}  | ${1747.2} | ${907.2}   | ${145.6}    | ${6}  | ${151.2}
    ${1920} | ${1080} | ${10}      | ${108}   | ${1704}   | ${864}     | ${142}      | ${6}  | ${144}
    ${3440} | ${1440} | ${5}       | ${72}    | ${3296}   | ${1296}    | ${274.6667} | ${5}  | ${259.2}
    ${3440} | ${1440} | ${8}       | ${115.2} | ${3209.6} | ${1209.6}  | ${267.4667} | ${5}  | ${241.92}
    ${3440} | ${1440} | ${10}      | ${144}   | ${3152}   | ${1152}    | ${262.6667} | ${4}  | ${288}
    ${2560} | ${1600} | ${5}       | ${80}    | ${2400}   | ${1440}    | ${200}      | ${7}  | ${205.7143}
    ${2560} | ${1600} | ${8}       | ${128}   | ${2304}   | ${1344}    | ${192}      | ${7}  | ${192}
    ${2560} | ${1600} | ${10}      | ${160}   | ${2240}   | ${1280}    | ${186.6667} | ${7}  | ${182.8571}
    ${1179} | ${2556} | ${5}       | ${58.95} | ${1061.1} | ${2438.1}  | ${88.425}   | ${28} | ${87.075}
    ${1179} | ${2556} | ${8}       | ${94.32} | ${990.36} | ${2367.36} | ${82.53}    | ${29} | ${81.6331}
    ${1179} | ${2556} | ${10}      | ${117.9} | ${943.2}  | ${2320.2}  | ${78.6}     | ${30} | ${77.34}
    ${1080} | ${2400} | ${5}       | ${54}    | ${972}    | ${2292}    | ${81}       | ${28} | ${81.8571}
    ${1080} | ${2400} | ${8}       | ${86.4}  | ${907.2}  | ${2227.2}  | ${75.6}     | ${29} | ${76.8}
    ${1080} | ${2400} | ${10}      | ${108}   | ${864}    | ${2184}    | ${72}       | ${30} | ${72.8}
  `(
    "$width × $height at $safeMargin%: inset $inset px, 12 columns of $columnWidth px, $rows rows of $rowHeight px",
    ({ width, height, safeMargin, inset, safeWidth, safeHeight, columnWidth, rows, rowHeight }) => {
      const safeArea = safeAreaOf({ width, height }, safeMargin);
      expect(safeArea.x).toBeCloseTo(inset, 9);
      expect(safeArea.y).toBeCloseTo(inset, 9);
      expect(safeArea.width).toBeCloseTo(safeWidth, 9);
      expect(safeArea.height).toBeCloseTo(safeHeight, 9);

      const grid = gridOf(safeArea, 12);
      expect(grid.columns).toBe(12);
      expect(grid.columnWidth).toBeCloseTo(columnWidth, 3);
      expect(grid.rows).toBe(rows);
      expect(grid.rowHeight).toBeCloseTo(rowHeight, 3);

      expectLinesAcross(grid.verticalLines, { start: safeArea.x, end: safeArea.x + safeArea.width, gap: columnWidth });
      expectLinesAcross(grid.horizontalLines, { start: safeArea.y, end: safeArea.y + safeArea.height, gap: rowHeight });
    },
  );

  it("follows the column count: 6 columns on 1920 × 1080 at 5% are 302 px wide with 3 rows of 324 px", () => {
    const grid = gridOf(safeAreaOf({ width: 1920, height: 1080 }, 5), 6);

    expect(grid).toMatchObject({ columns: 6, rows: 3, columnWidth: 302, rowHeight: 324 });
  });

  it("always has at least one row, even when a column is far wider than the safe area is tall", () => {
    // 8192 × 320 at 5%: the safe area is 8160 × 288, so one column makes a
    // height ÷ width of 0.035, which rounds to 0 rows.
    const grid = gridOf(safeAreaOf({ width: 8192, height: 320 }, 5), 1);

    expect(grid.rows).toBe(1);
    expect(grid.rowHeight).toBe(288);
    expect(grid.horizontalLines).toEqual([16, 304]);
  });
});

/** The outermost lines are exactly the safe-area edges `start` and `end`, and every gap between lines is `gap`. */
function expectLinesAcross(lines: number[], { start, end, gap }: { start: number; end: number; gap: number }) {
  expect(lines[0]).toBe(start);
  expect(lines.at(-1)).toBe(end);
  lines.slice(1).forEach((line, i) => expect(line - lines[i]).toBeCloseTo(gap, 3));
}
