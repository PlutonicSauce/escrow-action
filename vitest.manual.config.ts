import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/integration/extraction/codex.manual.test.ts"],
  },
});
