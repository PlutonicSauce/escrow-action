import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import type { ValidatedClaim } from "../models/claims.js";
import type { InstructionFile } from "../models/instructions.js";
import {
  getCodexLocalProviderArgs,
  runCodexProcess,
  type CodexProcessRunner,
} from "../extraction/codexClient.js";
import {
  DEFAULT_EXTRACTION_TIMEOUT_MS,
  resolveCodexModel,
} from "../extraction/extractClaims.js";
import { CodexRepairError, getErrorMessage } from "../utils/errors.js";
import { buildRepairPrompt } from "./repairPrompt.js";

const repairResponseSchema = z
  .object({
    patch: z.string().min(1).max(1_048_576),
  })
  .strict();

const DEFAULT_SCHEMA_PATH = fileURLToPath(
  new URL("../../schemas/repair.schema.json", import.meta.url),
);

export interface GenerateRepairOptions {
  worktreeDirectory: string;
  instructionChain: readonly InstructionFile[];
  failedClaims: readonly ValidatedClaim[];
  allowedFiles: readonly string[];
  model?: string | undefined;
  environment?: Readonly<Record<string, string | undefined>> | undefined;
  timeoutMs?: number | undefined;
  schemaPath?: string | undefined;
  runner?: CodexProcessRunner | undefined;
}

export interface GeneratedRepair {
  patch: string;
  model: string;
}

export async function generateRepair(
  options: GenerateRepairOptions,
): Promise<GeneratedRepair> {
  const model = resolveCodexModel(options.model, options.environment);
  const runner = options.runner ?? runCodexProcess;
  const timeoutMs = options.timeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS;
  const prompt = buildRepairPrompt({
    instructionChain: options.instructionChain,
    failedClaims: options.failedClaims,
    allowedFiles: options.allowedFiles,
  });
  let repairWorkingDirectory: string;
  try {
    repairWorkingDirectory = await mkdtemp(
      join(tmpdir(), "escrow-repair-"),
    );
  } catch (error: unknown) {
    throw new CodexRepairError(
      `Unable to create an isolated Codex repair directory: ${getErrorMessage(error)}`,
    );
  }
  const request = {
    args: [
      "--ask-for-approval",
      "never",
      "--config",
      "project_doc_max_bytes=0",
      "--config",
      'web_search="disabled"',
      "--config",
      "mcp_servers={}",
      "--strict-config",
      "--disable",
      "shell_tool",
      "--disable",
      "shell_snapshot",
      "--disable",
      "hooks",
      "--disable",
      "apps",
      ...getCodexLocalProviderArgs(options.environment),
      "exec",
      "--model",
      model,
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--output-schema",
      options.schemaPath ?? DEFAULT_SCHEMA_PATH,
      "--color",
      "never",
      "--cd",
      repairWorkingDirectory,
      "-",
    ],
    cwd: repairWorkingDirectory,
    stdin: prompt,
    timeoutMs,
  } as const;

  let result;
  try {
    result = await runner(request);
  } catch (error: unknown) {
    throw new CodexRepairError(
      `Unable to start Codex repair generation: ${getErrorMessage(error)}`,
    );
  } finally {
    try {
      await rm(repairWorkingDirectory, { recursive: true, force: true });
    } catch (error: unknown) {
      throw new CodexRepairError(
        `Unable to remove the isolated Codex repair directory: ${getErrorMessage(error)}`,
      );
    }
  }
  if (result.timedOut) {
    throw new CodexRepairError(
      `Codex repair generation timed out after ${String(timeoutMs)}ms.`,
    );
  }
  if (result.exitCode !== 0) {
    const diagnostic = result.stderr.trim();
    throw new CodexRepairError(
      diagnostic.length === 0
        ? `Codex repair generation exited with code ${String(result.exitCode)}.`
        : `Codex repair generation exited with code ${String(result.exitCode)}: ${diagnostic}`,
    );
  }

  const output = result.stdout.trim();
  if (output.length === 0) {
    throw new CodexRepairError("Codex repair generation returned empty output.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output) as unknown;
  } catch (error: unknown) {
    throw new CodexRepairError(
      `Codex repair generation returned malformed JSON: ${getErrorMessage(error)}`,
    );
  }
  const response = repairResponseSchema.safeParse(parsed);
  if (!response.success) {
    throw new CodexRepairError(
      `Codex repair generation failed schema validation: ${response.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }
  if (response.data.patch.trim().length === 0) {
    throw new CodexRepairError("Codex repair generation returned an empty patch.");
  }

  return { patch: response.data.patch, model };
}
