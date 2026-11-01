import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Only Next.js's compiler makes next/font work; tests get each font's own name as its family.
      "next/font/google": fileURLToPath(new URL("./src/fonts/testing/nextFontGoogle.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
