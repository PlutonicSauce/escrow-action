import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { getErrorMessage } from "../utils/errors.js";
import {
  buildIsolatedGitEnvironment,
  isolatedGitArgs,
} from "./gitEnvironment.js";
import type { ProcessResult, ProcessRunner } from "./processRunner.js";

const GIT_TIMEOUT_MS = 30_000;

export function containsCheckoutFilterDirective(content: string): boolean {
  return content
    .replaceAll("\r\n", "\n")
    .split("\n")
    .some((line) => {
      const instruction = line.trim();
      if (instruction.length === 0 || instruction.startsWith("#")) {
        return false;
      }
      return /(?:^|\s)(?:filter(?:=[^\s]+)?|-filter|!filter)(?:\s|$)/u.test(
        instruction,
      );
    });
}

function requireSuccessfulGitResult(
  operation: string,
  result: ProcessResult,
): string {
  if (result.timedOut) {
    throw new Error(`${operation} timed out after ${GIT_TIMEOUT_MS}ms`);
  }
  if (result.exitCode !== 0) {
    throw new Error(
      `${operation} failed: ${result.stderr.trim() || `exit code ${String(result.exitCode)}`}`,
    );
  }
  return result.stdout;
}

async function runGitInspection(
  runner: ProcessRunner,
  repositoryRoot: string,
  runtimeDirectory: string,
  args: readonly string[],
  operation: string,
): Promise<string> {
  const result = await runner({
    executable: "git",
    args: isolatedGitArgs(repositoryRoot, args),
    cwd: repositoryRoot,
    environment: buildIsolatedGitEnvironment(runtimeDirectory),
    timeoutMs: GIT_TIMEOUT_MS,
    terminateProcessGroup: true,
  });
  return requireSuccessfulGitResult(operation, result);
}

export async function assertNoCheckoutFilters(
  runner: ProcessRunner,
  repositoryRoot: string,
  runtimeDirectory: string,
): Promise<void> {
  const fileList = await runGitInspection(
    runner,
    repositoryRoot,
    runtimeDirectory,
    ["ls-tree", "-r", "--name-only", "-z", "HEAD"],
    "git ls-tree attribute inspection",
  );
  const attributeFiles = fileList
    .split("\0")
    .filter((path) => path === ".gitattributes" || path.endsWith("/.gitattributes"));

  for (const path of attributeFiles) {
    const content = await runGitInspection(
      runner,
      repositoryRoot,
      runtimeDirectory,
      ["show", "--no-textconv", `HEAD:${path}`],
      `git show ${path}`,
    );
    if (containsCheckoutFilterDirective(content)) {
      throw new Error(
        `Repository attribute file "${path}" requests a checkout filter; command execution is blocked before worktree creation`,
      );
    }
  }

  const localAttributesPath = (
    await runGitInspection(
      runner,
      repositoryRoot,
      runtimeDirectory,
      ["rev-parse", "--git-path", "info/attributes"],
      "git rev-parse local attribute inspection",
    )
  ).trim();
  if (localAttributesPath.length === 0) {
    return;
  }

  const resolvedAttributesPath = isAbsolute(localAttributesPath)
    ? localAttributesPath
    : resolve(repositoryRoot, localAttributesPath);
  try {
    const metadata = await lstat(resolvedAttributesPath);
    if (metadata.isSymbolicLink()) {
      throw new Error("local Git attribute file is a symbolic link");
    }
    if (
      metadata.isFile() &&
      containsCheckoutFilterDirective(
        await readFile(resolvedAttributesPath, "utf8"),
      )
    ) {
      throw new Error("local Git attribute file requests a checkout filter");
    }
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return;
    }
    throw new Error(
      `Unable to verify local Git attributes safely: ${getErrorMessage(error)}`,
    );
  }
}
