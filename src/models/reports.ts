import type { ClaimStatus, ValidatedClaim } from "./claims.js";
import type { InstructionConflict } from "./conflicts.js";
import type { InstructionFile } from "./instructions.js";

export const OVERALL_STATUSES = ["pass", "fail", "pass_with_warnings"] as const;

export type OverallStatus = (typeof OVERALL_STATUSES)[number];

export interface ReportSummary {
  passed: number;
  failed: number;
  warnings: number;
  blocked: number;
  inconclusive: number;
  advisory: number;
  overridden: number;
}

export interface AgentContractReport {
  version: string;
  generatedAt: string;
  repositoryRoot: string;
  targetDirectory: string;
  instructionChain: InstructionFile[];
  claims: ValidatedClaim[];
  conflicts: InstructionConflict[];
  summary: ReportSummary;
  overallStatus: OverallStatus;
}

export interface CreateAgentContractReportInput {
  version: string;
  generatedAt: string;
  repositoryRoot: string;
  targetDirectory: string;
  instructionChain: InstructionFile[];
  claims: ValidatedClaim[];
  conflicts?: InstructionConflict[] | undefined;
}

const STATUS_SUMMARY_KEYS: Record<ClaimStatus, keyof ReportSummary> = {
  passed: "passed",
  failed: "failed",
  warning: "warnings",
  blocked: "blocked",
  inconclusive: "inconclusive",
  advisory: "advisory",
  overridden: "overridden",
};

export function getEffectiveClaimStatus(claim: ValidatedClaim): ClaimStatus {
  if (
    claim.type === "advisory" &&
    (claim.status === "passed" || claim.status === "failed")
  ) {
    return "advisory";
  }

  return claim.status;
}

export function aggregateClaimStatuses(claims: readonly ValidatedClaim[]): ReportSummary {
  const summary: ReportSummary = {
    passed: 0,
    failed: 0,
    warnings: 0,
    blocked: 0,
    inconclusive: 0,
    advisory: 0,
    overridden: 0,
  };

  for (const claim of claims) {
    const summaryKey = STATUS_SUMMARY_KEYS[getEffectiveClaimStatus(claim)];
    summary[summaryKey] += 1;
  }

  return summary;
}

export function calculateOverallStatus(summary: ReportSummary): OverallStatus {
  if (summary.failed > 0) {
    return "fail";
  }

  if (summary.warnings > 0 || summary.blocked > 0 || summary.inconclusive > 0) {
    return "pass_with_warnings";
  }

  return "pass";
}

function applyInstructionConflicts(
  claims: readonly ValidatedClaim[],
  conflicts: readonly InstructionConflict[],
): ValidatedClaim[] {
  const sourceKey = (source: {
    claimId: string;
    claimType: string;
    sourceFile: string;
    lineStart: number;
    lineEnd: number;
    normalizedValue: string;
  }): string =>
    JSON.stringify([
      source.claimId,
      source.claimType,
      source.sourceFile,
      source.lineStart,
      source.lineEnd,
      source.normalizedValue,
    ]);
  const messagesByClaimSource = new Map<string, string[]>();

  for (const conflict of conflicts) {
    for (const source of conflict.claims) {
      const matchingClaim = claims.find(
        (claim) =>
          claim.id === source.claimId &&
          claim.type === source.claimType &&
          claim.sourceFile === source.sourceFile &&
          claim.lineStart === source.lineStart &&
          claim.lineEnd === source.lineEnd &&
          claim.normalizedValue === source.normalizedValue,
      );
      if (matchingClaim === undefined) {
        throw new TypeError(
          `Conflict "${conflict.id}" references claim "${source.claimId}" with source data that is absent from the report.`,
        );
      }
      const key = sourceKey(source);
      const messages = messagesByClaimSource.get(key) ?? [];
      if (!messages.includes(conflict.message)) {
        messages.push(conflict.message);
      }
      messagesByClaimSource.set(key, messages);
    }
  }

  return claims.map((claim) => {
    const conflictMessages = messagesByClaimSource.get(
      sourceKey({
        claimId: claim.id,
        claimType: claim.type,
        sourceFile: claim.sourceFile,
        lineStart: claim.lineStart,
        lineEnd: claim.lineEnd,
        normalizedValue: claim.normalizedValue,
      }),
    );
    if (conflictMessages === undefined) {
      return claim;
    }
    return {
      ...claim,
      status: "failed",
      evidence: [
        ...claim.evidence,
        ...conflictMessages.filter((message) => !claim.evidence.includes(message)),
      ],
    };
  });
}

export function createAgentContractReport(
  input: CreateAgentContractReportInput,
): AgentContractReport {
  const conflicts = input.conflicts === undefined ? [] : [...input.conflicts];
  const normalizedClaims = input.claims.map((claim): ValidatedClaim => {
    const effectiveStatus = getEffectiveClaimStatus(claim);
    return effectiveStatus === claim.status
      ? claim
      : { ...claim, status: effectiveStatus };
  });
  const claims = applyInstructionConflicts(normalizedClaims, conflicts);
  const summary = aggregateClaimStatuses(claims);

  return {
    version: input.version,
    generatedAt: input.generatedAt,
    repositoryRoot: input.repositoryRoot,
    targetDirectory: input.targetDirectory,
    instructionChain: input.instructionChain,
    claims,
    conflicts,
    summary,
    overallStatus: calculateOverallStatus(summary),
  };
}
