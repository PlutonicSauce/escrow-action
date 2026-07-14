import {
  cleanupTemporaryWorktree,
  type CleanupWorktreeOptions,
} from "../execution/cleanupWorktree.js";
import {
  classifyCommand,
  type CommandPolicyDecision,
} from "../execution/commandPolicy.js";
import {
  createTemporaryWorktree,
  type CreateWorktreeOptions,
  type TemporaryWorktree,
} from "../execution/createWorktree.js";
import {
  executeCommandInWorktree,
  type ExecuteCommandOptions,
} from "../execution/executeCommand.js";
import type {
  BranchCommandResult,
  ExtractedClaim,
  ValidatedClaim,
} from "../models/claims.js";
import { getErrorMessage } from "../utils/errors.js";

export const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;

export interface CommandExecutionSettings {
  enabled: boolean;
  allowNetwork?: boolean | undefined;
  timeoutMs?: number | undefined;
  keepWorktree?: boolean | undefined;
}

export interface CommandValidationDependencies {
  classify?: typeof classifyCommand | undefined;
  createWorktree?:
    | ((repositoryRoot: string, options?: CreateWorktreeOptions) => Promise<TemporaryWorktree>)
    | undefined;
  execute?: ((options: ExecuteCommandOptions) => Promise<BranchCommandResult>) | undefined;
  cleanup?:
    | ((worktree: TemporaryWorktree, options?: CleanupWorktreeOptions) => Promise<void>)
    | undefined;
}

export interface CommandValidationContext {
  repositoryRoot: string;
  commandExecution?: CommandExecutionSettings | undefined;
  commandDependencies?: CommandValidationDependencies | undefined;
}

function emptyCommandResult(
  claim: ExtractedClaim,
  status: BranchCommandResult["status"],
  stderr = "",
): BranchCommandResult {
  return {
    command: claim.command ?? "",
    workingDirectory: claim.scopeDirectory,
    status,
    exitCode: null,
    stdout: "",
    stderr,
    durationMs: 0,
  };
}

function blockedClaim(
  claim: ExtractedClaim,
  decision: CommandPolicyDecision,
): ValidatedClaim {
  const evidence = `Command blocked by safety policy (${decision.category}): ${decision.reason}.`;
  return {
    ...claim,
    status: "blocked",
    evidence: [evidence],
    commandResult: emptyCommandResult(claim, "blocked", evidence),
  };
}

export async function validateCommandClaim(
  claim: ExtractedClaim,
  context: CommandValidationContext,
): Promise<ValidatedClaim> {
  if (claim.type !== "command_runs") {
    throw new TypeError(`Expected command_runs claim, received ${claim.type}.`);
  }

  const command = claim.command?.trim();
  if (command === undefined || command.length === 0) {
    const evidence = "Command claim has no executable command text.";
    return {
      ...claim,
      status: "inconclusive",
      evidence: [evidence],
      commandResult: emptyCommandResult(claim, "inconclusive", evidence),
    };
  }

  const settings = context.commandExecution;
  if (settings?.enabled !== true) {
    const evidence = "Command was not executed because --execute was not supplied.";
    return {
      ...claim,
      status: "inconclusive",
      evidence: [evidence],
      commandResult: emptyCommandResult(claim, "inconclusive", evidence),
    };
  }

  const allowNetwork = settings.allowNetwork === true;
  const dependencies = context.commandDependencies;
  const decision = (dependencies?.classify ?? classifyCommand)(command, {
    allowNetwork,
  });
  if (!decision.allowed) {
    return blockedClaim(claim, decision);
  }

  const timeoutMs = settings.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    const evidence = `Command timeout must be a positive integer number of milliseconds; received ${String(timeoutMs)}.`;
    return {
      ...claim,
      status: "inconclusive",
      evidence: [evidence],
      commandResult: emptyCommandResult(claim, "inconclusive", evidence),
    };
  }

  const createWorktree = dependencies?.createWorktree ?? createTemporaryWorktree;
  const execute = dependencies?.execute ?? executeCommandInWorktree;
  const cleanup = dependencies?.cleanup ?? cleanupTemporaryWorktree;
  let worktree: TemporaryWorktree | undefined;
  let result: BranchCommandResult | undefined;
  let lifecycleError: string | undefined;
  let cleanupError: string | undefined;

  try {
    worktree = await createWorktree(context.repositoryRoot);
    result = await execute({
      command,
      repositoryRoot: context.repositoryRoot,
      scopeDirectory: claim.scopeDirectory,
      worktree,
      timeoutMs,
      allowNetwork,
    });
  } catch (error: unknown) {
    lifecycleError = getErrorMessage(error);
  } finally {
    if (worktree !== undefined && settings.keepWorktree !== true) {
      try {
        await cleanup(worktree);
      } catch (error: unknown) {
        cleanupError = getErrorMessage(error);
      }
    }
  }

  if (lifecycleError !== undefined || cleanupError !== undefined) {
    const evidence = [
      lifecycleError === undefined
        ? undefined
        : `Command could not be executed safely: ${lifecycleError}.`,
      cleanupError === undefined
        ? undefined
        : `Temporary worktree cleanup failed: ${cleanupError}.`,
      worktree !== undefined && settings.keepWorktree === true
        ? `Temporary worktree retained at "${worktree.worktreeDirectory}".`
        : undefined,
    ].filter((item): item is string => item !== undefined);
    return {
      ...claim,
      status: "inconclusive",
      evidence,
      commandResult:
        result ?? emptyCommandResult(claim, "inconclusive", evidence.join(" ")),
    };
  }

  if (result === undefined || worktree === undefined) {
    const evidence = "Command execution ended without a deterministic result.";
    return {
      ...claim,
      status: "inconclusive",
      evidence: [evidence],
      commandResult: emptyCommandResult(claim, "inconclusive", evidence),
    };
  }

  const evidence = [
    result.status === "passed"
      ? "Command exited with code 0 in an isolated Git worktree."
      : result.status === "failed" && result.exitCode !== null
        ? `Command exited with code ${result.exitCode} in an isolated Git worktree.`
        : result.status === "failed"
          ? `Command timed out after ${timeoutMs}ms in an isolated Git worktree.`
          : "Command execution did not produce an exit code.",
    settings.keepWorktree === true
      ? `Temporary worktree retained at "${worktree.worktreeDirectory}".`
      : "Temporary worktree removed after command execution.",
    allowNetwork
      ? "Network access was explicitly allowed."
      : "Network-capable commands were blocked and common package/network clients were configured offline.",
  ];

  return {
    ...claim,
    status: result.status,
    evidence,
    commandResult: result,
  };
}
