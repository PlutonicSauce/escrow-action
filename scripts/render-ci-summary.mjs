#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const [reportPath, outputPath, exitCodeValue] = process.argv.slice(2);
if (reportPath === undefined || outputPath === undefined || exitCodeValue === undefined) {
  throw new Error("Usage: render-ci-summary.mjs <report.json> <summary.md> <exit-code>");
}
const exitCode = Number(exitCodeValue);

function escapeMarkdown(value) {
  return value.replaceAll("\\", "\\\\").replace(/([`*_{}\[\]<>#])/gu, "\\$1").replace(/[\r\n]+/gu, " ").trim();
}

function location(claim, repositoryRoot) {
  const source = relative(repositoryRoot, claim.sourceFile).split("\\").join("/");
  const suffix = claim.lineStart === claim.lineEnd ? String(claim.lineStart) : `${claim.lineStart}-${claim.lineEnd}`;
  return `${source}:${suffix}`;
}

function claimKey(claim) {
  return [claim.id, claim.type, claim.sourceFile, claim.lineStart, claim.lineEnd, claim.normalizedValue].join("\u0000");
}

function detail(claim) {
  // Validators append their final, decisive finding after scope-selection
  // details. Lead the CI summary with that conclusion and the instruction a
  // reviewer actually needs to update.
  const evidence = claim.evidence ?? [];
  const message = escapeMarkdown(evidence[evidence.length - 1] ?? "Deterministic validation did not match the repository.");
  const instruction = escapeMarkdown(claim.originalText ?? "");
  const combined = instruction.length > 0 ? `“${instruction}” — ${message}` : message;
  return combined.length > 260 ? `${combined.slice(0, 257)}...` : combined;
}

function render(report) {
  const extractionCoverage = report.claims.find((claim) => claim.id === "escrow-extraction-coverage");
  const conflicting = new Set((report.conflicts ?? []).flatMap((conflict) => conflict.claims.map(claimKey)));
  const stale = report.claims.filter((claim) => claim.status === "failed" && !conflicting.has(claimKey(claim)));
  const blocked = report.claims.filter((claim) => claim.status === "blocked");
  const inconclusive = report.claims.filter((claim) => claim.status === "inconclusive");
  const warnings = report.claims.filter((claim) => claim.status === "warning");
  const lines = ["<!-- escrow-ci-summary -->", "## Escrow — instruction integrity", ""];
  const categories = [
    stale.length > 0 ? `${stale.length} stale` : undefined,
    conflicting.size > 0 ? `${conflicting.size} conflicting` : undefined,
    blocked.length > 0 ? `${blocked.length} unsafe` : undefined,
    inconclusive.length > 0 ? `${inconclusive.length} unverifiable` : undefined,
  ].filter(Boolean);
  lines.push(
    extractionCoverage !== undefined
      ? "**Escrow could not complete claim extraction. No repository instructions were verified.**"
      : categories.length === 0 ? "**Escrow verified the repository instructions.**" : `**Escrow found ${categories.join(", ")} instruction issue${categories.length === 1 && categories[0].startsWith("1 ") ? "" : "s"}.**`,
    "",
  );
  if (extractionCoverage !== undefined) lines.push(`- ? Model extraction incomplete — ${detail(extractionCoverage)}`);
  for (const claim of stale) lines.push(`- ✗ \`${location(claim, report.repositoryRoot)}\` — ${detail(claim)}`);
  for (const conflict of report.conflicts ?? []) lines.push(`- ! Conflicting instructions — ${escapeMarkdown(conflict.message)}`);
  for (const claim of blocked) lines.push(`- ! Unsafe instruction blocked at \`${location(claim, report.repositoryRoot)}\` — ${detail(claim)}`);
  for (const claim of inconclusive) lines.push(`- ? Unverifiable instruction at \`${location(claim, report.repositoryRoot)}\` — ${detail(claim)}`);
  if (warnings.length > 0) lines.push(`- ! ${warnings.length} warning${warnings.length === 1 ? "" : "s"} retained for review.`);
  lines.push("", "### Verified", "", `- ✓ ${report.summary.passed} instruction${report.summary.passed === 1 ? "" : "s"} verified`, `- ✓ Nested instruction scope resolution completed across ${report.instructionChain.length} file${report.instructionChain.length === 1 ? "" : "s"}`, report.summary.blocked === 0 ? "- ✓ No unsafe commands executed" : "- ! Unsafe commands were blocked before execution", "", "Full JSON, Markdown, and self-contained HTML reports are attached to this workflow run.");
  return `${lines.join("\n")}\n`;
}

let summary;
try {
  summary = render(JSON.parse(await readFile(reportPath, "utf8")));
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  summary = `<!-- escrow-ci-summary -->\n## Escrow — instruction integrity\n\n**Escrow could not produce a report (exit code ${exitCode}).**\n\n- ! ${escapeMarkdown(reason)}\n\nCheck the Escrow/Codex workflow logs and confirm that \`OPENAI_API_KEY\` is configured.\n`;
}
await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, summary, "utf8");
if (process.env.GITHUB_STEP_SUMMARY !== undefined) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { encoding: "utf8", flag: "a" });
