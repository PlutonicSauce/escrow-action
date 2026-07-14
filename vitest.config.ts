import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "test/unit/**/*.test.ts",
      "test/integration/command-execution/**/*.test.ts",
      "test/integration/repair/**/*.test.ts",
      "test/integration/demo/**/*.test.ts",
    ],
  },
});
