import { describe, expect, it } from "vitest";
import { FONTS } from "./registry";

const GENERIC_FAMILIES = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"];

describe("the font registry", () => {
  it.each(FONTS.map(({ label, family }) => ({ label, family })))(
    "ends $label's family list with a generic family, so characters it lacks are drawn in a fallback font, never altered",
    ({ family }) => {
      const last = family.split(",").at(-1)?.trim();

      expect(GENERIC_FAMILIES).toContain(last);
    },
  );

  it("names the Google fonts as Next.js generated them, without the resized Arial that Next.js adds as a fallback", () => {
    const inter = FONTS.find(({ id }) => id === "inter");

    expect(inter?.family).toBe("'Inter', sans-serif");
  });
});
