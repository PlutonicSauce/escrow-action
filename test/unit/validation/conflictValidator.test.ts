import { describe, expect, it } from "vitest";

import type { ValidatedClaim } from "../../../src/models/claims.js";
import { createAgentContractReport } from "../../../src/models/reports.js";
import {
  analyzeClaimConflicts,
  resolveEffectiveClaimScope,
} from "../../../src/validation/conflictValidator.js";

const REPOSITORY_ROOT = "/repo";

function baseClaim(
  id: string,
  overrides: Partial<ValidatedClaim>,
): ValidatedClaim {
  return {
    id,
    type: "package_manager",
    sourceFile: "/repo/AGENTS.md",
    lineStart: 1,
    lineEnd: 1,
    originalText: "Use npm.",
    normalizedValue: "npm",
    scopeDirectory: "/repo",
    packageManager: "npm",
    confidence: 1,
    extractionReason: "Explicit package-manager guidance.",
    status: "passed",
    evidence: ["Repository evidence matched."],
    ...overrides,
  };
}

function packageManagerClaim(
  id: string,
  manager: "npm" | "pnpm" | "yarn",
  scopeDirectory: string,
  overrides: Partial<ValidatedClaim> = {},
): ValidatedClaim {
  return baseClaim(id, {
    sourceFile: `${scopeDirectory}/AGENTS.md`,
    originalText: `Use ${manager}.`,
    normalizedValue: manager,
    scopeDirectory,
    packageManager: manager,
    ...overrides,
  });
}

function packageScriptClaim(
  id: string,
  manager: "npm" | "pnpm" | "yarn",
  sourceFile: string,
  lineStart: number,
): ValidatedClaim {
  const command = manager === "npm" ? "npm test" : `${manager} test`;
  return baseClaim(id, {
    type: "package_script",
    sourceFile,
    lineStart,
    lineEnd: lineStart,
    originalText: `Run ${command}.`,
    normalizedValue: command,
    scopeDirectory: "/repo/packages/api",
    command,
    packageManager: manager,
    packageScript: "test",
    evidence: ["Package script exists."],
  });
}

function frameworkClaim(
  id: string,
  framework: "Jest" | "Vitest",
  lineStart: number,
): ValidatedClaim {
  const dependency = framework.toLocaleLowerCase("en-US");
  return baseClaim(id, {
    type: "dependency_present",
    sourceFile: "/repo/packages/api/AGENTS.md",
    lineStart,
    lineEnd: lineStart,
    originalText: `Use ${framework}.`,
    normalizedValue: framework,
    scopeDirectory: "/repo/packages/api",
    dependencyNames: [dependency],
    evidence: [`${dependency} is installed.`],
  });
}

describe("effective claim scope", () => {
  it("applies a root claim broadly and a nested claim only in its subtree", () => {
    const root = packageManagerClaim("root", "npm", "/repo");
    const nested = packageManagerClaim("api", "pnpm", "/repo/packages/api");

    expect(
      resolveEffectiveClaimScope(root, {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo/packages/web",
      }),
    ).toMatchObject({ applicable: true, specificity: 0 });
    expect(
      resolveEffectiveClaimScope(nested, {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo/packages/web",
      }),
    ).toMatchObject({ applicable: false, specificity: 2 });
  });

  it("does not treat a similarly prefixed sibling as part of the subtree", () => {
    const api = packageManagerClaim("api", "pnpm", "/repo/packages/api");

    expect(
      resolveEffectiveClaimScope(api, {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo/packages/api-v2",
      }).applicable,
    ).toBe(false);
  });

  it("rejects targets and claim scopes outside the repository", () => {
    const root = packageManagerClaim("root", "npm", "/repo");
    const external = packageManagerClaim("external", "pnpm", "/outside");

    expect(() =>
      resolveEffectiveClaimScope(root, {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/outside",
      }),
    ).toThrow("target is outside repository root");
    expect(() =>
      resolveEffectiveClaimScope(external, {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo",
      }),
    ).toThrow('Claim "external" has a scope outside repository root');
  });
});

describe("deterministic override analysis", () => {
  it("marks a root package-manager claim overridden by a nested claim", () => {
    const result = analyzeClaimConflicts(
      [
        packageManagerClaim("root", "npm", "/repo"),
        packageManagerClaim("api", "pnpm", "/repo/packages/api"),
      ],
      {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo/packages/api/src",
      },
    );

    expect(result.claims.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "root", status: "overridden" },
      { id: "api", status: "passed" },
    ]);
    expect(result.claims[0]?.evidence.at(-1)).toContain("api");
    expect(result.conflicts).toEqual([]);

    const report = createAgentContractReport({
      version: "0.1.0",
      generatedAt: "2026-07-13T12:00:00.000Z",
      repositoryRoot: REPOSITORY_ROOT,
      targetDirectory: "/repo/packages/api/src",
      instructionChain: [],
      claims: result.claims,
      conflicts: result.conflicts,
    });
    expect(report.summary).toMatchObject({
      passed: 1,
      failed: 0,
      overridden: 1,
    });
    expect(report.overallStatus).toBe("pass");
  });

  it("keeps the root instruction effective outside the nested subtree", () => {
    const result = analyzeClaimConflicts(
      [
        packageManagerClaim("root", "npm", "/repo"),
        packageManagerClaim("api", "pnpm", "/repo/packages/api"),
      ],
      {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo/packages/web",
      },
    );

    expect(result.claims.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "root", status: "passed" },
    ]);
    expect(result.scopes.find((scope) => scope.claimId === "api")?.applicable).toBe(
      false,
    );
  });

  it("isolates sibling package scopes for their respective targets", () => {
    const claims = [
      packageManagerClaim("root", "npm", "/repo"),
      packageManagerClaim("api", "pnpm", "/repo/packages/api"),
      packageManagerClaim("web", "yarn", "/repo/packages/web"),
    ];

    const api = analyzeClaimConflicts(claims, {
      repositoryRoot: REPOSITORY_ROOT,
      targetDirectory: "/repo/packages/api",
    });
    const web = analyzeClaimConflicts(claims, {
      repositoryRoot: REPOSITORY_ROOT,
      targetDirectory: "/repo/packages/web",
    });

    expect(api.claims.map((claim) => claim.id)).toEqual(["root", "api"]);
    expect(web.claims.map((claim) => claim.id)).toEqual(["root", "web"]);
    expect(api.conflicts).toEqual([]);
    expect(web.conflicts).toEqual([]);
  });
});

describe("narrow same-scope conflicts", () => {
  it("reports a same-file package-manager contradiction with both sources", () => {
    const result = analyzeClaimConflicts(
      [
        packageManagerClaim("npm", "npm", "/repo", { lineStart: 4, lineEnd: 4 }),
        packageManagerClaim("pnpm", "pnpm", "/repo", {
          lineStart: 9,
          lineEnd: 10,
        }),
      ],
      { repositoryRoot: REPOSITORY_ROOT, targetDirectory: "/repo" },
    );

    expect(result.claims.map((claim) => claim.status)).toEqual([
      "failed",
      "failed",
    ]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      id: "conflict-1",
      type: "package_manager",
      effectiveScopeDirectory: "/repo",
      claims: [
        { claimId: "npm", sourceFile: "/repo/AGENTS.md", lineStart: 4, lineEnd: 4 },
        {
          claimId: "pnpm",
          sourceFile: "/repo/AGENTS.md",
          lineStart: 9,
          lineEnd: 10,
        },
      ],
    });
  });

  it("reports contradictory package-script managers across effective files", () => {
    const result = analyzeClaimConflicts(
      [
        packageScriptClaim(
          "npm-test",
          "npm",
          "/repo/packages/api/AGENTS.md",
          3,
        ),
        packageScriptClaim(
          "pnpm-test",
          "pnpm",
          "/repo/packages/api/AGENTS.override.md",
          7,
        ),
      ],
      {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo/packages/api",
      },
    );

    expect(result.conflicts[0]?.type).toBe("package_script");
    expect(result.conflicts[0]?.claims.map((claim) => claim.sourceFile)).toEqual([
      "/repo/packages/api/AGENTS.md",
      "/repo/packages/api/AGENTS.override.md",
    ]);
  });

  it("treats npm test and npm run test as equivalent guidance", () => {
    const first = packageScriptClaim(
      "shortcut",
      "npm",
      "/repo/packages/api/AGENTS.md",
      1,
    );
    const second = {
      ...packageScriptClaim(
        "run-form",
        "npm",
        "/repo/packages/api/AGENTS.md",
        2,
      ),
      command: "npm run test",
      normalizedValue: "npm run test",
    } satisfies ValidatedClaim;

    const result = analyzeClaimConflicts([first, second], {
      repositoryRoot: REPOSITORY_ROOT,
      targetDirectory: "/repo/packages/api",
    });

    expect(result.conflicts).toEqual([]);
    expect(result.claims.every((claim) => claim.status === "passed")).toBe(true);
  });

  it("reports only the deterministic Jest-versus-Vitest framework conflict", () => {
    const result = analyzeClaimConflicts(
      [frameworkClaim("jest", "Jest", 2), frameworkClaim("vitest", "Vitest", 8)],
      {
        repositoryRoot: REPOSITORY_ROOT,
        targetDirectory: "/repo/packages/api",
      },
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.type).toBe("dependency_present");
    expect(result.conflicts[0]?.message).toContain("Jest versus Vitest");
  });

  it("does not conflict advisory or unrelated claims", () => {
    const advisory = baseClaim("advisory", {
      type: "advisory",
      packageManager: undefined,
      originalText: "Consider pnpm for local experiments.",
      normalizedValue: "pnpm",
      status: "advisory",
      evidence: [],
    });
    const path = baseClaim("path", {
      type: "path_exists",
      packageManager: undefined,
      referencedPath: "docs/architecture.md",
      originalText: "Read docs/architecture.md.",
      normalizedValue: "docs/architecture.md",
    });

    const result = analyzeClaimConflicts(
      [advisory, path, packageManagerClaim("manager", "npm", "/repo")],
      { repositoryRoot: REPOSITORY_ROOT, targetDirectory: "/repo" },
    );

    expect(result.conflicts).toEqual([]);
    expect(result.claims.map((claim) => claim.status)).toEqual([
      "advisory",
      "passed",
      "passed",
    ]);
  });
});
