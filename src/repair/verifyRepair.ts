import { lstat, readFile, writeFile } from "node:fs/promises";
import { basename, join, posix, relative, sep } from "node:path";
import { TextDecoder } from "node:util";

import type { CheckCommandOptions } from "../commands/check.js";
import {
  buildIsolatedGitEnvironment,
  isolatedGitArgs,
} from "../execution/gitEnvironment.js";
import { runProcess, type ProcessRunner } from "../execution/processRunner.js";
import type { TemporaryWorktree } from "../execution/createWorktree.js";
import type { ValidatedClaim } from "../models/claims.js";
import type { AgentContractReport } from "../models/reports.js";
import { RepairRejectedError } from "../utils/errors.js";

const GIT_TIMEOUT_MS = 30_000;
const ALLOWED_INSTRUCTION_NAMES = new Set([
  "AGENTS.md",
  "AGENTS.override.md",
]);
const BINARY_PATCH_MARKER = /^(?:GIT binary patch|Binary files .+ differ)$/mu;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export type RepositoryEvaluator = (
  repository: string,
  options: CheckCommandOptions,
) => Promise<AgentContractReport>;

export interface VerifyRepairOptions {
  worktree: TemporaryWorktree;
  patch: string;
  allowedFiles: readonly string[];
  beforeReport: AgentContractReport;
  targetRelativePath: string;
  checkOptions: CheckCommandOptions;
  evaluate: RepositoryEvaluator;
  runner?: ProcessRunner | undefined;
}

export interface VerifiedRepair {
  afterReport: AgentContractReport;
  changedFiles: string[];
  diff: string;
}

function splitNullTerminated(output: string): string[] {
  return output.split("\0").filter((item) => item.length > 0);
}

function toGitPath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

function assertSafeRelativePath(path: string): void {
  if (
    path.length === 0 ||
    path.includes("\0") ||
    posix.isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path.split("/").includes("..")
  ) {
    throw new RepairRejectedError(
      `Repair changed an unsafe repository path: "${path}".`,
    );
  }
}

function assertTextualPatch(patch: string): void {
  if (patch.includes("\0") || BINARY_PATCH_MARKER.test(patch)) {
    throw new RepairRejectedError(
      "Repair patches must be textual unified diffs; binary changes are forbidden.",
    );
  }
}

async function runGit(
  repositoryRoot: string,
  containerDirectory: string,
  args: readonly string[],
  runner: ProcessRunner,
): Promise<string> {
  const result = await runner({
    executable: "git",
    args: isolatedGitArgs(repositoryRoot, args),
    cwd: repositoryRoot,
    environment: buildIsolatedGitEnvironment(containerDirectory),
    timeoutMs: GIT_TIMEOUT_MS,
    terminateProcessGroup: true,
  });
  if (result.timedOut) {
    throw new RepairRejectedError(
      `Git ${args[0] ?? "operation"} timed out while checking the repair.`,
    );
  }
  if (result.exitCode !== 0) {
    const diagnostic = result.stderr.trim();
    throw new RepairRejectedError(
      diagnostic.length === 0
        ? `Git ${args[0] ?? "operation"} exited with code ${String(result.exitCode)} while checking the repair.`
        : `Git ${args[0] ?? "operation"} rejected the repair: ${diagnostic}`,
    );
  }
  return result.stdout;
}

async function writeAndApplyPatch(
  repositoryRoot: string,
  containerDirectory: string,
  patch: string,
  runner: ProcessRunner,
  fileName: string,
): Promise<void> {
  const patchPath = join(containerDirectory, fileName);
  await writeFile(patchPath, patch, { encoding: "utf8", mode: 0o600 });
  const args = ["apply", "--whitespace=error-all", patchPath] as const;
  await runGit(
    repositoryRoot,
    containerDirectory,
    ["apply", "--check", "--whitespace=error-all", patchPath],
    runner,
  );
  await runGit(repositoryRoot, containerDirectory, args, runner);
}

async function collectChangedFiles(
  worktree: TemporaryWorktree,
  runner: ProcessRunner,
): Promise<string[]> {
  const [unstaged, staged, untracked] = await Promise.all([
    runGit(
      worktree.worktreeDirectory,
      worktree.containerDirectory,
      ["diff", "--name-only", "--no-renames", "-z", "--"],
      runner,
    ),
    runGit(
      worktree.worktreeDirectory,
      worktree.containerDirectory,
      ["diff", "--cached", "--name-only", "--no-renames", "-z", "--"],
      runner,
    ),
    runGit(
      worktree.worktreeDirectory,
      worktree.containerDirectory,
      ["ls-files", "--others", "--exclude-standard", "-z", "--"],
      runner,
    ),
  ]);
  return [
    ...new Set([
      ...splitNullTerminated(unstaged),
      ...splitNullTerminated(staged),
      ...splitNullTerminated(untracked),
    ]),
  ].sort();
}

async function validateChangedFiles(
  worktree: TemporaryWorktree,
  changedFiles: readonly string[],
  allowedFiles: readonly string[],
): Promise<void> {
  if (changedFiles.length === 0) {
    throw new RepairRejectedError("Codex repair patch did not change any files.");
  }

  const allowed = new Set(allowedFiles);
  for (const path of changedFiles) {
    assertSafeRelativePath(path);
    if (!allowed.has(path) || !ALLOWED_INSTRUCTION_NAMES.has(basename(path))) {
      throw new RepairRejectedError(
        `Repair changed forbidden file "${path}"; only effective instruction files are allowed.`,
      );
    }

    try {
      const metadata = await lstat(join(worktree.worktreeDirectory, path));
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new RepairRejectedError(
          `Repair changed instruction path "${path}" to a non-regular file.`,
        );
      }
      const content = await readFile(join(worktree.worktreeDirectory, path));
      if (content.includes(0)) {
        throw new RepairRejectedError(
          `Repair changed instruction file "${path}" to binary content.`,
        );
      }
      try {
        UTF8_DECODER.decode(content);
      } catch {
        throw new RepairRejectedError(
          `Repair changed instruction file "${path}" to invalid UTF-8 content.`,
        );
      }
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new RepairRejectedError(
          `Repair deleted allowed instruction file "${path}"; repairs must update existing files in place.`,
        );
      }
      throw error;
    }
  }
}

function failureKey(
  claim: ValidatedClaim,
  repositoryRoot: string,
): string {
  const source = toGitPath(relative(repositoryRoot, claim.sourceFile));
  const scope = toGitPath(relative(repositoryRoot, claim.scopeDirectory));
  return JSON.stringify([claim.type, source, scope, claim.normalizedValue]);
}

function assertRepairImprovesFailures(
  before: AgentContractReport,
  after: AgentContractReport,
): void {
  const beforeFailures = before.claims.filter((claim) => claim.status === "failed");
  const afterFailures = after.claims.filter((claim) => claim.status === "failed");
  const remainingBeforeCounts = new Map<string, number>();
  for (const claim of beforeFailures) {
    const key = failureKey(claim, before.repositoryRoot);
    remainingBeforeCounts.set(key, (remainingBeforeCounts.get(key) ?? 0) + 1);
  }
  const newFailures = afterFailures.filter((claim) => {
    const key = failureKey(claim, after.repositoryRoot);
    const remaining = remainingBeforeCounts.get(key) ?? 0;
    if (remaining === 0) {
      return true;
    }
    remainingBeforeCounts.set(key, remaining - 1);
    return false;
  });

  if (newFailures.length > 0) {
    const sources = newFailures
      .map((claim) => `${claim.sourceFile}:${String(claim.lineStart)} (${claim.normalizedValue})`)
      .join(", ");
    throw new RepairRejectedError(
      `Repair introduced ${String(newFailures.length)} new failed claim(s): ${sources}.`,
    );
  }
  if (afterFailures.length >= beforeFailures.length) {
    throw new RepairRejectedError(
      `Repair did not reduce failed claims (before ${String(beforeFailures.length)}, after ${String(afterFailures.length)}).`,
    );
  }
}

export async function assertRepositoryClean(
  repositoryRoot: string,
  containerDirectory: string,
  runner: ProcessRunner = runProcess,
): Promise<void> {
  const status = await runGit(
    repositoryRoot,
    containerDirectory,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    runner,
  );
  if (status.length > 0) {
    throw new RepairRejectedError(
      "Repair mode requires a clean active repository so verification and application use the same Git snapshot.",
    );
  }
}

export async function verifyRepair(
  options: VerifyRepairOptions,
): Promise<VerifiedRepair> {
  const runner = options.runner ?? runProcess;
  assertTextualPatch(options.patch);
  await writeAndApplyPatch(
    options.worktree.worktreeDirectory,
    options.worktree.containerDirectory,
    options.patch,
    runner,
    "proposed-repair.patch",
  );
  const changedFiles = await collectChangedFiles(options.worktree, runner);
  await validateChangedFiles(options.worktree, changedFiles, options.allowedFiles);
  const structuralChanges = await runGit(
    options.worktree.worktreeDirectory,
    options.worktree.containerDirectory,
    ["diff", "--summary", "--no-renames", "--"],
    runner,
  );
  if (structuralChanges.trim().length > 0) {
    throw new RepairRejectedError(
      `Repair attempted a structural file change: ${structuralChanges.trim()}.`,
    );
  }

  const afterReport = await options.evaluate(
    options.worktree.worktreeDirectory,
    {
      ...options.checkOptions,
      target: options.targetRelativePath,
    },
  );
  assertRepairImprovesFailures(options.beforeReport, afterReport);
  const diff = await runGit(
    options.worktree.worktreeDirectory,
    options.worktree.containerDirectory,
    ["diff", "--no-ext-diff", "--no-color", "--binary", "--no-renames", "--"],
    runner,
  );
  if (diff.trim().length === 0) {
    throw new RepairRejectedError("Verified repair produced an empty Git diff.");
  }

  return { afterReport, changedFiles, diff };
}

export async function applyVerifiedPatch(
  repositoryRoot: string,
  containerDirectory: string,
  patch: string,
  runner: ProcessRunner = runProcess,
): Promise<void> {
  await assertRepositoryClean(repositoryRoot, containerDirectory, runner);
  await writeAndApplyPatch(
    repositoryRoot,
    containerDirectory,
    patch,
    runner,
    "verified-repair.patch",
  );
}
