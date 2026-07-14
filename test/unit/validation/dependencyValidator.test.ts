import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ExtractedClaim } from "../../../src/models/claims.js";
import {
  DEPENDENCY_MAPPINGS,
  findDependencyMapping,
} from "../../../src/validation/dependencyMappings.js";
import { validateDependencyClaim } from "../../../src/validation/dependencyValidator.js";
import { validateClaim } from "../../../src/validation/validateClaim.js";

const FIXTURE_ROOT = fileURLToPath(
  new URL("../../fixtures/dependencies/", import.meta.url),
);

function fixture(name: string): string {
  return join(FIXTURE_ROOT, name);
}

function createDependencyClaim(
  frameworkOrTool: string,
  dependencyNames?: string[],
  overrides: Partial<ExtractedClaim> = {},
): ExtractedClaim {
  return {
    id: `dependency-${frameworkOrTool.toLocaleLowerCase("en-US")}`,
    type: "dependency_present",
    sourceFile: "AGENTS.md",
    lineStart: 3,
    lineEnd: 3,
    originalText: `Use ${frameworkOrTool}.`,
    normalizedValue: frameworkOrTool,
    scopeDirectory: ".",
    dependencyNames,
    confidence: 1,
    extractionReason: "The instruction declares a framework or tool.",
    ...overrides,
  };
}

describe("dependency mappings", () => {
  it("contains exactly the Milestone 7 mappings", () => {
    expect(DEPENDENCY_MAPPINGS).toEqual([
      { displayName: "Vitest", dependencyNames: ["vitest"] },
      { displayName: "Jest", dependencyNames: ["jest"] },
      { displayName: "TypeScript", dependencyNames: ["typescript"] },
      { displayName: "ESLint", dependencyNames: ["eslint"] },
      { displayName: "Prettier", dependencyNames: ["prettier"] },
      { displayName: "Vite", dependencyNames: ["vite"] },
      { displayName: "Next.js", dependencyNames: ["next"] },
      { displayName: "React", dependencyNames: ["react"] },
      {
        displayName: "Playwright",
        dependencyNames: ["@playwright/test", "playwright"],
      },
    ]);
  });

  it("matches supported names case-insensitively without inferring aliases", () => {
    expect(findDependencyMapping("vItEsT")?.dependencyNames).toEqual(["vitest"]);
    expect(findDependencyMapping(" Next.js ")?.dependencyNames).toEqual(["next"]);
    expect(findDependencyMapping("nextjs")).toBeUndefined();
    expect(findDependencyMapping("Cypress")).toBeUndefined();
  });

  it.each(DEPENDENCY_MAPPINGS)(
    "normalizes case for $displayName deterministically",
    (mapping) => {
      expect(
        findDependencyMapping(mapping.displayName.toLocaleUpperCase("en-US")),
      ).toEqual(mapping);
      expect(
        findDependencyMapping(mapping.displayName.toLocaleLowerCase("en-US")),
      ).toEqual(mapping);
    },
  );

  it.each(["next", "nextjs", "@playwright/test"])(
    "does not add the unlisted framework alias %s",
    (alias) => {
      expect(findDependencyMapping(alias)).toBeUndefined();
    },
  );
});

describe("validateDependencyClaim", () => {
  it.each([
    ["Vitest", "vitest"],
    ["Jest", "jest"],
    ["TypeScript", "typescript"],
    ["ESLint", "eslint"],
    ["Prettier", "prettier"],
    ["Vite", "vite"],
    ["Next.js", "next"],
    ["React", "react"],
    ["Playwright", "@playwright/test"],
  ])("passes the supported %s mapping", async (frameworkOrTool, dependencyName) => {
    const result = await validateDependencyClaim(
      createDependencyClaim(frameworkOrTool),
      { repositoryRoot: fixture("all-mappings") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain(`"${frameworkOrTool}"`);
    expect(result.evidence[2]).toContain(`Dependency "${dependencyName}"`);
  });

  it.each([
    ["Vitest", "dependencies"],
    ["Jest", "devDependencies"],
    ["TypeScript", "peerDependencies"],
    ["ESLint", "optionalDependencies"],
  ])("detects dependencies in %s metadata", async (frameworkOrTool, section) => {
    const result = await validateDependencyClaim(
      createDependencyClaim(frameworkOrTool),
      { repositoryRoot: fixture("sections") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[2]).toContain(`declared in ${section}`);
  });

  it("accepts the playwright package as a supported Playwright equivalent", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Playwright", ["playwright", "@playwright/test"]),
      { repositoryRoot: fixture("playwright-package") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain('"@playwright/test" or "playwright"');
    expect(result.evidence[2]).toContain('Dependency "playwright"');
  });

  it.each([
    ["@playwright/test", "all-mappings"],
    ["playwright", "playwright-package"],
  ])(
    "accepts single extracted Playwright equivalent metadata for %s",
    async (dependencyName, fixtureName) => {
      const result = await validateDependencyClaim(
        createDependencyClaim("Playwright", [dependencyName]),
        { repositoryRoot: fixture(fixtureName) },
      );

      expect(result.status).toBe("passed");
      expect(result.evidence[0]).toContain(
        '"@playwright/test" or "playwright"',
      );
      expect(result.evidence[2]).toContain(`Dependency "${dependencyName}"`);
    },
  );

  it("keeps repository detection independent from a compatible Playwright metadata subset", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Playwright", ["@playwright/test"]),
      { repositoryRoot: fixture("playwright-package") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[2]).toContain('Dependency "playwright"');
  });

  it("fails with repository evidence when the mapped dependency is absent", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Jest", ["jest"]),
      { repositoryRoot: fixture("missing") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence[2]).toContain('dependency "jest"');
    expect(result.evidence[2]).toContain("is absent");
  });

  it("returns inconclusive for an unknown framework without inspecting a repository", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Cypress", ["cypress"]),
      { repositoryRoot: "/does/not/need/to/exist" },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence).toEqual([
      'Cannot safely map framework or tool "Cypress" to a supported dependency.',
    ]);
  });

  it("uses the nearest nested package.json without falling back to the root", async () => {
    const repositoryRoot = fixture("nested");
    const nestedClaim = createDependencyClaim("Vitest", ["vitest"], {
      sourceFile: "packages/api/AGENTS.md",
      scopeDirectory: "packages/api",
    });

    const nestedResult = await validateDependencyClaim(nestedClaim, {
      repositoryRoot,
    });
    const rootOnlyResult = await validateDependencyClaim(
      createDependencyClaim("React", ["react"], {
        sourceFile: "packages/api/AGENTS.md",
        scopeDirectory: "packages/api",
      }),
      { repositoryRoot },
    );

    expect(nestedResult.status).toBe("passed");
    expect(nestedResult.evidence[1]).toContain("packages/api/package.json");
    expect(rootOnlyResult.status).toBe("failed");
    expect(rootOnlyResult.evidence[1]).toContain("packages/api/package.json");
  });

  it.each([
    ["malformed-json", "invalid JSON"],
    ["malformed-section", "dependencies must be a JSON object"],
    ["malformed-entry", 'devDependencies entry "vitest" must be a string'],
  ])("returns inconclusive for %s package metadata", async (fixtureName, reason) => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Vitest", ["vitest"]),
      { repositoryRoot: fixture(fixtureName) },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[2]).toContain(reason);
  });

  it("returns inconclusive when no applicable package.json exists", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Vitest", ["vitest"]),
      { repositoryRoot: fixture("no-package") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[1]).toContain("No package.json found");
  });

  it("returns inconclusive when extracted names disagree with the mapping", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Vitest", ["jest"]),
      { repositoryRoot: fixture("all-mappings") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[1]).toContain("does not match the deterministic mapping");
  });

  it("rejects a source instruction file outside the repository", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Vitest", ["vitest"], {
        sourceFile: join(FIXTURE_ROOT, "outside", "AGENTS.md"),
      }),
      { repositoryRoot: fixture("all-mappings") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[1]).toContain("outside repository root");
  });

  it("rejects a claim scope outside the repository", async () => {
    const result = await validateDependencyClaim(
      createDependencyClaim("Vitest", ["vitest"], {
        scopeDirectory: "../outside",
      }),
      { repositoryRoot: fixture("all-mappings") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[1]).toContain("outside repository root");
  });

  it("preserves source locations and produces deterministic evidence", async () => {
    const claim = createDependencyClaim("Jest", ["jest"], {
      sourceFile: "AGENTS.md",
      lineStart: 8,
      lineEnd: 10,
    });

    const first = await validateDependencyClaim(claim, {
      repositoryRoot: fixture("missing"),
    });
    const second = await validateDependencyClaim(claim, {
      repositoryRoot: fixture("missing"),
    });

    expect(second).toEqual(first);
    expect(first.sourceFile).toBe("AGENTS.md");
    expect(first.lineStart).toBe(8);
    expect(first.lineEnd).toBe(10);
  });

  it("uses canonical, case-independent evidence for a supported mapping", async () => {
    const canonical = await validateDependencyClaim(
      createDependencyClaim("Vitest"),
      { repositoryRoot: fixture("all-mappings") },
    );
    const mixedCase = await validateDependencyClaim(
      createDependencyClaim("vItEsT"),
      { repositoryRoot: fixture("all-mappings") },
    );

    expect(mixedCase.status).toBe("passed");
    expect(mixedCase.evidence).toEqual(canonical.evidence);
  });

  it("rejects claims of another type", async () => {
    await expect(
      validateDependencyClaim(
        createDependencyClaim("Vitest", ["vitest"], { type: "advisory" }),
        { repositoryRoot: fixture("all-mappings") },
      ),
    ).rejects.toThrow("Dependency validator cannot validate claim type: advisory");
  });
});

describe("validateClaim", () => {
  it("dispatches dependency_present claims", async () => {
    const result = await validateClaim(
      createDependencyClaim("Vitest", ["vitest"]),
      { repositoryRoot: fixture("all-mappings") },
    );

    expect(result.status).toBe("passed");
  });
});
