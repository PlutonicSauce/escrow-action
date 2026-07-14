import { mkdir, opendir, readlink, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import type { BranchCommandResult } from "../models/claims.js";
import { isPathInsideRepository } from "../utils/paths.js";
import type { TemporaryWorktree } from "./createWorktree.js";
import { runProcess, type ProcessRunner } from "./processRunner.js";

const SENSITIVE_ENVIRONMENT_NAME =
  /(?:TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_KEY|PRIVATE_KEY|AUTH|COOKIE|SESSION)|^(?:AWS|AZURE|GOOGLE|GITHUB|GITLAB|OPENAI|CODEX|SSH|GNUPG)_/iu;

const EXECUTION_CONTROL_ENVIRONMENT_NAME =
  /^(?:BASH_ENV|ENV|BASHOPTS|SHELLOPTS|CDPATH|GLOBIGNORE|PROMPT_COMMAND|ZDOTDIR|NODE_OPTIONS|PYTHONPATH|PYTHONSTARTUP|RUBYOPT|PERL5OPT|GIT_DIR|GIT_WORK_TREE|GIT_COMMON_DIR|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES|GIT_EXEC_PATH|GIT_CONFIG|GIT_CONFIG_COUNT|GIT_CONFIG_KEY_[0-9]+|GIT_CONFIG_VALUE_[0-9]+|GIT_CONFIG_GLOBAL|GIT_CONFIG_SYSTEM|GIT_SSH|GIT_SSH_COMMAND|NPM_CONFIG_USERCONFIG|YARN_RC_FILENAME|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.+|BASH_FUNC_.+)$/iu;

export interface ExecuteCommandOptions {
  command: string;
  repositoryRoot: string;
  scopeDirectory: string;
  worktree: TemporaryWorktree;
  timeoutMs: number;
  allowNetwork: boolean;
  runner?: ProcessRunner | undefined;
  environment?: NodeJS.ProcessEnv | undefined;
}

function buildExecutionEnvironment(
  baseEnvironment: NodeJS.ProcessEnv,
  runtimeDirectory: string,
  workingDirectory: string,
  allowNetwork: boolean,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(baseEnvironment)) {
    if (
      !SENSITIVE_ENVIRONMENT_NAME.test(name) &&
      !EXECUTION_CONTROL_ENVIRONMENT_NAME.test(name) &&
      value !== undefined
    ) {
      environment[name] = value;
    }
  }

  environment.HOME = join(runtimeDirectory, "home");
  environment.TMPDIR = join(runtimeDirectory, "tmp");
  environment.XDG_CONFIG_HOME = join(runtimeDirectory, "config");
  environment.XDG_CACHE_HOME = join(runtimeDirectory, "cache");
  environment.PWD = workingDirectory;
  environment.OLDPWD = workingDirectory;
  environment.CI = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GIT_ASKPASS = "/bin/false";
  environment.npm_config_audit = "false";
  environment.npm_config_fund = "false";

  if (!allowNetwork) {
    const disabledProxy = "http://127.0.0.1:9";
    environment.HTTP_PROXY = disabledProxy;
    environment.HTTPS_PROXY = disabledProxy;
    environment.ALL_PROXY = disabledProxy;
    environment.NO_PROXY = "localhost,127.0.0.1,::1";
    environment.http_proxy = disabledProxy;
    environment.https_proxy = disabledProxy;
    environment.all_proxy = disabledProxy;
    environment.no_proxy = "localhost,127.0.0.1,::1";
    environment.npm_config_offline = "true";
    environment.YARN_ENABLE_NETWORK = "false";
  }

  return environment;
}

async function resolveWorktreeScope(
  repositoryRoot: string,
  scopeDirectory: string,
  worktreeDirectory: string,
): Promise<string> {
  const absoluteScope = isAbsolute(scopeDirectory)
    ? resolve(scopeDirectory)
    : resolve(repositoryRoot, scopeDirectory);
  if (!isPathInsideRepository(repositoryRoot, absoluteScope)) {
    throw new Error(`Claim scope is outside the repository: ${absoluteScope}`);
  }

  const relativeScope = relative(repositoryRoot, absoluteScope);
  const worktreeScope = resolve(worktreeDirectory, relativeScope);
  const [canonicalWorktree, canonicalScope] = await Promise.all([
    realpath(worktreeDirectory),
    realpath(worktreeScope),
  ]);
  if (!isPathInsideRepository(canonicalWorktree, canonicalScope)) {
    throw new Error(`Claim scope escapes the temporary worktree: ${canonicalScope}`);
  }
  if (!(await stat(canonicalScope)).isDirectory()) {
    throw new Error(`Claim scope is not a directory in the temporary worktree: ${canonicalScope}`);
  }
  return canonicalScope;
}

async function assertNoExternalSymlinks(
  directory: string,
  canonicalWorktree: string,
): Promise<void> {
  const entries = await opendir(directory);
  for await (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const target = await readlink(entryPath);
      const resolvedTarget = resolve(dirname(entryPath), target);
      if (!isPathInsideRepository(canonicalWorktree, resolvedTarget)) {
        throw new Error(
          `Temporary worktree contains a symlink that escapes the worktree: ${entryPath}`,
        );
      }
    } else if (entry.isDirectory()) {
      await assertNoExternalSymlinks(entryPath, canonicalWorktree);
    }
  }
}

export async function executeCommandInWorktree(
  options: ExecuteCommandOptions,
): Promise<BranchCommandResult> {
  const runner = options.runner ?? runProcess;
  const workingDirectory = await resolveWorktreeScope(
    options.repositoryRoot,
    options.scopeDirectory,
    options.worktree.worktreeDirectory,
  );
  const canonicalWorktree = await realpath(options.worktree.worktreeDirectory);
  await assertNoExternalSymlinks(canonicalWorktree, canonicalWorktree);
  const runtimeDirectory = join(options.worktree.worktreeDirectory, ".agentcontract");
  await Promise.all(
    ["home", "tmp", "config", "cache"].map((name) =>
      mkdir(join(runtimeDirectory, name), { recursive: true }),
    ),
  );

  const result = await runner({
    executable: "/bin/sh",
    args: ["-c", options.command],
    cwd: workingDirectory,
    environment: buildExecutionEnvironment(
      options.environment ?? process.env,
      runtimeDirectory,
      workingDirectory,
      options.allowNetwork,
    ),
    timeoutMs: options.timeoutMs,
    terminateProcessGroup: true,
  });

  const status = result.timedOut
    ? "failed"
    : result.exitCode === 0
      ? "passed"
      : result.exitCode === null
        ? "inconclusive"
        : "failed";
  const timeoutMessage = result.timedOut
    ? `Command timed out after ${options.timeoutMs}ms.`
    : "";

  return {
    command: options.command,
    workingDirectory,
    status,
    exitCode: result.timedOut ? null : result.exitCode,
    stdout: result.stdout,
    stderr:
      timeoutMessage.length === 0
        ? result.stderr
        : [result.stderr.trimEnd(), timeoutMessage].filter(Boolean).join("\n"),
    durationMs: result.durationMs,
  };
}
