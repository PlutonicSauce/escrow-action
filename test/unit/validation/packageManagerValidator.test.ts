import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validatedClaimSchema } from "../../../src/extraction/claimSchema.js";
import type { ExtractedClaim, PackageManager } from "../../../src/models/claims.js";
import { renderConsoleReport } from "../../../src/reporting/consoleReporter.js";
import { renderJsonReport } from "../../../src/reporting/jsonReporter.js";
import { validatePackageManagerClaim } from "../../../src/validation/packageManagerValidator.js";
import { validateClaim } from "../../../src/validation/validateClaim.js";
import { createReport } from "../models/claimFixtures.js";

const FIXTURE_ROOT = fileURLToPath(
  new URL("../../fixtures/package-managers/", import.meta.url),
);

function fixture(name: string): string {
  return join(FIXTURE_ROOT, name);
}

function createPackageManagerClaim(
  packageManager: PackageManager | undefined,
  overrides: Partial<ExtractedClaim> = {},
): ExtractedClaim {
  return {
    id: "package-manager-claim",
    type: "package_manager",
    sourceFile: "AGENTS.md",
    lineStart: 1,
    lineEnd: 1,
    originalText: `Use ${packageManager ?? "the documented package manager"}.`,
    normalizedValue: packageManager ?? "unknown",
    scopeDirectory: ".",
    packageManager,
    confidence: 1,
    extractionReason: "The instruction declares a package manager.",
    ...overrides,
  };
}

describe("validatePackageManagerClaim", () => {
  it.each([
    ["npm", "npm", "package-lock.json"],
    ["shrinkwrap", "npm", "npm-shrinkwrap.json"],
    ["pnpm", "pnpm", "pnpm-lock.yaml"],
    ["yarn", "yarn", "yarn.lock"],
  ] as const)(
    "passes matching %s lockfile evidence",
    async (fixtureName, packageManager, evidenceFile) => {
      const result = await validatePackageManagerClaim(
        createPackageManagerClaim(packageManager),
        { repositoryRoot: fixture(fixtureName) },
      );

      expect(result.status).toBe("passed");
      expect(result.evidence.join("\n")).toContain(evidenceFile);
      expect(result.repositoryInconsistencies).toBeUndefined();
    },
  );

  it("passes matching packageManager metadata", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("pnpm"),
      { repositoryRoot: fixture("metadata") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence.join("\n")).toContain(
      'package.json#packageManager "pnpm@9.15.0"',
    );
  });

  it("accepts a versioned pnpm@10.0.0 packageManager value", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("pnpm"),
      { repositoryRoot: fixture("metadata-version-10") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence).toEqual([
      expect.stringContaining("Selected package-manager scope"),
      expect.stringContaining('package.json#packageManager "pnpm@10.0.0"'),
      "Instruction and repository evidence agree on pnpm.",
    ]);
  });

  it("passes when lockfile and metadata consistently name the same manager", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("consistent-signals") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence.join("\n")).toContain("package-lock.json");
    expect(result.evidence.join("\n")).toContain("npm@10.8.0");
  });

  it("fails when the instruction conflicts with reliable repository evidence", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("pnpm") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence.at(-1)).toContain(
      "Instruction declares npm, but repository evidence indicates pnpm",
    );
  });

  it("warns and reports lockfile/metadata disagreement separately", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("conflicting-metadata") },
    );

    expect(result.status).toBe("warning");
    expect(result.repositoryInconsistencies).toEqual([
      {
        kind: "package_manager",
        message: expect.stringContaining(
          "Lockfile evidence conflicts with package.json#packageManager",
        ),
        evidence: [
          expect.stringContaining("package-lock.json"),
          expect.stringContaining("pnpm@9.15.0"),
        ],
      },
    ]);
    expect(validatedClaimSchema.parse(result)).toEqual(result);

    const consoleOutput = renderConsoleReport(createReport([result]));
    expect(consoleOutput).toContain("Repository inconsistency:");
    expect(JSON.parse(renderJsonReport(createReport([result]))).claims[0])
      .toEqual(result);
  });

  it("warns when multiple package-manager lockfile types exist", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("multiple-lockfiles") },
    );

    expect(result.status).toBe("warning");
    expect(result.repositoryInconsistencies?.[0]?.message).toContain(
      "Multiple package-manager lockfile types",
    );
    expect(result.repositoryInconsistencies?.[0]?.evidence).toHaveLength(2);
  });

  it("warns when both npm lockfile formats exist", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("duplicate-npm-lockfiles") },
    );

    expect(result.status).toBe("warning");
    expect(result.repositoryInconsistencies).toEqual([
      {
        kind: "package_manager",
        message: expect.stringContaining(
          "Multiple package-manager lockfile types",
        ),
        evidence: [
          expect.stringContaining("package-lock.json"),
          expect.stringContaining("npm-shrinkwrap.json"),
        ],
      },
    ]);
  });

  it("is inconclusive when no reliable evidence exists", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("no-evidence") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toContain("No reliable package-manager evidence");
  });

  it("is inconclusive for malformed package.json", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("malformed-package-json") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence.join("\n")).toContain("invalid JSON");
  });

  it("keeps malformed package.json inconclusive even when a lockfile exists", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("malformed-with-lockfile") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence).toEqual([
      expect.stringContaining("Selected package-manager scope"),
      expect.stringContaining("package-lock.json"),
      expect.stringContaining("invalid JSON"),
    ]);
  });

  it("is inconclusive for unsupported packageManager metadata", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm"),
      { repositoryRoot: fixture("unsupported-metadata") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence.join("\n")).toContain(
      'Unsupported or malformed packageManager value "bun@1.2.0"',
    );
  });

  it("uses the nearest package-manager scope for a nested instruction", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("pnpm", {
        sourceFile: "packages/api/AGENTS.md",
        scopeDirectory: "packages/api",
      }),
      { repositoryRoot: fixture("nested-scope") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain("packages/api");
    expect(result.evidence.join("\n")).toContain("packages/api/pnpm-lock.yaml");
    expect(result.evidence.join("\n")).not.toContain("package-lock.json");
  });

  it("prefers nested packageManager metadata over a root lockfile", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("pnpm", {
        sourceFile: "packages/api/AGENTS.md",
        scopeDirectory: "packages/api",
      }),
      { repositoryRoot: fixture("nested-metadata") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain("packages/api");
    expect(result.evidence.join("\n")).toContain("pnpm@10.0.0");
    expect(result.evidence.join("\n")).not.toContain("yarn.lock");
  });

  it("inherits a broader signal when a nested package has no manager metadata", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("pnpm", {
        sourceFile: "packages/api/AGENTS.md",
        scopeDirectory: "packages/api",
      }),
      { repositoryRoot: fixture("nested-inherit") },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain("nested-inherit");
    expect(result.evidence[0]).not.toContain("packages/api");
  });

  it("rejects an instruction source outside the repository", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim("npm", {
        sourceFile: join(FIXTURE_ROOT, "outside", "AGENTS.md"),
      }),
      { repositoryRoot: fixture("npm") },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[0]).toContain("outside repository root");
  });

  it("is inconclusive when packageManager is absent from the claim", async () => {
    const result = await validatePackageManagerClaim(
      createPackageManagerClaim(undefined),
      { repositoryRoot: fixture("npm") },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[0]).toContain("has no packageManager value");
  });

  it("is dispatched by the shared claim validator", async () => {
    const result = await validateClaim(createPackageManagerClaim("yarn"), {
      repositoryRoot: fixture("yarn"),
    });

    expect(result.status).toBe("passed");
  });

  it("produces identical evidence for repeated validation", async () => {
    const claim = createPackageManagerClaim("npm");
    const context = { repositoryRoot: fixture("conflicting-metadata") };

    const first = await validatePackageManagerClaim(claim, context);
    const second = await validatePackageManagerClaim(claim, context);

    expect(second.status).toBe(first.status);
    expect(second.evidence).toEqual(first.evidence);
    expect(second.repositoryInconsistencies).toEqual(
      first.repositoryInconsistencies,
    );
  });
});
