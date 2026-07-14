import { relative, sep } from "node:path";

import {
  createRepositoryReport,
  type CheckCommandOptions,
  type RepositoryEvaluationDependencies,
} from "./check.js";
import {
  cleanupTemporaryWorktree,
  type CleanupWorktreeOptions,
} from "../execution/cleanupWorktree.js";
import {
  createTemporaryWorktree,
  type CreateWorktreeOptions,
  type TemporaryWorktree,
} from "../execution/createWorktree.js";
import type { ProcessRunner } from "../execution/processRunner.js";
import type { CodexProcessRunner } from "../extraction/codexClient.js";
import type { AgentContractReport } from "../models/reports.js";
import { renderConsoleReport } from "../reporting/consoleReporter.js";
import { generateRepair } from "../repair/generateRepair.js";
import {
  applyVerifiedPatch,
  assertRepositoryClean,
  verifyRepair,
  type RepositoryEvaluator,
} from "../repair/verifyRepair.js";
import { RepairRejectedError, getErrorMessage } from "../utils/errors.js";

export interface FixCommandOptions extends CheckCommandOptions {
  apply?: boolean | undefined;
}

export interface RepairCommandResult {
  beforeReport: AgentContractReport;
  afterReport?: AgentContractReport | undefined;
  patch?: string | undefined;
  changedFiles: string[];
  applied: boolean;
}

export interface FixCommandDependencies {
  generatedAt: () => string;
  writeConsole: (output: string) => void;
  repairRunner?: CodexProcessRunner | undefined;
  extractionRunner?: CodexProcessRunner | undefined;
  processRunner?: ProcessRunner | undefined;
  createWorktree?:
    | ((repositoryRoot: string, options?: CreateWorktreeOptions) => Promise<TemporaryWorktree>)
    | undefined;
  cleanupWorktree?:
    | ((worktree: TemporaryWorktree, options?: CleanupWorktreeOptions) => Promise<void>)
    | undefined;
  evaluate?: RepositoryEvaluator | undefined;
}

const defaultDependencies: FixCommandDependencies = {
  generatedAt: () => new Date().toISOString(),
  writeConsole: (output) => {
    process.stdout.write(output);
  },
};

export type FixCommandHandler = (
  repository: string,
  options: FixCommandOptions,
) => Promise<RepairCommandResult> | void;

function toGitPath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

function renderRepairResult(result: RepairCommandResult): string {
  const lines = ["=== Before repair ===", renderConsoleReport(result.beforeReport).trimEnd()];
  if (result.afterReport === undefined || result.patch === undefined) {
    lines.push("", "No failed claims require repair.");
    return `${lines.join("\n")}\n`;
  }

  lines.push(
    "",
    "=== Verified instruction diff ===",
    result.patch.trimEnd(),
    "",
    "=== After repair ===",
    renderConsoleReport(result.afterReport).trimEnd(),
    "",
    result.applied
      ? "Verified instruction repair applied to the active repository."
      : "Preview only: the active repository was not modified.",
  );
  return `${lines.join("\n")}\n`;
}

export async function fixRepository(
  repository: string,
  options: FixCommandOptions,
  dependencies: FixCommandDependencies = defaultDependencies,
): Promise<RepairCommandResult> {
  const evaluationDependencies: RepositoryEvaluationDependencies = {
    generatedAt: dependencies.generatedAt,
    codexRunner: dependencies.extractionRunner,
  };
  const evaluate: RepositoryEvaluator =
    dependencies.evaluate ??
    (async (path, checkOptions) =>
      createRepositoryReport(path, checkOptions, evaluationDependencies));
  const beforeReport = await evaluate(repository, options);
  const failedClaims = beforeReport.claims.filter(
    (claim) => claim.status === "failed",
  );
  if (failedClaims.length === 0) {
    const result = {
      beforeReport,
      changedFiles: [],
      applied: false,
    } satisfies RepairCommandResult;
    dependencies.writeConsole(renderRepairResult(result));
    return result;
  }
  if (beforeReport.instructionChain.length === 0) {
    throw new RepairRejectedError(
      "Failed claims exist but no effective instruction files are available for repair.",
    );
  }

  const createWorktree = dependencies.createWorktree ?? createTemporaryWorktree;
  const cleanupWorktree =
    dependencies.cleanupWorktree ?? cleanupTemporaryWorktree;
  const allowedFiles = beforeReport.instructionChain.map((instruction) =>
    toGitPath(relative(beforeReport.repositoryRoot, instruction.path)),
  );
  const targetRelativePath =
    toGitPath(relative(beforeReport.repositoryRoot, beforeReport.targetDirectory)) || ".";
  let worktree: TemporaryWorktree | undefined;
  let result: RepairCommandResult | undefined;
  let primaryError: unknown;
  try {
    worktree = await createWorktree(beforeReport.repositoryRoot);
    await assertRepositoryClean(
      beforeReport.repositoryRoot,
      worktree.containerDirectory,
      dependencies.processRunner,
    );
    const generated = await generateRepair({
      worktreeDirectory: worktree.worktreeDirectory,
      instructionChain: beforeReport.instructionChain,
      failedClaims,
      allowedFiles,
      model: options.model,
      runner: dependencies.repairRunner,
    });
    const verified = await verifyRepair({
      worktree,
      patch: generated.patch,
      allowedFiles,
      beforeReport,
      targetRelativePath,
      checkOptions: options,
      evaluate,
      runner: dependencies.processRunner,
    });

    if (options.apply === true) {
      await applyVerifiedPatch(
        beforeReport.repositoryRoot,
        worktree.containerDirectory,
        generated.patch,
        dependencies.processRunner,
      );
    }
    result = {
      beforeReport,
      afterReport: verified.afterReport,
      patch: verified.diff,
      changedFiles: verified.changedFiles,
      applied: options.apply === true,
    };
  } catch (error: unknown) {
    primaryError = error;
  }

  let cleanupError: unknown;
  if (worktree !== undefined) {
    try {
      await cleanupWorktree(worktree);
    } catch (error: unknown) {
      cleanupError = error;
    }
  }
  if (primaryError !== undefined) {
    if (cleanupError !== undefined) {
      throw new Error(
        `${getErrorMessage(primaryError)} Cleanup also failed: ${getErrorMessage(cleanupError)}`,
      );
    }
    throw primaryError;
  }
  if (cleanupError !== undefined) {
    throw cleanupError;
  }
  if (result === undefined) {
    throw new Error("Repair lifecycle ended without a result.");
  }

  dependencies.writeConsole(renderRepairResult(result));
  return result;
}
