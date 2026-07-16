import { writeFile } from "node:fs/promises";

import { discoverInstructions } from "../discovery/discoverInstructions.js";
import { extractAndValidateClaims } from "../extraction/extractClaims.js";
import type { CodexProcessRunner } from "../extraction/codexClient.js";
import type { ValidatedClaim } from "../models/claims.js";
import {
  createAgentContractReport,
  type AgentContractReport,
} from "../models/reports.js";
import { renderConsoleReport } from "../reporting/consoleReporter.js";
import { renderHtmlReport } from "../reporting/htmlReporter.js";
import { renderJsonReport } from "../reporting/jsonReporter.js";
import { renderMarkdownReport } from "../reporting/markdownReporter.js";
import { CheckFailedError } from "../utils/errors.js";
import { AGENTCONTRACT_VERSION } from "../version.js";

export interface CheckCommandOptions {
  target?: string;
  model?: string;
  execute?: boolean;
  allowNetwork?: boolean;
  timeout?: number;
  keepWorktree?: boolean;
  json?: string;
  markdown?: string;
  html?: string;
}

export interface CheckCommandDependencies {
  generatedAt: () => string;
  writeConsole: (output: string) => void;
  writeFile: (path: string, content: string) => Promise<void>;
  codexRunner?: CodexProcessRunner | undefined;
}

const defaultDependencies: CheckCommandDependencies = {
  generatedAt: () => new Date().toISOString(),
  writeConsole: (output) => {
    process.stdout.write(output);
  },
  writeFile: async (path, content) => {
    await writeFile(path, content, "utf8");
  },
};

export type CheckCommandHandler = (
  repository: string,
  options: CheckCommandOptions,
) => Promise<void> | void;

function advisoryResult(claim: ExtractAndValidateResult["deferredClaims"][number]): ValidatedClaim {
  if (claim.type !== "advisory") {
    throw new TypeError(`Unexpected deferred claim type: ${claim.type}`);
  }
  return {
    ...claim,
    status: "advisory",
    evidence: ["Advisory instruction is not subject to deterministic validation."],
  };
}

function extractionCoverageDiagnostic(
  instructionChain: Awaited<ReturnType<typeof discoverInstructions>>["instructionChain"],
  extractedClaimCount: number,
): ValidatedClaim | undefined {
  if (instructionChain.length === 0 || extractedClaimCount > 0) {
    return undefined;
  }

  const instruction = instructionChain.find(
    (candidate) => candidate.content.trim().length > 0,
  );
  if (instruction === undefined) {
    return undefined;
  }
  const sourceLines = instruction.content.split(/\r?\n/u);
  const lineIndex = Math.max(0, sourceLines.findIndex((line) => line.trim().length > 0));
  const originalText = sourceLines[lineIndex] ?? "";

  return {
    id: "escrow-extraction-coverage",
    type: "advisory",
    sourceFile: instruction.path,
    lineStart: lineIndex + 1,
    lineEnd: lineIndex + 1,
    originalText,
    normalizedValue: "claim extraction coverage",
    scopeDirectory: instruction.directory,
    confidence: 1,
    extractionReason: "Escrow generated this diagnostic because the selected model returned no supported claims.",
    status: "inconclusive",
    evidence: [
      "No supported, source-grounded claims were extracted from non-empty repository instructions. Escrow did not verify those instructions.",
    ],
    suggestion: "Use a more capable extraction model or simplify the instruction language, then run Escrow again.",
  };
}

type ExtractAndValidateResult = Awaited<
  ReturnType<typeof extractAndValidateClaims>
>;

export interface RepositoryEvaluationDependencies {
  generatedAt: () => string;
  codexRunner?: CodexProcessRunner | undefined;
}

export async function createRepositoryReport(
  repository: string,
  options: CheckCommandOptions,
  dependencies: RepositoryEvaluationDependencies = {
    generatedAt: () => new Date().toISOString(),
  },
): Promise<AgentContractReport> {
  const discovery = await discoverInstructions(
    options.target === undefined
      ? { repository }
      : { repository, target: options.target },
  );

  const validation = await extractAndValidateClaims({
    repositoryRoot: discovery.repositoryRoot,
    targetDirectory: discovery.targetDirectory,
    instructionChain: discovery.instructionChain,
    model: options.model,
    runner: dependencies.codexRunner,
    commandExecution: {
      enabled: options.execute === true,
      allowNetwork: options.allowNetwork === true,
      timeoutMs:
        options.timeout === undefined ? undefined : Math.round(options.timeout * 1_000),
      keepWorktree: options.keepWorktree === true,
    },
  });

  const claims = [
    ...validation.validatedClaims,
    ...validation.deferredClaims.map(advisoryResult),
  ];
  const coverageDiagnostic = extractionCoverageDiagnostic(
    discovery.instructionChain,
    claims.length,
  );
  if (coverageDiagnostic !== undefined) {
    claims.push(coverageDiagnostic);
  }

  return createAgentContractReport({
    version: AGENTCONTRACT_VERSION,
    generatedAt: dependencies.generatedAt(),
    repositoryRoot: discovery.repositoryRoot,
    targetDirectory: discovery.targetDirectory,
    instructionChain: discovery.instructionChain,
    claims,
    conflicts: validation.conflicts,
  });
}

export async function checkRepository(
  repository: string,
  options: CheckCommandOptions,
  dependencies: CheckCommandDependencies = defaultDependencies,
): Promise<void> {
  const report = await createRepositoryReport(repository, options, {
    generatedAt: dependencies.generatedAt,
    codexRunner: dependencies.codexRunner,
  });

  dependencies.writeConsole(renderConsoleReport(report));
  const writes: Promise<void>[] = [];
  if (options.json !== undefined) {
    writes.push(dependencies.writeFile(options.json, renderJsonReport(report)));
  }
  if (options.markdown !== undefined) {
    writes.push(
      dependencies.writeFile(options.markdown, renderMarkdownReport(report)),
    );
  }
  if (options.html !== undefined) {
    writes.push(dependencies.writeFile(options.html, renderHtmlReport(report)));
  }
  await Promise.all(writes);
  if (report.overallStatus === "fail") {
    throw new CheckFailedError();
  }
}
