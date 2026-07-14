import { describe, expect, it, vi } from "vitest";

const validateClaimMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/validation/validateClaim.js", () => ({
  validateClaim: validateClaimMock,
}));

import { validateExtractedClaims } from "../../../src/extraction/extractClaims.js";
import type { ExtractedClaim, ValidatedClaim } from "../../../src/models/claims.js";

function packageManagerClaim(
  id: string,
  manager: "npm" | "pnpm" | "yarn",
  scopeDirectory: string,
): ExtractedClaim {
  return {
    id,
    type: "package_manager",
    sourceFile: `${scopeDirectory}/AGENTS.md`,
    lineStart: 1,
    lineEnd: 1,
    originalText: `Use ${manager}.`,
    normalizedValue: manager,
    scopeDirectory,
    packageManager: manager,
    confidence: 1,
    extractionReason: "Explicit package-manager guidance.",
  };
}

function commandClaim(id: string, scopeDirectory: string): ExtractedClaim {
  return {
    id,
    type: "command_runs",
    sourceFile: `${scopeDirectory}/AGENTS.md`,
    lineStart: 2,
    lineEnd: 2,
    originalText: "Run node --version.",
    normalizedValue: "node --version",
    scopeDirectory,
    command: "node --version",
    confidence: 1,
    extractionReason: "Explicit command guidance.",
  };
}

function advisoryClaim(id: string, scopeDirectory: string): ExtractedClaim {
  return {
    id,
    type: "advisory",
    sourceFile: `${scopeDirectory}/AGENTS.md`,
    lineStart: 3,
    lineEnd: 3,
    originalText: "Prefer small changes.",
    normalizedValue: "small changes",
    scopeDirectory,
    confidence: 1,
    extractionReason: "Non-verifiable preference.",
  };
}

describe("target scope before validation", () => {
  it("never dispatches sibling claims to validators or deferred output", async () => {
    validateClaimMock.mockImplementation(
      async (claim: ExtractedClaim): Promise<ValidatedClaim> => ({
        ...claim,
        status: "passed",
        evidence: [`Validated ${claim.id}.`],
      }),
    );
    const claims = [
      packageManagerClaim("root", "npm", "/repo"),
      packageManagerClaim("api", "pnpm", "/repo/packages/api"),
      commandClaim("web-command", "/repo/packages/web"),
      advisoryClaim("web-advisory", "/repo/packages/web"),
    ];

    const result = await validateExtractedClaims(
      claims,
      "/repo",
      { enabled: true },
      "/repo/packages/api",
    );

    expect(validateClaimMock.mock.calls.map(([claim]) => claim.id)).toEqual([
      "root",
      "api",
    ]);
    expect(result.validatedClaims.map((claim) => claim.id)).toEqual([
      "root",
      "api",
    ]);
    expect(result.deferredClaims).toEqual([]);
    expect(result.claimScopes).toHaveLength(4);
    expect(
      result.claimScopes
        .filter((scope) => !scope.applicable)
        .map((scope) => scope.claimId),
    ).toEqual(["web-command", "web-advisory"]);
  });
});
