import { describe, expect, it, vi } from "vitest";

import type { BranchCommandResult, ExtractedClaim } from "../../../src/models/claims.js";
import { validateCommandClaim } from "../../../src/validation/commandValidator.js";

const CLAIM: ExtractedClaim = {
  id: "command-1",
  type: "command_runs",
  sourceFile: "/repo/AGENTS.md",
  lineStart: 1,
  lineEnd: 1,
  originalText: "Run npm test.",
  normalizedValue: "npm test",
  scopeDirectory: "/repo",
  command: "npm test",
  confidence: 1,
  extractionReason: "Documented command",
};

const WORKTREE = {
  repositoryRoot: "/repo",
  containerDirectory: "/tmp/agentcontract-worktree-test",
  worktreeDirectory: "/tmp/agentcontract-worktree-test/checkout",
};

const PASSED_RESULT: BranchCommandResult = {
  command: "npm test",
  workingDirectory: WORKTREE.worktreeDirectory,
  status: "passed",
  exitCode: 0,
  stdout: "ok\n",
  stderr: "",
  durationMs: 10,
};

describe("validateCommandClaim", () => {
  it("does not classify or execute without --execute", async () => {
    const classify = vi.fn();
    const createWorktree = vi.fn();

    const result = await validateCommandClaim(CLAIM, {
      repositoryRoot: "/repo",
      commandDependencies: { classify, createWorktree },
    });

    expect(result.status).toBe("inconclusive");
    expect(result.evidence).toContain(
      "Command was not executed because --execute was not supplied.",
    );
    expect(classify).not.toHaveBeenCalled();
    expect(createWorktree).not.toHaveBeenCalled();
  });

  it.each([
    ["sudo node test.js", "privilege_escalation"],
    ["git push origin main", "git_destructive"],
    ["rm -rf build", "filesystem_destructive"],
    ["cat ~/.ssh/config", "sensitive_access"],
  ] as const)(
    "blocks %s before creating a worktree",
    async (command, category) => {
      const createWorktree = vi.fn();
      const result = await validateCommandClaim(
        { ...CLAIM, command },
        {
          repositoryRoot: "/repo",
          commandExecution: { enabled: true },
          commandDependencies: { createWorktree },
        },
      );

      expect(result.status).toBe("blocked");
      expect(result.commandResult?.status).toBe("blocked");
      expect(result.evidence[0]).toContain(category);
      expect(createWorktree).not.toHaveBeenCalled();
    },
  );

  it("executes an allowed command and cleans its worktree", async () => {
    const createWorktree = vi.fn().mockResolvedValue(WORKTREE);
    const execute = vi.fn().mockResolvedValue(PASSED_RESULT);
    const cleanup = vi.fn().mockResolvedValue(undefined);

    const result = await validateCommandClaim(CLAIM, {
      repositoryRoot: "/repo",
      commandExecution: { enabled: true, timeoutMs: 500 },
      commandDependencies: { createWorktree, execute, cleanup },
    });

    expect(result.status).toBe("passed");
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 500, worktree: WORKTREE }),
    );
    expect(cleanup).toHaveBeenCalledWith(WORKTREE);
  });

  it("cleans after execution exceptions", async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const result = await validateCommandClaim(CLAIM, {
      repositoryRoot: "/repo",
      commandExecution: { enabled: true },
      commandDependencies: {
        createWorktree: vi.fn().mockResolvedValue(WORKTREE),
        execute: vi.fn().mockRejectedValue(new Error("runner exploded")),
        cleanup,
      },
    });

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[0]).toContain("runner exploded");
    expect(cleanup).toHaveBeenCalledWith(WORKTREE);
  });

  it("retains the worktree only when requested", async () => {
    const cleanup = vi.fn();
    const result = await validateCommandClaim(CLAIM, {
      repositoryRoot: "/repo",
      commandExecution: { enabled: true, keepWorktree: true },
      commandDependencies: {
        createWorktree: vi.fn().mockResolvedValue(WORKTREE),
        execute: vi.fn().mockResolvedValue(PASSED_RESULT),
        cleanup,
      },
    });

    expect(result.status).toBe("passed");
    expect(result.evidence).toContain(
      `Temporary worktree retained at "${WORKTREE.worktreeDirectory}".`,
    );
    expect(cleanup).not.toHaveBeenCalled();
  });
});
