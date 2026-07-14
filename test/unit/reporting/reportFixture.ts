import type { ValidatedClaim } from "../../../src/models/claims.js";
import type { InstructionConflict } from "../../../src/models/conflicts.js";
import {
  createAgentContractReport,
  type AgentContractReport,
} from "../../../src/models/reports.js";

function claim(overrides: Partial<ValidatedClaim>): ValidatedClaim {
  return {
    id: "claim",
    type: "path_exists",
    sourceFile: "AGENTS.md",
    lineStart: 1,
    lineEnd: 1,
    originalText: "Read docs/guide.md.",
    normalizedValue: "docs/guide.md",
    scopeDirectory: "/repo",
    referencedPath: "docs/guide.md",
    confidence: 1,
    extractionReason: "Explicit repository claim.",
    status: "passed",
    evidence: ["Repository evidence matched."],
    ...overrides,
  };
}

export function createRichReport(): AgentContractReport {
  const jest = claim({
    id: "jest",
    type: "dependency_present",
    sourceFile: "packages/api/AGENTS.md",
    lineStart: 18,
    lineEnd: 18,
    originalText: "Use Jest for API tests.",
    normalizedValue: "Jest",
    scopeDirectory: "/repo/packages/api",
    referencedPath: undefined,
    dependencyNames: ["jest"],
    status: "passed",
  });
  const vitest = claim({
    id: "vitest",
    type: "dependency_present",
    sourceFile: "packages/api/AGENTS.override.md",
    lineStart: 4,
    lineEnd: 5,
    originalText: "Use Vitest\nfor API tests.",
    normalizedValue: "Vitest",
    scopeDirectory: "/repo/packages/api",
    referencedPath: undefined,
    dependencyNames: ["vitest"],
    status: "passed",
  });
  const conflict: InstructionConflict = {
    id: "conflict-1",
    type: "dependency_present",
    effectiveScopeDirectory: "/repo/packages/api",
    message: "Jest and Vitest are mutually exclusive test-framework guidance.",
    claims: [jest, vitest].map((item) => ({
      claimId: item.id,
      claimType: item.type,
      sourceFile: item.sourceFile,
      lineStart: item.lineStart,
      lineEnd: item.lineEnd,
      scopeDirectory: item.scopeDirectory,
      normalizedValue: item.normalizedValue,
    })),
  };

  return createAgentContractReport({
    version: "0.1.0",
    generatedAt: "2026-07-13T18:00:00.000Z",
    repositoryRoot: "/repo/<unsafe>&\"quoted\"",
    targetDirectory: "/repo/packages/api",
    instructionChain: [
      {
        path: "/repo/AGENTS.md",
        directory: "/repo",
        fileName: "AGENTS.md",
        content: "# Root <script>alert('instruction')</script>",
      },
      {
        path: "/repo/packages/api/AGENTS.override.md",
        directory: "/repo/packages/api",
        fileName: "AGENTS.override.md",
        content: "# API override",
      },
    ],
    claims: [
      claim({
        id: "missing-path",
        sourceFile: "AGENTS.md",
        lineStart: 7,
        lineEnd: 9,
        originalText:
          "Read docs/<missing>.md.\n```\n<script>alert('claim')</script>",
        normalizedValue: "docs/<missing>.md",
        referencedPath: "docs/<missing>.md",
        status: "failed",
        evidence: [
          "Path <docs/missing.md> does not exist & cannot be validated.",
        ],
        suggestion: "Create docs/<missing>.md or update the instruction.",
      }),
      claim({
        id: "advisory",
        type: "advisory",
        sourceFile: "AGENTS.md",
        lineStart: 12,
        lineEnd: 12,
        originalText: "Prefer focused changes.",
        normalizedValue: "focused changes",
        referencedPath: undefined,
        status: "advisory",
        evidence: [],
      }),
      claim({
        id: "root-manager",
        type: "package_manager",
        sourceFile: "AGENTS.md",
        lineStart: 14,
        lineEnd: 14,
        originalText: "Use npm.",
        normalizedValue: "npm",
        referencedPath: undefined,
        packageManager: "npm",
        status: "overridden",
        evidence: ["Nested pnpm guidance supersedes this claim for the target."],
      }),
      claim({
        id: "blocked-command",
        type: "command_runs",
        sourceFile: "packages/api/AGENTS.override.md",
        lineStart: 8,
        lineEnd: 8,
        originalText: "Run a blocked command.",
        normalizedValue: "blocked command",
        scopeDirectory: "/repo/packages/api",
        referencedPath: undefined,
        command: "blocked command",
        status: "blocked",
        evidence: ["Command was blocked by deterministic safety policy."],
        commandResult: {
          command: "blocked command",
          workingDirectory: "/tmp/worktree/<unsafe>",
          status: "blocked",
          exitCode: null,
          stdout: "first stdout line\nsecond <script>stdout</script> line\n",
          stderr: "first stderr line\n</details><script>stderr</script>\n",
          durationMs: 0,
        },
      }),
      jest,
      vitest,
    ],
    conflicts: [conflict],
  });
}

export function createEmptyReport(): AgentContractReport {
  return createAgentContractReport({
    version: "0.1.0",
    generatedAt: "2026-07-13T18:00:00.000Z",
    repositoryRoot: "/repo",
    targetDirectory: "/repo",
    instructionChain: [],
    claims: [],
    conflicts: [],
  });
}
