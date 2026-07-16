import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

describe("judge-ready package distribution", () => {
  it("builds before packing and includes every runtime/documentation asset", async () => {
    const packageJson = JSON.parse(
      await readFile(join(PROJECT_ROOT, "package.json"), "utf8"),
    ) as {
      files: string[];
      scripts: Record<string, string>;
      license: string;
      repository: { type: string; url: string };
      homepage: string;
      bugs: { url: string };
    };

    expect(packageJson.files).toEqual([
      "dist",
      "schemas",
      "README.md",
      "LICENSE",
    ]);
    expect(packageJson.scripts.prepack).toBe("npm run build");
    expect(packageJson.scripts["package:smoke"]).toBe(
      "node scripts/package-smoke.mjs",
    );
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/PlutonicSauce/escrow.git",
    });
    expect(packageJson.homepage).toBe(
      "https://github.com/PlutonicSauce/escrow#readme",
    );
    expect(packageJson.bugs).toEqual({
      url: "https://github.com/PlutonicSauce/escrow/issues",
    });
  });

  it("creates releases only for version tags after package verification", async () => {
    const workflow = await readFile(
      join(PROJECT_ROOT, ".github/workflows/release.yml"),
      "utf8",
    );

    expect(workflow).toContain('- "v*.*.*"');
    expect(workflow).toContain("https://github.com/PlutonicSauce/escrow");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npm run package:smoke");
    expect(workflow).toContain("npm pack --pack-destination release");
    expect(workflow).toContain("gh release create");
    expect(workflow).not.toContain("npm publish");
    expect(workflow).not.toContain("OPENAI_API_KEY");
  });

  it("runs deterministic read-only CI without a live model dependency", async () => {
    const [workflow, vitestConfig, readme] = await Promise.all([
      readFile(join(PROJECT_ROOT, ".github/workflows/ci.yml"), "utf8"),
      readFile(join(PROJECT_ROOT, "vitest.config.ts"), "utf8"),
      readFile(join(PROJECT_ROOT, "README.md"), "utf8"),
    ]);

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("actions/setup-node@v5");
    expect(workflow).toContain("node-version: 20");
    expect(workflow).toContain("cache: npm");
    for (const command of [
      "npm ci",
      "npm run typecheck",
      "npm test",
      "npm run build",
      "npm run package:smoke",
    ]) {
      expect(workflow).toContain(command);
    }
    expect(workflow).not.toMatch(
      /contents:\s*write|OPENAI_API_KEY|CODEX_API_KEY|codex\b|ollama|self-hosted/iu,
    );
    expect(vitestConfig).not.toContain("codex.manual.test.ts");
    expect(readme).toContain(
      "actions/workflows/ci.yml/badge.svg?branch=main",
    );
    expect(readme).toContain(
      "github.com/PlutonicSauce/escrow/actions/workflows/ci.yml",
    );
  });
});
