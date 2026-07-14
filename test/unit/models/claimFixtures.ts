import type {
  ExtractedClaim,
  ValidatedClaim,
} from "../../../src/models/claims.js";
import type { InstructionConflict } from "../../../src/models/conflicts.js";
import {
  createAgentContractReport,
  type AgentContractReport,
} from "../../../src/models/reports.js";

export function createExtractedClaim(
  overrides: Partial<ExtractedClaim> = {},
): ExtractedClaim {
  return {
    id: "claim-1",
    type: "path_exists",
    sourceFile: "AGENTS.md",
    lineStart: 3,
    lineEnd: 3,
    originalText: "Read docs/architecture.md before making changes.",
    normalizedValue: "docs/architecture.md",
    scopeDirectory: ".",
    referencedPath: "docs/architecture.md",
    confidence: 0.95,
    extractionReason: "The instruction references a repository path.",
    ...overrides,
  };
}

export function createValidatedClaim(
  overrides: Partial<ValidatedClaim> = {},
): ValidatedClaim {
  return {
    ...createExtractedClaim(),
    status: "passed",
    evidence: ["docs/architecture.md exists"],
    ...overrides,
  };
}

export function createReport(
  claims: ValidatedClaim[],
  conflicts: InstructionConflict[] = [],
): AgentContractReport {
  return createAgentContractReport({
    version: "0.1.0",
    generatedAt: "2026-07-13T12:00:00.000Z",
    repositoryRoot: "/repo",
    targetDirectory: "/repo/packages/api",
    instructionChain: [
      {
        path: "/repo/AGENTS.md",
        directory: "/repo",
        fileName: "AGENTS.md",
        content: "# Instructions\n",
      },
    ],
    claims,
    conflicts,
  });
}
