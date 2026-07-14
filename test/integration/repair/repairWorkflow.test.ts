import { execFileSync } from "node:child_process";
import {
  access,
  cp,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { fixRepository } from "../../../src/commands/fix.js";
import {
  createTemporaryWorktree,
  type TemporaryWorktree,
} from "../../../src/execution/createWorktree.js";
import type {
  CodexProcessRequest,
  CodexProcessResult,
  CodexProcessRunner,
} from "../../../src/extraction/codexClient.js";

const FIXTURE = fileURLToPath(
  new URL("../../fixtures/repair/repository/", import.meta.url),
);
const temporaryDirectories: string[] = [];

const validPatch = `diff --git a/AGENTS.md b/AGENTS.md
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,2 +1,2 @@
-Use npm to install dependencies.
+Use pnpm to install dependencies.
 Run \`node --version\` to check Node.js.
`;

const sourcePatch = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-export const fixture = true;
+export const fixture = false;
`;

const packagePatch = `diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -1,4 +1,5 @@
 {
   "name": "repair-fixture",
+  "description": "forbidden repair",
   "private": true
 }
`;

const newFailurePatch = `diff --git a/AGENTS.md b/AGENTS.md
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,2 +1,2 @@
-Use npm to install dependencies.
+Use yarn to install dependencies.
 Run \`node --version\` to check Node.js.
`;

const newForbiddenFilePatch = `diff --git a/src/generated.ts b/src/generated.ts
new file mode 100644
--- /dev/null
+++ b/src/generated.ts
@@ -0,0 +1 @@
+export const generated = true;
`;

const deletedSourcePatch = `diff --git a/src/app.ts b/src/app.ts
deleted file mode 100644
--- a/src/app.ts
+++ /dev/null
@@ -1 +0,0 @@
-export const fixture = true;
`;

function git(repository: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function createRepository(): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "agentcontract-repair-test-"));
  temporaryDirectories.push(container);
  const repository = join(container, "repository");
  await cp(FIXTURE, repository, { recursive: true });
  git(repository, "init", "--quiet");
  git(repository, "config", "user.name", "AgentContract Test");
  git(repository, "config", "user.email", "agentcontract@example.invalid");
  git(repository, "add", ".");
  git(repository, "commit", "--quiet", "-m", "fixture");
  return repository;
}

function worktreeCount(repository: string): number {
  return git(repository, "worktree", "list", "--porcelain")
    .split("\n")
    .filter((line) => line.startsWith("worktree ")).length;
}

async function createBinaryInstructionPatch(repository: string): Promise<string> {
  const instructionPath = join(repository, "AGENTS.md");
  const original = await readFile(instructionPath);
  const replacement = Buffer.concat([
    Buffer.from("Use pnpm to install dependencies."),
    Buffer.from([0]),
    Buffer.from("\nRun `node --version` to check Node.js.\n"),
  ]);
  try {
    await writeFile(instructionPath, replacement);
    return git(repository, "diff", "--binary", "--", "AGENTS.md");
  } finally {
    await writeFile(instructionPath, original);
  }
}

async function createSymlinkInstructionPatch(repository: string): Promise<string> {
  const instructionPath = join(repository, "AGENTS.md");
  const original = await readFile(instructionPath);
  try {
    await rm(instructionPath);
    await symlink("../outside.txt", instructionPath);
    return git(repository, "diff", "--binary", "--", "AGENTS.md");
  } finally {
    await rm(instructionPath, { force: true });
    await writeFile(instructionPath, original);
  }
}

async function createRenamePatch(repository: string): Promise<string> {
  const source = join(repository, "AGENTS.md");
  const destination = join(repository, "RENAMED.md");
  try {
    await rename(source, destination);
    return git(repository, "diff", "--binary", "--find-renames", "--");
  } finally {
    await rename(destination, source);
  }
}

function extractionResponse(request: CodexProcessRequest): CodexProcessResult {
  const marker = "Supplied instruction files follow as JSON.";
  const markerIndex = request.stdin.indexOf(marker);
  const jsonStart = request.stdin.indexOf("[", markerIndex);
  const supplied = JSON.parse(request.stdin.slice(jsonStart)) as Array<{
    sourceFile: string;
    scopeDirectory: string;
    numberedContent: string;
  }>;
  const instruction = supplied[0];
  if (instruction === undefined) {
    throw new Error("Expected one supplied instruction file.");
  }
  const originalText = instruction.numberedContent
    .split("\n")[0]
    ?.replace(/^1: /u, "") ?? "";
  const manager = originalText.includes("pnpm")
    ? "pnpm"
    : originalText.includes("yarn")
      ? "yarn"
      : "npm";
  const commandText = instruction.numberedContent
    .split("\n")[1]
    ?.replace(/^2: /u, "") ?? "";
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      claims: [
        {
          id: "package-manager",
          type: "package_manager",
          sourceFile: instruction.sourceFile,
          lineStart: 1,
          lineEnd: 1,
          originalText,
          normalizedValue: manager,
          scopeDirectory: instruction.scopeDirectory,
          packageManager: manager,
          confidence: 1,
          extractionReason: "Explicit package-manager instruction.",
        },
        {
          id: "node-version",
          type: "command_runs",
          sourceFile: instruction.sourceFile,
          lineStart: 2,
          lineEnd: 2,
          originalText: commandText,
          normalizedValue: "node --version",
          scopeDirectory: instruction.scopeDirectory,
          command: "node --version",
          confidence: 1,
          extractionReason: "Explicit documented command.",
        },
      ],
    }),
    stderr: "",
    timedOut: false,
  };
}

function successfulRepairRunner(patch: string): CodexProcessRunner {
  return vi.fn<CodexProcessRunner>().mockResolvedValue({
    exitCode: 0,
    stdout: JSON.stringify({ patch }),
    stderr: "",
    timedOut: false,
  });
}

function dependencies(
  patch: string,
  output: string[],
  repairRunner: CodexProcessRunner = successfulRepairRunner(patch),
  createdWorktrees?: TemporaryWorktree[],
) {
  return {
    generatedAt: () => "2026-07-13T20:00:00.000Z",
    writeConsole: (value: string) => {
      output.push(value);
    },
    extractionRunner: vi
      .fn<CodexProcessRunner>()
      .mockImplementation(async (request) => extractionResponse(request)),
    repairRunner,
    createWorktree:
      createdWorktrees === undefined
        ? undefined
        : async (repositoryRoot: string) => {
            const worktree = await createTemporaryWorktree(repositoryRoot);
            createdWorktrees.push(worktree);
            return worktree;
          },
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("restricted repair workflow", () => {
  it("previews a verified repair without changing the active repository", async () => {
    const repository = await createRepository();
    const before = await readFile(join(repository, "AGENTS.md"), "utf8");
    const headBefore = git(repository, "rev-parse", "HEAD").trim();
    const output: string[] = [];
    const createdWorktrees: TemporaryWorktree[] = [];
    const repairDependencies = dependencies(
      validPatch,
      output,
      successfulRepairRunner(validPatch),
      createdWorktrees,
    );

    const result = await fixRepository(
      repository,
      {},
      repairDependencies,
    );

    expect(result.beforeReport.overallStatus).toBe("fail");
    expect(result.afterReport?.overallStatus).toBe("pass_with_warnings");
    expect(result.changedFiles).toEqual(["AGENTS.md"]);
    expect(result.applied).toBe(false);
    expect(await readFile(join(repository, "AGENTS.md"), "utf8")).toBe(before);
    expect(output.join("\n")).toContain("=== Before repair ===");
    expect(output.join("\n")).toContain("=== Verified instruction diff ===");
    expect(output.join("\n")).toContain("=== After repair ===");
    expect(output.join("\n")).toContain("Preview only");
    expect(git(repository, "status", "--porcelain")).toBe("");
    expect(git(repository, "rev-parse", "HEAD").trim()).toBe(headBefore);
    expect(repairDependencies.extractionRunner).toHaveBeenCalledTimes(2);
    expect(worktreeCount(repository)).toBe(1);
    await expect(access(createdWorktrees[0]?.containerDirectory ?? "")).rejects.toThrow();
  });

  it("reruns documented command checks during verification when --execute is used", async () => {
    const repository = await createRepository();

    const result = await fixRepository(
      repository,
      { execute: true, timeout: 5 },
      dependencies(validPatch, []),
    );

    const beforeCommand = result.beforeReport.claims.find(
      (claim) => claim.id === "node-version",
    );
    const afterCommand = result.afterReport?.claims.find(
      (claim) => claim.id === "node-version",
    );
    expect(beforeCommand?.status).toBe("passed");
    expect(beforeCommand?.commandResult?.exitCode).toBe(0);
    expect(afterCommand?.status).toBe("passed");
    expect(afterCommand?.commandResult?.exitCode).toBe(0);
    expect(result.afterReport?.overallStatus).toBe("pass");
    expect(worktreeCount(repository)).toBe(1);
  });

  it("applies only a verified instruction repair when --apply is explicit", async () => {
    const repository = await createRepository();
    const headBefore = git(repository, "rev-parse", "HEAD").trim();
    const output: string[] = [];

    const result = await fixRepository(
      repository,
      { apply: true },
      dependencies(validPatch, output),
    );

    expect(result.applied).toBe(true);
    expect(await readFile(join(repository, "AGENTS.md"), "utf8")).toBe(
      "Use pnpm to install dependencies.\nRun `node --version` to check Node.js.\n",
    );
    expect(await readFile(join(repository, "src/app.ts"), "utf8")).toBe(
      "export const fixture = true;\n",
    );
    expect(output.join("\n")).toContain("applied to the active repository");
    expect(git(repository, "status", "--porcelain").trim()).toBe("M AGENTS.md");
    expect(git(repository, "rev-parse", "HEAD").trim()).toBe(headBefore);
    expect(worktreeCount(repository)).toBe(1);
  });

  it.each([
    ["source code", sourcePatch, "src/app.ts"],
    ["package.json", packagePatch, "package.json"],
  ])("rejects a %s modification and cleans the repair worktree", async (_name, patch, path) => {
    const repository = await createRepository();
    const before = await readFile(join(repository, path), "utf8");
    const createdWorktrees: TemporaryWorktree[] = [];

    await expect(
      fixRepository(
        repository,
        {},
        dependencies(patch, [], successfulRepairRunner(patch), createdWorktrees),
      ),
    ).rejects.toThrow(`Repair changed forbidden file "${path}"`);

    expect(await readFile(join(repository, path), "utf8")).toBe(before);
    expect(git(repository, "status", "--porcelain")).toBe("");
    expect(worktreeCount(repository)).toBe(1);
    await expect(access(createdWorktrees[0]?.containerDirectory ?? "")).rejects.toThrow();
  });

  it("rejects a repair that introduces a new failed claim", async () => {
    const repository = await createRepository();
    const before = await readFile(join(repository, "AGENTS.md"), "utf8");
    const repairDependencies = dependencies(newFailurePatch, []);

    await expect(
      fixRepository(repository, {}, repairDependencies),
    ).rejects.toThrow("Repair introduced 1 new failed claim");

    expect(await readFile(join(repository, "AGENTS.md"), "utf8")).toBe(before);
    expect(git(repository, "status", "--porcelain")).toBe("");
    expect(repairDependencies.extractionRunner).toHaveBeenCalledTimes(2);
    expect(worktreeCount(repository)).toBe(1);
  });

  it("rejects conversion of an allowed instruction file into a symlink", async () => {
    const repository = await createRepository();
    const patch = await createSymlinkInstructionPatch(repository);

    await expect(
      fixRepository(repository, {}, dependencies(patch, [])),
    ).rejects.toThrow(/non-regular file|structural file change/u);

    expect(git(repository, "status", "--porcelain")).toBe("");
    expect(worktreeCount(repository)).toBe(1);
  });

  it("rejects a rename from an allowed instruction file to a forbidden path", async () => {
    const repository = await createRepository();
    const patch = await createRenamePatch(repository);

    await expect(
      fixRepository(repository, {}, dependencies(patch, [])),
    ).rejects.toThrow(/forbidden file|deleted allowed instruction file/u);

    expect(git(repository, "status", "--porcelain")).toBe("");
    expect(worktreeCount(repository)).toBe(1);
  });

  it.each([
    ["new forbidden file", newForbiddenFilePatch, "src/generated.ts"],
    ["deleted source file", deletedSourcePatch, "src/app.ts"],
  ])("rejects a %s", async (_name, patch, forbiddenPath) => {
    const repository = await createRepository();

    await expect(
      fixRepository(repository, {}, dependencies(patch, [])),
    ).rejects.toThrow(`Repair changed forbidden file "${forbiddenPath}"`);

    expect(git(repository, "status", "--porcelain")).toBe("");
    expect(worktreeCount(repository)).toBe(1);
  });

  it("rejects a Git binary patch targeting an allowed instruction file", async () => {
    const repository = await createRepository();
    const patch = await createBinaryInstructionPatch(repository);

    await expect(
      fixRepository(repository, {}, dependencies(patch, [])),
    ).rejects.toThrow("Repair patches must be textual unified diffs");

    expect(git(repository, "status", "--porcelain")).toBe("");
    expect(worktreeCount(repository)).toBe(1);
  });

  it("rejects a malformed patch and cleans the repair worktree", async () => {
    const repository = await createRepository();

    await expect(
      fixRepository(repository, {}, dependencies("not a unified diff", [])),
    ).rejects.toThrow(/Git apply rejected the repair/u);

    expect(worktreeCount(repository)).toBe(1);
  });

  it("propagates Codex failure and cleans the repair worktree", async () => {
    const repository = await createRepository();
    const repairRunner = vi.fn<CodexProcessRunner>().mockResolvedValue({
      exitCode: 9,
      stdout: "",
      stderr: "Codex unavailable",
      timedOut: false,
    });

    await expect(
      fixRepository(
        repository,
        {},
        dependencies(validPatch, [], repairRunner),
      ),
    ).rejects.toMatchObject({ exitCode: 3 });

    expect(worktreeCount(repository)).toBe(1);
  });
});
