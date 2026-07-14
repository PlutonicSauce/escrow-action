import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getErrorMessage } from "../utils/errors.js";
import { assertNoCheckoutFilters } from "./gitAttributes.js";
import {
  buildIsolatedGitEnvironment,
  isolatedGitArgs,
} from "./gitEnvironment.js";
import { runProcess, type ProcessRunner } from "./processRunner.js";

const GIT_TIMEOUT_MS = 30_000;

export interface TemporaryWorktree {
  repositoryRoot: string;
  containerDirectory: string;
  worktreeDirectory: string;
}

export interface CreateWorktreeOptions {
  runner?: ProcessRunner | undefined;
}

export async function createTemporaryWorktree(
  repositoryRoot: string,
  options: CreateWorktreeOptions = {},
): Promise<TemporaryWorktree> {
  const runner = options.runner ?? runProcess;
  const containerDirectory = await mkdtemp(join(tmpdir(), "agentcontract-worktree-"));
  const worktreeDirectory = join(containerDirectory, "checkout");
  const environment = buildIsolatedGitEnvironment(containerDirectory);

  try {
    await Promise.all([
      mkdir(join(containerDirectory, "git-home"), { recursive: true }),
      mkdir(join(containerDirectory, "git-config"), { recursive: true }),
    ]);
    await assertNoCheckoutFilters(
      runner,
      repositoryRoot,
      containerDirectory,
    );
    const result = await runner({
      executable: "git",
      args: isolatedGitArgs(repositoryRoot, [
        "worktree",
        "add",
        "--detach",
        worktreeDirectory,
        "HEAD",
      ]),
      cwd: repositoryRoot,
      environment,
      timeoutMs: GIT_TIMEOUT_MS,
      terminateProcessGroup: true,
    });

    if (result.timedOut) {
      throw new Error(`git worktree add timed out after ${GIT_TIMEOUT_MS}ms`);
    }
    if (result.exitCode !== 0) {
      const diagnostic = result.stderr.trim();
      throw new Error(
        diagnostic.length === 0
          ? `git worktree add exited with code ${String(result.exitCode)}`
          : `git worktree add failed: ${diagnostic}`,
      );
    }

    return { repositoryRoot, containerDirectory, worktreeDirectory };
  } catch (error: unknown) {
    try {
      await runner({
        executable: "git",
        args: isolatedGitArgs(repositoryRoot, [
          "worktree",
          "remove",
          "--force",
          worktreeDirectory,
        ]),
        cwd: repositoryRoot,
        environment,
        timeoutMs: GIT_TIMEOUT_MS,
        terminateProcessGroup: true,
      });
      await runner({
        executable: "git",
        args: isolatedGitArgs(repositoryRoot, ["worktree", "prune"]),
        cwd: repositoryRoot,
        environment,
        timeoutMs: GIT_TIMEOUT_MS,
        terminateProcessGroup: true,
      });
    } catch {
      // The primary creation error is more actionable; filesystem cleanup follows.
    }
    await rm(containerDirectory, { recursive: true, force: true });
    throw new Error(`Unable to create temporary Git worktree: ${getErrorMessage(error)}`);
  }
}
