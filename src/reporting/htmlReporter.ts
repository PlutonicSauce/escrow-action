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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCommandResult(command: BranchCommandResult): string {
  return `<details class="command-output">
<summary>Command output</summary>
<dl>
<dt>Command</dt><dd><code>${escapeHtml(command.command)}</code></dd>
<dt>Working directory</dt><dd><code>${escapeHtml(command.workingDirectory)}</code></dd>
<dt>Status</dt><dd>${escapeHtml(command.status.toUpperCase())}</dd>
<dt>Exit code</dt><dd>${command.exitCode === null ? "none" : escapeHtml(String(command.exitCode))}</dd>
<dt>Duration</dt><dd>${escapeHtml(String(command.durationMs))}ms</dd>
</dl>
<h4>stdout</h4>
<pre><code>${escapeHtml(command.stdout)}</code></pre>
<h4>stderr</h4>
<pre><code>${escapeHtml(command.stderr)}</code></pre>
</details>`;
}

function renderEvidence(claim: ValidatedClaim): string {
  if (claim.evidence.length === 0) {
    return "<p>None.</p>";
  }
  return `<ul>${claim.evidence
    .map((evidence) => `<li>${escapeHtml(evidence)}</li>`)
    .join("")}</ul>`;
}

function renderClaim(claim: ValidatedClaim): string {
  const inconsistencies = (claim.repositoryInconsistencies ?? [])
    .map(
      (item) => `<aside class="inconsistency">
<strong>Repository inconsistency:</strong> ${escapeHtml(item.message)}
<ul>${item.evidence.map((evidence) => `<li>${escapeHtml(evidence)}</li>`).join("")}</ul>
</aside>`,
    )
    .join("");
  const suggestion =
    claim.suggestion === undefined
      ? ""
      : `<p class="suggestion"><strong>Suggestion:</strong> ${escapeHtml(claim.suggestion)}</p>`;
  const command =
    claim.commandResult === undefined ? "" : renderCommandResult(claim.commandResult);

  return `<article class="claim status-${claim.status}">
<header><span class="status">${CLAIM_STATUS_LABELS[claim.status]}</span><h3>${escapeHtml(formatTypeLabel(claim.type))}</h3></header>
<dl>
<dt>Source</dt><dd><code>${escapeHtml(formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd))}</code></dd>
<dt>Scope</dt><dd><code>${escapeHtml(claim.scopeDirectory)}</code></dd>
</dl>
<h4>Original instruction</h4>
<pre><code>${escapeHtml(claim.originalText)}</code></pre>
<h4>Normalized claim</h4>
<pre><code>${escapeHtml(claim.normalizedValue)}</code></pre>
<h4>Deterministic evidence</h4>
${renderEvidence(claim)}
${inconsistencies}${suggestion}${command}
</article>`;
}

function renderConflict(conflict: InstructionConflict): string {
  return `<article class="conflict">
<h3>${escapeHtml(formatTypeLabel(conflict.type))}</h3>
<p><strong>Effective scope:</strong> <code>${escapeHtml(conflict.effectiveScopeDirectory)}</code></p>
<p>${escapeHtml(conflict.message)}</p>
<ul>${conflict.claims
    .map(
      (claim) =>
        `<li><code>${escapeHtml(formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd))}</code>: <code>${escapeHtml(claim.normalizedValue)}</code></li>`,
    )
    .join("")}</ul>
</article>`;
}

export function renderHtmlReport(report: AgentContractReport): string {
  const instructionChain =
    report.instructionChain.length === 0
      ? "<p>No instruction files were discovered.</p>"
      : `<ol>${report.instructionChain
          .map(
            (instruction) =>
              `<li><code>${escapeHtml(instruction.path)}</code> — <code>${escapeHtml(instruction.fileName)}</code> in <code>${escapeHtml(instruction.directory)}</code></li>`,
          )
          .join("")}</ol>`;
  const claims =
    report.claims.length === 0
      ? "<p>No claims were extracted.</p>"
      : `<fieldset class="filters"><legend>Filter claims by status</legend>
<label><input id="filter-all" type="radio" name="claim-filter" checked> All</label>
${Object.entries(CLAIM_STATUS_LABELS)
  .map(
    ([status, label]) =>
      `<label><input id="filter-${status}" type="radio" name="claim-filter"> ${escapeHtml(label)}</label>`,
  )
  .join("\n")}
</fieldset>
<div class="claim-list">${report.claims.map(renderClaim).join("\n")}</div>`;
  const overrides = report.claims.filter((claim) => claim.status === "overridden");
  const overrideOutput =
    overrides.length === 0
      ? "<p>No claims were overridden.</p>"
      : `<ul>${overrides
          .map(
            (claim) =>
              `<li><code>${escapeHtml(formatSourceLocation(claim.sourceFile, claim.lineStart, claim.lineEnd))}</code>: <code>${escapeHtml(claim.normalizedValue)}</code></li>`,
          )
          .join("")}</ul>`;
  const conflicts =
    report.conflicts.length === 0
      ? "<p>No instruction conflicts were detected.</p>"
      : report.conflicts.map(renderConflict).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escrow Report — ${escapeHtml(OVERALL_STATUS_LABELS[report.overallStatus])}</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.5;--ok:#16803a;--bad:#b42318;--warn:#a15c00;--muted:#667085;--border:#98a2b3;--panel:color-mix(in srgb,Canvas 94%,CanvasText 6%)}
*{box-sizing:border-box}body{margin:0;background:Canvas;color:CanvasText}main{max-width:1080px;margin:auto;padding:2rem 1rem 4rem}h1,h2,h3,h4{line-height:1.2}code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}code{overflow-wrap:anywhere}pre{padding:1rem;overflow:auto;background:var(--panel);border:1px solid var(--border);border-radius:.5rem;white-space:pre-wrap}.meta,.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem}.meta div,.summary div,.claim,.conflict{border:1px solid var(--border);border-radius:.65rem;padding:1rem;background:var(--panel)}.meta dt,.summary dt,dt{font-weight:700}.meta dd,.summary dd,dd{margin:0}.overall{font-size:1.25rem;font-weight:800}.overall-fail,.status-failed,.status-blocked{border-left:.4rem solid var(--bad)}.overall-pass{color:var(--ok)}.overall-pass_with_warnings{color:var(--warn)}.claim,.conflict{margin:1rem 0}.claim header{display:flex;gap:.75rem;align-items:center}.claim header h3{margin:.25rem 0}.status{font-weight:800}.status-passed{border-left:.4rem solid var(--ok)}.status-warning,.status-inconclusive{border-left:.4rem solid var(--warn)}.status-advisory,.status-overridden{border-left:.4rem solid var(--muted)}.filters{display:flex;flex-wrap:wrap;gap:.75rem;border:1px solid var(--border);border-radius:.5rem;padding:.75rem}.filters legend{font-weight:700}.filters label{cursor:pointer}.filters:has(#filter-passed:checked)+.claim-list .claim:not(.status-passed),.filters:has(#filter-failed:checked)+.claim-list .claim:not(.status-failed),.filters:has(#filter-warning:checked)+.claim-list .claim:not(.status-warning),.filters:has(#filter-blocked:checked)+.claim-list .claim:not(.status-blocked),.filters:has(#filter-inconclusive:checked)+.claim-list .claim:not(.status-inconclusive),.filters:has(#filter-advisory:checked)+.claim-list .claim:not(.status-advisory),.filters:has(#filter-overridden:checked)+.claim-list .claim:not(.status-overridden){display:none}details{margin-top:1rem;border:1px solid var(--border);border-radius:.5rem;padding:.75rem}summary{cursor:pointer;font-weight:700}.inconsistency,.suggestion{padding:.75rem;border-left:.25rem solid var(--warn)}footer{margin-top:2rem;color:var(--muted)}
</style>
</head>
<body>
<main>
<header>
<h1>Escrow Report</h1>
<p class="overall overall-${report.overallStatus}">Overall status: ${escapeHtml(OVERALL_STATUS_LABELS[report.overallStatus])}</p>
<dl class="meta">
<div><dt>Repository</dt><dd><code>${escapeHtml(report.repositoryRoot)}</code></dd></div>
<div><dt>Target directory</dt><dd><code>${escapeHtml(report.targetDirectory)}</code></dd></div>
<div><dt>Generated</dt><dd>${escapeHtml(report.generatedAt)}</dd></div>
<div><dt>Report version</dt><dd>${escapeHtml(report.version)}</dd></div>
</dl>
</header>
<section aria-labelledby="summary"><h2 id="summary">Summary</h2><dl class="summary">
${SUMMARY_FIELDS.map(({ key, label }) => `<div data-summary-key="${key}" data-summary-value="${String(report.summary[key])}"><dt>${label}</dt><dd>${String(report.summary[key])}</dd></div>`).join("\n")}
</dl></section>
<section aria-labelledby="instructions"><h2 id="instructions">Instruction chain</h2>${instructionChain}</section>
<section aria-labelledby="claims"><h2 id="claims">Claims</h2>${claims}</section>
<section aria-labelledby="overrides"><h2 id="overrides">Overrides</h2>${overrideOutput}</section>
<section aria-labelledby="conflicts"><h2 id="conflicts">Conflicts</h2>${conflicts}</section>
<footer>Generated by Escrow.</footer>
</main>
</body>
</html>
`;
}
