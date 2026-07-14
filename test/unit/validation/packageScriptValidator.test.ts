import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { ExtractedClaim, PackageManager } from "../../../src/models/claims.js";
import {
  findSimilarPackageScript,
  normalizePackageScriptCommand,
} from "../../../src/utils/packageCommands.js";
import { validatePackageScriptClaim } from "../../../src/validation/packageScriptValidator.js";
import { validateClaim } from "../../../src/validation/validateClaim.js";

const FIXTURE_ROOT = fileURLToPath(
  new URL("../../fixtures/package-scripts/", import.meta.url),
);

function fixture(name: string): string {
  return join(FIXTURE_ROOT, name);
}

function createPackageScriptClaim(
  command: string | undefined,
  overrides: Partial<ExtractedClaim> = {},
): ExtractedClaim {
  return {
    id: "package-script-claim",
    type: "package_script",
    sourceFile: "AGENTS.md",
    lineStart: 2,
    lineEnd: 2,
    originalText: `Run ${command ?? "the documented package script"}.`,
    normalizedValue: command ?? "package script",
    scopeDirectory: ".",
    command,
    confidence: 1,
    extractionReason: "The instruction references a package script.",
    ...overrides,
  };
}

describe("normalizePackageScriptCommand", () => {
  it.each([
    ["npm test", "npm", "test"],
    ["npm run build", "npm", "build"],
    ["pnpm lint", "pnpm", "lint"],
    ["pnpm run typecheck", "pnpm", "typecheck"],
    ["yarn build", "yarn", "build"],
    ["yarn run lint", "yarn", "lint"],
  ] as const)("normalizes %s", (command, packageManager, script) => {
    expect(normalizePackageScriptCommand(command)).toEqual({
      success: true,
      command: { packageManager, script },
    });
  });

  it.each([
    ["npm test -- --watch", "npm", "test"],
    ['npm run "test:unit" -- --runInBand', "npm", "test:unit"],
    ["pnpm lint -- --fix", "pnpm", "lint"],
    ['pnpm run "typecheck" --filter api', "pnpm", "typecheck"],
    ["yarn build --verbose", "yarn", "build"],
    ["yarn run 'lint' --fix", "yarn", "lint"],
  ] as const)(
    "identifies the script in %s with quoting or trailing arguments",
    (command, packageManager, script) => {
      expect(normalizePackageScriptCommand(command)).toEqual({
        success: true,
        command: { packageManager, script },
      });
    },
  );

  it.each([
    "npm start",
    "npm run",
    "pnpm run",
    "yarn",
    "bun test",
    "npm test && echo unsafe",
    'npm run "unterminated',
    "npm run --silent test",
    "pnpm --filter api lint",
    "yarn --silent build",
  ])(
    "rejects unsupported or incomplete command %s",
    (command) => {
      expect(normalizePackageScriptCommand(command).success).toBe(false);
    },
  );
});

describe("findSimilarPackageScript", () => {
  it("selects the same closest script regardless of input order", () => {
    expect(
      findSimilarPackageScript("test:unti", ["build", "test:e2e", "test:unit"]),
    ).toBe("test:unit");
    expect(
      findSimilarPackageScript("test:unti", ["test:unit", "build", "test:e2e"]),
    ).toBe("test:unit");
  });

  it("returns no suggestion for unrelated scripts", () => {
    expect(findSimilarPackageScript("release", ["test", "build", "lint"]))
      .toBeUndefined();
  });
});

describe("validatePackageScriptClaim", () => {
  it.each([
    ["npm test", "npm", "test"],
    ["npm run build", "npm", "build"],
    ["pnpm lint", "pnpm", "lint"],
    ["pnpm run typecheck", "pnpm", "typecheck"],
    ["yarn build", "yarn", "build"],
    ["yarn run lint", "yarn", "lint"],
  ] as const)(
    "passes existing script for %s",
    async (command, packageManager, script) => {
      const result = await validatePackageScriptClaim(
        createPackageScriptClaim(command, { packageManager }),
        { repositoryRoot: fixture("basic") },
      );

      expect(result.status).toBe("passed");
      expect(result.evidence).toEqual([
        `Normalized package command "${command}" to ${packageManager} script "${script}".`,
        expect.stringContaining("Selected nearest package.json"),
        expect.stringContaining(`Package script "${script}" exists`),
      ]);
      expect(result.sourceFile).toBe("AGENTS.md");
      expect(result.lineStart).toBe(2);
      expect(result.lineEnd).toBe(2);
    },
  );

  it("fails when the script is missing", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm run release"),
      { repositoryRoot: fixture("basic") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence.at(-1)).toContain(
      'Package script "release" does not exist',
    );
    expect(result.suggestion).toBeUndefined();
  });

  it("suggests a similar script without changing the failed verdict", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("pnpm test:unti"),
      { repositoryRoot: fixture("basic") },
    );

    expect(result.status).toBe("failed");
    expect(result.suggestion).toBe('Did you mean package script "test:unit"?');
  });

  it("suggests a colon-prefixed alternative without changing the verdict", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test"),
      { repositoryRoot: fixture("suggestion-prefix") },
    );

    expect(result.status).toBe("failed");
    expect(result.suggestion).toBe('Did you mean package script "test:unit"?');
  });

  it("passes a simply quoted script name containing whitespace", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim('npm run "test unit"'),
      { repositoryRoot: fixture("basic") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain('script "test unit"');
  });

  it("passes while ignoring trailing script arguments", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test -- --watch"),
      { repositoryRoot: fixture("basic") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain('script "test"');
  });

  it("uses the nearest nested package.json", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("pnpm api:test", {
        sourceFile: "packages/api/AGENTS.md",
        scopeDirectory: "packages/api",
      }),
      { repositoryRoot: fixture("nested") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[1]).toContain("packages/api/package.json");
  });

  it("walks from a deeper claim scope to the nearest package.json", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("pnpm api:test", {
        sourceFile: "packages/api/src/AGENTS.md",
        scopeDirectory: "packages/api/src",
      }),
      { repositoryRoot: fixture("nested") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[1]).toContain("packages/api/package.json");
    expect(result.evidence[1]).not.toContain("packages/api/src/package.json");
  });

  it("does not fall back to a broader package.json after finding a nested one", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("pnpm root-only", {
        sourceFile: "packages/api/AGENTS.md",
        scopeDirectory: "packages/api",
      }),
      { repositoryRoot: fixture("nested") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[1]).toContain("packages/api/package.json");
    expect(result.evidence[1]).not.toMatch(/nested\/package\.json"/u);
  });

  it("is inconclusive when no applicable package.json exists", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test", {
        sourceFile: "packages/api/AGENTS.md",
        scopeDirectory: "packages/api",
      }),
      { repositoryRoot: fixture("no-package") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence.at(-1)).toContain("No package.json found");
  });

  it("is inconclusive for a malformed scripts object", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test"),
      { repositoryRoot: fixture("malformed-scripts") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence.at(-1)).toContain("scripts must be a JSON object");
  });

  it("is inconclusive for a non-string script value", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test"),
      { repositoryRoot: fixture("malformed-script-value") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence.at(-1)).toContain('script "test" must be a string');
  });

  it("is inconclusive for malformed package.json", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test"),
      { repositoryRoot: fixture("malformed-package-json") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence.at(-1)).toContain("invalid JSON");
  });

  it("fails when package.json has no scripts object", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test"),
      { repositoryRoot: fixture("no-scripts") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence.at(-1)).toContain('Package script "test" does not exist');
  });

  it("uses an extracted packageScript when no command is present", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim(undefined, {
        packageManager: "npm",
        packageScript: "test",
      }),
      { repositoryRoot: fixture("basic") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toBe('Used extracted package script "test".');
  });

  it("is inconclusive when normalized command metadata disagrees", async () => {
    const result = await validatePackageScriptClaim(
      createPackageScriptClaim("npm test", {
        packageManager: "pnpm",
        packageScript: "test:unit",
      }),
      { repositoryRoot: fixture("basic") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence).toHaveLength(1);
  });

  it("produces deterministic evidence across repeated validation", async () => {
    const claim = createPackageScriptClaim("npm run missing");
    const context = { repositoryRoot: fixture("basic") };

    const first = await validatePackageScriptClaim(claim, context);
    const second = await validatePackageScriptClaim(claim, context);

    expect(second.status).toBe(first.status);
    expect(second.evidence).toEqual(first.evidence);
    expect(second.suggestion).toBe(first.suggestion);
  });

  it("is dispatched by the shared claim validator", async () => {
    const result = await validateClaim(createPackageScriptClaim("yarn build"), {
      repositoryRoot: fixture("basic"),
    });

    expect(result.status).toBe("passed");
  });
});
