import { rm } from "node:fs/promises";

import { getErrorMessage } from "../utils/errors.js";
import type { TemporaryWorktree } from "./createWorktree.js";
import {
  buildIsolatedGitEnvironment,
  isolatedGitArgs,
} from "./gitEnvironment.js";
import { runProcess, type ProcessRunner } from "./processRunner.js";

const GIT_TIMEOUT_MS = 30_000;

export interface CleanupWorktreeOptions {
  runner?: ProcessRunner | undefined;
}

export async function cleanupTemporaryWorktree(
  worktree: TemporaryWorktree,
  options: CleanupWorktreeOptions = {},
): Promise<void> {
  const runner = options.runner ?? runProcess;
  const errors: string[] = [];
  const environment = buildIsolatedGitEnvironment(worktree.containerDirectory);

  try {
    const removeResult = await runner({
      executable: "git",
      args: isolatedGitArgs(worktree.repositoryRoot, [
        "worktree",
        "remove",
        "--force",
        worktree.worktreeDirectory,
      ]),
      cwd: worktree.repositoryRoot,
      environment,
      timeoutMs: GIT_TIMEOUT_MS,
      terminateProcessGroup: true,
    });
    if (removeResult.timedOut || removeResult.exitCode !== 0) {
      errors.push(
        removeResult.timedOut
          ? "git worktree remove timed out"
          : removeResult.stderr.trim() ||
              `git worktree remove exited with code ${String(removeResult.exitCode)}`,
      );
    }
  } catch (error: unknown) {
    errors.push(getErrorMessage(error));
  }

  try {
    await rm(worktree.containerDirectory, { recursive: true, force: true });
  } catch (error: unknown) {
    errors.push(getErrorMessage(error));
  }

  try {
    const pruneResult = await runner({
      executable: "git",
      args: isolatedGitArgs(worktree.repositoryRoot, ["worktree", "prune"]),
      cwd: worktree.repositoryRoot,
      environment,
      timeoutMs: GIT_TIMEOUT_MS,
      terminateProcessGroup: true,
    });
    if (pruneResult.timedOut || pruneResult.exitCode !== 0) {
      errors.push(
        pruneResult.timedOut
          ? "git worktree prune timed out"
          : pruneResult.stderr.trim() ||
              `git worktree prune exited with code ${String(pruneResult.exitCode)}`,
      );
    }
  } catch (error: unknown) {
    errors.push(getErrorMessage(error));
  }

  if (errors.length > 0) {
    throw new Error(`Unable to fully clean temporary Git worktree: ${errors.join("; ")}`);
  }
}
