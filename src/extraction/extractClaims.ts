import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import type {
  ExtractedClaim,
  RawExtractedClaim,
  ValidatedClaim,
} from "../models/claims.js";
import type { InstructionConflict } from "../models/conflicts.js";
import type { InstructionFile } from "../models/instructions.js";
import { CodexExtractionError, getErrorMessage } from "../utils/errors.js";
import type { CommandExecutionSettings } from "../validation/commandValidator.js";
import {
  analyzeClaimConflicts,
  resolveEffectiveClaimScope,
  type EffectiveClaimScope,
} from "../validation/conflictValidator.js";
import { validateClaim } from "../validation/validateClaim.js";
import {
  extractedClaimSchema,
  rawCodexExtractionResponseSchema,
} from "./claimSchema.js";
import {
  getCodexLocalProviderArgs,
  runCodexProcess,
  type CodexProcessRunner,
} from "./codexClient.js";
import { buildExtractionPrompt } from "./extractionPrompt.js";
import { hasRequiredPathIntent } from "./pathClaimIntent.js";

export const DEFAULT_CODEX_MODEL = "gpt-5.6-terra";
export const DEFAULT_EXTRACTION_TIMEOUT_MS = 120_000;

const DEFAULT_SCHEMA_PATH = fileURLToPath(
  new URL("../../schemas/claims.schema.json", import.meta.url),
);

const EXISTING_VALIDATOR_TYPES = new Set<ExtractedClaim["type"]>([
  "path_exists",
  "package_manager",
  "package_script",
  "dependency_present",
  "command_runs",
]);

export interface ExtractClaimsOptions {
  repositoryRoot: string;
  instructionChain: readonly InstructionFile[];
  model?: string | undefined;
  environment?: Readonly<Record<string, string | undefined>> | undefined;
  timeoutMs?: number | undefined;
  schemaPath?: string | undefined;
  runner?: CodexProcessRunner | undefined;
  commandExecution?: CommandExecutionSettings | undefined;
  targetDirectory?: string | undefined;
}

export interface ExtractAndValidateResult {
  claims: ExtractedClaim[];
  validatedClaims: ValidatedClaim[];
  deferredClaims: ExtractedClaim[];
  conflicts: InstructionConflict[];
  claimScopes: EffectiveClaimScope[];
}

export function resolveCodexModel(
  explicitModel: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  if (explicitModel !== undefined) {
    const model = explicitModel.trim();
    if (model.length === 0) {
      throw new CodexExtractionError("Codex model override cannot be empty.");
    }
    return model;
  }

  // ESCROW_CODEX_MODEL is the public setting. Keep the original variable as a
  // compatibility alias for existing AgentContract-era automation.
  const environmentModel =
  environment.ESCROW_CODEX_MODEL ??
  environment.AGENTCONTRACT_CODEX_MODEL;

if (environmentModel !== undefined) {
  const model = environmentModel.trim();

  if (model.length === 0) {
    throw new CodexExtractionError(
      "ESCROW_CODEX_MODEL cannot be empty.",
    );
  }

  return model;
}

return DEFAULT_CODEX_MODEL;
}

function formatSchemaIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .map((issue) => {
      const path = issue.path.length === 0 ? "output" : issue.path.join(".");
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

interface SourceLine {
  text: string;
  lineEnding: string;
}

function splitSourceLines(content: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const lineEndingPattern = /\r\n|\n/gu;
  let offset = 0;
  for (const match of content.matchAll(lineEndingPattern)) {
    const matchIndex = match.index;
    lines.push({
      text: content.slice(offset, matchIndex),
      lineEnding: match[0],
    });
    offset = matchIndex + match[0].length;
  }
  lines.push({ text: content.slice(offset), lineEnding: "" });
  return lines;
}

function getClaimContext(
  sourceLines: readonly SourceLine[],
  lineStart: number,
  lineEnd: number,
): string {
  let contextStart = lineStart - 1;
  const lowerBound = Math.max(0, contextStart - 12);
  while (contextStart > lowerBound) {
    const previousLine = sourceLines[contextStart - 1];
    if (previousLine === undefined || previousLine.text.trim().length === 0) {
      break;
    }
    contextStart -= 1;
  }
  return sourceLines
    .slice(contextStart, lineEnd)
    .map((line) => line.text)
    .join("\n");
}

function hydrateClaimSources(
  claims: readonly RawExtractedClaim[],
  instructionChain: readonly InstructionFile[],
): ExtractedClaim[] {
  const instructionsByPath = new Map(
    instructionChain.map((instruction) => [instruction.path, instruction]),
  );

  const hydratedClaims = claims.map((claim): ExtractedClaim => {
    const instruction = instructionsByPath.get(claim.sourceFile);
    if (instruction === undefined) {
      throw new CodexExtractionError(
        `Codex returned claim "${claim.id}" for an instruction file that was not supplied: "${claim.sourceFile}".`,
      );
    }
    const sourceLines = splitSourceLines(instruction.content);
    if (claim.lineEnd > sourceLines.length) {
      throw new CodexExtractionError(
        `Codex returned claim "${claim.id}" with lineEnd ${claim.lineEnd}, but "${claim.sourceFile}" has ${sourceLines.length} lines.`,
      );
    }

    const selectedLines = sourceLines.slice(claim.lineStart - 1, claim.lineEnd);
    const originalText = selectedLines
      .map((line, index) =>
        index === selectedLines.length - 1 ? line.text : line.text + line.lineEnding,
      )
      .join("");
    const hydratedClaim = {
      ...claim,
      originalText,
      scopeDirectory: instruction.directory,
    };
    const parsedHydratedClaim = extractedClaimSchema.safeParse(hydratedClaim);
    if (!parsedHydratedClaim.success) {
      throw new CodexExtractionError(
        `Hydrated claim "${claim.id}" failed ExtractedClaim schema validation: ${formatSchemaIssues(parsedHydratedClaim.error.issues)}.`,
      );
    }
    return parsedHydratedClaim.data;
  });

  return hydratedClaims.filter((claim) => {
    if (claim.type !== "path_exists" || claim.referencedPath === undefined) {
      return true;
    }
    const instruction = instructionsByPath.get(claim.sourceFile);
    if (instruction === undefined) {
      return false;
    }
    return hasRequiredPathIntent({
      originalText: claim.originalText,
      contextText: getClaimContext(
        splitSourceLines(instruction.content),
        claim.lineStart,
        claim.lineEnd,
      ),
      referencedPath: claim.referencedPath,
    });
  });
}

export async function extractClaims(
  options: ExtractClaimsOptions,
): Promise<ExtractedClaim[]> {
  if (options.instructionChain.length === 0) {
    return [];
  }

  const model = resolveCodexModel(options.model, options.environment);
  const prompt = buildExtractionPrompt(options.instructionChain);
  const runner = options.runner ?? runCodexProcess;
  let extractionWorkingDirectory: string;
  try {
    extractionWorkingDirectory = await mkdtemp(
      join(tmpdir(), "escrow-extraction-"),
    );
  } catch (error: unknown) {
    throw new CodexExtractionError(
      `Unable to create an isolated Codex extraction directory: ${getErrorMessage(error)}`,
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
      extractionWorkingDirectory,
      "-",
    ],
    cwd: extractionWorkingDirectory,
    stdin: prompt,
    timeoutMs: options.timeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS,
  } as const;

  let result;
  try {
    result = await runner(request);
  } catch (error: unknown) {
    throw new CodexExtractionError(
      `Unable to start Codex claim extraction: ${getErrorMessage(error)}`,
    );
  } finally {
    try {
      await rm(extractionWorkingDirectory, { recursive: true, force: true });
    } catch (error: unknown) {
      throw new CodexExtractionError(
        `Unable to remove the isolated Codex extraction directory: ${getErrorMessage(error)}`,
      );
    }
  }

  if (result.timedOut) {
    throw new CodexExtractionError(
      `Codex claim extraction timed out after ${request.timeoutMs}ms.`,
    );
  }
  if (result.exitCode !== 0) {
    const diagnostic = result.stderr.trim();
    throw new CodexExtractionError(
      diagnostic.length === 0
        ? `Codex claim extraction exited with code ${String(result.exitCode)}.`
        : `Codex claim extraction exited with code ${String(result.exitCode)}: ${diagnostic}`,
    );
  }

  const output = result.stdout.trim();
  if (output.length === 0) {
    throw new CodexExtractionError("Codex claim extraction returned empty output.");
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(output) as unknown;
  } catch (error: unknown) {
    throw new CodexExtractionError(
      `Codex claim extraction returned malformed JSON: ${getErrorMessage(error)}`,
    );
  }

  const parsed = rawCodexExtractionResponseSchema.safeParse(parsedOutput);
  if (!parsed.success) {
    throw new CodexExtractionError(
      `Codex claim extraction failed schema validation: ${formatSchemaIssues(parsed.error.issues)}`,
    );
  }

  return hydrateClaimSources(parsed.data.claims, options.instructionChain);
}

export async function validateExtractedClaims(
  claims: readonly ExtractedClaim[],
  repositoryRoot: string,
  commandExecution?: CommandExecutionSettings,
  targetDirectory?: string,
): Promise<ExtractAndValidateResult> {
  const validatedClaims: ValidatedClaim[] = [];
  const deferredClaims: ExtractedClaim[] = [];
  const claimScopes =
    targetDirectory === undefined
      ? []
      : claims.map((claim) =>
          resolveEffectiveClaimScope(claim, {
            repositoryRoot,
            targetDirectory,
          }),
        );
  const effectiveClaims =
    targetDirectory === undefined
      ? claims
      : claims.filter((_, index) => claimScopes[index]?.applicable === true);

  for (const claim of effectiveClaims) {
    if (EXISTING_VALIDATOR_TYPES.has(claim.type)) {
      validatedClaims.push(
        await validateClaim(claim, { repositoryRoot, commandExecution }),
      );
    } else {
      deferredClaims.push(claim);
    }
  }

  if (targetDirectory === undefined) {
    return {
      claims: [...claims],
      validatedClaims,
      deferredClaims,
      conflicts: [],
      claimScopes,
    };
  }

  const analysis = analyzeClaimConflicts(validatedClaims, {
    repositoryRoot,
    targetDirectory,
  });
  return {
    claims: [...claims],
    validatedClaims: analysis.claims,
    deferredClaims,
    conflicts: analysis.conflicts,
    claimScopes,
  };
}

export async function extractAndValidateClaims(
  options: ExtractClaimsOptions,
): Promise<ExtractAndValidateResult> {
  const claims = await extractClaims(options);
  return validateExtractedClaims(
    claims,
    options.repositoryRoot,
    options.commandExecution,
    options.targetDirectory,
  );
}
