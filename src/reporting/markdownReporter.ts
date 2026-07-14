import type { BranchCommandResult, ValidatedClaim } from "../models/claims.js";
import type { InstructionConflict } from "../models/conflicts.js";
import type { AgentContractReport } from "../models/reports.js";
import {
  CLAIM_STATUS_LABELS,
  OVERALL_STATUS_LABELS,
  SUMMARY_FIELDS,
  formatSourceLocation,
  formatTypeLabel,
} from "./reportFormatting.js";

function escapeMarkdownText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/([\\`*_[\]{}()#+.!|~-])/gu, "\\$1")
    .replaceAll("\r\n", "\n")
    .replace(/[\r\n]+/gu, " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineCode(value: string): string {
  const normalized = value.replaceAll("\r\n", "\n").replace(/[\r\n]+/gu, " ");
  const longestRun = Math.max(
    0,
    ...(normalized.match(/`+/gu) ?? []).map((run) => run.length),
  );
  const delimiter = "`".repeat(Math.max(1, longestRun + 1));
  const padding =
    normalized.startsWith("`") || normalized.endsWith("`") ? " " : "";
  return `${delimiter}${padding}${normalized}${padding}${delimiter}`;
}

function fencedCode(value: string, language = "text"): string {
  const normalized = value.replaceAll("\r\n", "\n");
  const longestRun = Math.max(
    0,
    ...(normalized.match(/`+/gu) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${normalized}\n${fence}`;
}

function renderCommandResult(command: BranchCommandResult): string[] {
  const lines = [
    "<details>",
    "<summary>Command output</summary>",
    "<ul>",
    `<li>Command: <code>${escapeHtml(command.command)}</code></li>`,
    `<li>Working directory: <code>${escapeHtml(command.workingDirectory)}</code></li>`,
    `<li>Status: <strong>${escapeHtml(command.status.toUpperCase())}</strong></li>`,
    `<li>Exit code: ${command.exitCode === null ? "none" : `<code>${escapeHtml(String(command.exitCode))}</code>`}</li>`,
    `<li>Duration: <code>${escapeHtml(String(command.durationMs))}ms</code></li>`,
    "</ul>",
    "<strong>stdout</strong>",
    `<pre><code>${escapeHtml(command.stdout)}</code></pre>`,
    "<strong>stderr</strong>",
    `<pre><code>${escapeHtml(command.stderr)}</code></pre>`,
    "</details>",
  ];
  return lines;
}

function renderClaim(claim: ValidatedClaim): string[] {
  const lines = [
    `### ${CLAIM_STATUS_LABELS[claim.status]} · ${formatTypeLabel(claim.type)}`,
    "",
    `- Source: ${inlineCode(formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd))}`,
    `- Scope: ${inlineCode(claim.scopeDirectory)}`,
    "",
    "**Original instruction**",
    "",
    fencedCode(claim.originalText, "markdown"),
    "",
    "**Normalized claim**",
    "",
    fencedCode(claim.normalizedValue),
    "",
    "**Deterministic evidence**",
    "",
  ];

  if (claim.evidence.length === 0) {
    lines.push("- None.");
  } else {
    for (const evidence of claim.evidence) {
      lines.push(`- ${escapeMarkdownText(evidence)}`);
    }
  }

  for (const inconsistency of claim.repositoryInconsistencies ?? []) {
    lines.push("");
    lines.push(`**Repository inconsistency:** ${escapeMarkdownText(inconsistency.message)}`);
    for (const evidence of inconsistency.evidence) {
      lines.push(`- ${escapeMarkdownText(evidence)}`);
    }
  }

  if (claim.suggestion !== undefined) {
    lines.push("");
    lines.push(`**Suggestion:** ${escapeMarkdownText(claim.suggestion)}`);
  }

  if (claim.commandResult !== undefined) {
    lines.push("");
    lines.push(...renderCommandResult(claim.commandResult));
  }

  return lines;
}

function renderConflict(conflict: InstructionConflict): string[] {
  const lines = [
    `### ${escapeMarkdownText(formatTypeLabel(conflict.type))}`,
    "",
    `- Effective scope: ${inlineCode(conflict.effectiveScopeDirectory)}`,
    `- Conflict: ${escapeMarkdownText(conflict.message)}`,
    "- Sources:",
  ];
  for (const claim of conflict.claims) {
    lines.push(
      `  - ${inlineCode(formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd))}: ${inlineCode(claim.normalizedValue)}`,
    );
  }
  return lines;
}

export function renderMarkdownReport(report: AgentContractReport): string {
  const lines = [
    "# AgentContract Report",
    "",
    `**Overall status: ${OVERALL_STATUS_LABELS[report.overallStatus]}**`,
    "",
    `- Repository: ${inlineCode(report.repositoryRoot)}`,
    `- Target directory: ${inlineCode(report.targetDirectory)}`,
    `- Generated: ${inlineCode(report.generatedAt)}`,
    `- Report version: ${inlineCode(report.version)}`,
    "",
    "## Summary",
    "",
    "| Result | Total |",
    "| --- | ---: |",
    ...SUMMARY_FIELDS.map(
      ({ key, label }) => `| ${label} | ${String(report.summary[key])} |`,
    ),
    "",
    "## Instruction chain",
    "",
  ];

  if (report.instructionChain.length === 0) {
    lines.push("No instruction files were discovered.");
  } else {
    for (const [index, instruction] of report.instructionChain.entries()) {
      lines.push(
        `${String(index + 1)}. ${inlineCode(instruction.path)} — ${inlineCode(instruction.fileName)} in ${inlineCode(instruction.directory)}`,
      );
    }
  }

  lines.push("", "## Claims", "");
  if (report.claims.length === 0) {
    lines.push("No claims were extracted.");
  } else {
    for (const claim of report.claims) {
      lines.push(...renderClaim(claim), "");
    }
  }

  lines.push("## Overrides", "");
  const overrides = report.claims.filter((claim) => claim.status === "overridden");
  if (overrides.length === 0) {
    lines.push("No claims were overridden.");
  } else {
    for (const claim of overrides) {
      lines.push(
        `- ${inlineCode(formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd))}: ${inlineCode(claim.normalizedValue)}`,
      );
    }
  }

  lines.push("", "## Conflicts", "");
  if (report.conflicts.length === 0) {
    lines.push("No instruction conflicts were detected.");
  } else {
    for (const conflict of report.conflicts) {
      lines.push(...renderConflict(conflict), "");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
