import { access } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import type { CodexProcessRunner } from "../../../src/extraction/codexClient.js";
import { generateRepair } from "../../../src/repair/generateRepair.js";
import { createValidatedClaim } from "../models/claimFixtures.js";

const patch = `diff --git a/AGENTS.md b/AGENTS.md
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1 +1 @@
-Use npm.
+Use pnpm.
`;

function options(runner: CodexProcessRunner) {
  return {
    worktreeDirectory: "/tmp/repair-worktree",
    instructionChain: [
      {
        path: "/repo/AGENTS.md",
        directory: "/repo",
        fileName: "AGENTS.md" as const,
        content: "Use npm.",
      },
    ],
    failedClaims: [createValidatedClaim({ status: "failed" })],
    allowedFiles: ["AGENTS.md"],
    environment: {},
    runner,
  };
}

describe("generateRepair", () => {
  it("uses GPT-5.6, a read-only sandbox, and schema-constrained JSON", async () => {
    const runner = vi.fn<CodexProcessRunner>().mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ patch }),
      stderr: "",
      timedOut: false,
    });

    const result = await generateRepair(options(runner));

    expect(result).toEqual({ patch, model: "gpt-5.6-terra" });
    const request = runner.mock.calls[0]?.[0];
    expect(request?.cwd).not.toBe("/tmp/repair-worktree");
    expect(request?.cwd).toContain("agentcontract-repair-");
    expect(request?.args).toContain("read-only");
    expect(request?.args).toContain("--output-schema");
    expect(request?.args).toContain("--ignore-rules");
    expect(request?.args).toContain("--skip-git-repo-check");
    expect(request?.args).toContain("shell_tool");
    expect(request?.stdin).toContain("Every repository path not listed");
    expect(request?.args).toEqual(
      expect.arrayContaining(["--cd", request?.cwd ?? "missing-cwd"]),
    );
    await expect(access(request?.cwd ?? "")).rejects.toThrow();
  });

  it("uses an explicit model override", async () => {
    const runner = vi.fn<CodexProcessRunner>().mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ patch }),
      stderr: "",
      timedOut: false,
    });

    const result = await generateRepair({
      ...options(runner),
      model: "gpt-repair",
    });

    expect(result.model).toBe("gpt-repair");
    expect(runner.mock.calls[0]?.[0].args).toContain("gpt-repair");
  });

  it.each([
    ["nonzero exit", { exitCode: 7, stdout: "", stderr: "failed", timedOut: false }],
    ["timeout", { exitCode: null, stdout: "", stderr: "", timedOut: true }],
    ["empty output", { exitCode: 0, stdout: "", stderr: "", timedOut: false }],
    ["malformed JSON", { exitCode: 0, stdout: "not-json", stderr: "", timedOut: false }],
    ["schema mismatch", { exitCode: 0, stdout: "{}", stderr: "", timedOut: false }],
  ] as const)("rejects %s", async (_name, response) => {
    const runner = vi.fn<CodexProcessRunner>().mockResolvedValue(response);

    await expect(generateRepair(options(runner))).rejects.toMatchObject({
      exitCode: 3,
    });
  });
});
