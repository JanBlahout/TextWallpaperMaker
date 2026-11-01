import type { TextMeasurer } from "@/editor";
import { createCanvas2D } from "./canvas2d";
import { applyTextStyle, layOutLines } from "./textLayout";

/**
 * The Editor's text measurer in the browser: the same font string, letter
 * spacing and line layout as the renderer, on a private canvas.
 */
export function createCanvasTextMeasurer(): TextMeasurer {
  const ctx = createCanvas2D(1, 1);

  return {
    measure(content) {
      applyTextStyle(ctx, content);
      const { lineWidths, width, height } = layOutLines(ctx, content);
      return { lineWidths, width, height };
    },
  };
}
