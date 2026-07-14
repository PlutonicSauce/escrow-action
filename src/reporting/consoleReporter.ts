import type { AgentContractReport } from "../models/reports.js";
import {
  CLAIM_STATUS_LABELS,
  OVERALL_STATUS_LABELS,
  formatSourceLocation,
  formatTypeLabel,
} from "./reportFormatting.js";

export function renderConsoleReport(report: AgentContractReport): string {
  const lines = [
    `Escrow: ${OVERALL_STATUS_LABELS[report.overallStatus]}`,
    `Repository: ${report.repositoryRoot}`,
    `Target: ${report.targetDirectory}`,
    `Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warnings} warnings, ${report.summary.blocked} blocked, ${report.summary.inconclusive} inconclusive, ${report.summary.advisory} advisory, ${report.summary.overridden} overridden`,
    "Instruction chain:",
  ];

  if (report.instructionChain.length === 0) {
    lines.push("  None");
  } else {
    for (const instruction of report.instructionChain) {
      lines.push(`  ${instruction.path} (${instruction.fileName})`);
    }
  }

  for (const claim of report.claims) {
    lines.push("");
    lines.push(
      `[${CLAIM_STATUS_LABELS[claim.status]}] ${claim.type} ${formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd)}`,
    );
    lines.push(`  ${claim.originalText}`);
    lines.push(`  Normalized: ${claim.normalizedValue}`);

    for (const evidence of claim.evidence) {
      lines.push(`  Evidence: ${evidence}`);
    }

    for (const inconsistency of claim.repositoryInconsistencies ?? []) {
      lines.push(`  Repository inconsistency: ${inconsistency.message}`);
      for (const evidence of inconsistency.evidence) {
        lines.push(`    Evidence: ${evidence}`);
      }
    }

    if (claim.suggestion !== undefined) {
      lines.push(`  Suggestion: ${claim.suggestion}`);
    }

    if (claim.commandResult !== undefined) {
      lines.push(`  Command: ${claim.commandResult.command}`);
      lines.push(`  Working directory: ${claim.commandResult.workingDirectory}`);
      lines.push(`  Command status: ${claim.commandResult.status.toUpperCase()}`);
      lines.push(
        `  Exit code: ${claim.commandResult.exitCode === null ? "none" : String(claim.commandResult.exitCode)}`,
      );
      lines.push(`  Duration: ${claim.commandResult.durationMs}ms`);
      if (claim.commandResult.stdout.length > 0) {
        lines.push(`  Stdout:\n${claim.commandResult.stdout}`);
      }
      if (claim.commandResult.stderr.length > 0) {
        lines.push(`  Stderr:\n${claim.commandResult.stderr}`);
      }
    }
  }

  for (const conflict of report.conflicts) {
    lines.push("");
    lines.push(
      `[CONFLICT] ${formatTypeLabel(conflict.type)} in ${conflict.effectiveScopeDirectory}`,
    );
    lines.push(`  ${conflict.message}`);
    for (const claim of conflict.claims) {
      lines.push(
        `  Source: ${formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd)} (${claim.normalizedValue})`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}
