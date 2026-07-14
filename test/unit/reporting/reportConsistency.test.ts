import { describe, expect, it } from "vitest";

import { renderConsoleReport } from "../../../src/reporting/consoleReporter.js";
import { renderHtmlReport } from "../../../src/reporting/htmlReporter.js";
import { renderJsonReport } from "../../../src/reporting/jsonReporter.js";
import { renderMarkdownReport } from "../../../src/reporting/markdownReporter.js";
import {
  OVERALL_STATUS_LABELS,
  SUMMARY_FIELDS,
} from "../../../src/reporting/reportFormatting.js";
import { createRichReport } from "./reportFixture.js";

describe("report format consistency", () => {
  it("renders the same overall status and totals in every format", () => {
    const report = createRichReport();
    const consoleOutput = renderConsoleReport(report);
    const jsonOutput = JSON.parse(renderJsonReport(report)) as typeof report;
    const markdownOutput = renderMarkdownReport(report);
    const htmlOutput = renderHtmlReport(report);

    expect(jsonOutput.summary).toEqual(report.summary);
    expect(jsonOutput.overallStatus).toBe(report.overallStatus);
    expect(consoleOutput).toContain(
      `AgentContract: ${OVERALL_STATUS_LABELS[report.overallStatus]}`,
    );
    expect(markdownOutput).toContain(
      `**Overall status: ${OVERALL_STATUS_LABELS[report.overallStatus]}**`,
    );
    expect(htmlOutput).toContain(
      `Overall status: ${OVERALL_STATUS_LABELS[report.overallStatus]}`,
    );

    for (const { key, label } of SUMMARY_FIELDS) {
      const value = report.summary[key];
      expect(consoleOutput).toContain(
        `${String(value)} ${key === "warnings" ? "warnings" : key}`,
      );
      expect(markdownOutput).toContain(`| ${label} | ${String(value)} |`);
      expect(htmlOutput).toContain(
        `data-summary-key="${key}" data-summary-value="${String(value)}"`,
      );
    }
  });

  it("preserves advisory and overridden claims without counting them as verdicts", () => {
    const report = createRichReport();
    const consoleOutput = renderConsoleReport(report);
    const jsonOutput = JSON.parse(renderJsonReport(report)) as typeof report;
    const markdownOutput = renderMarkdownReport(report);
    const htmlOutput = renderHtmlReport(report);

    expect(report.summary).toEqual({
      passed: 0,
      failed: 3,
      warnings: 0,
      blocked: 1,
      inconclusive: 0,
      advisory: 1,
      overridden: 1,
    });
    expect(jsonOutput.claims.find(({ id }) => id === "advisory")?.status).toBe(
      "advisory",
    );
    expect(
      jsonOutput.claims.find(({ id }) => id === "root-manager")?.status,
    ).toBe("overridden");
    expect(consoleOutput).toContain("[ADVISORY] advisory AGENTS.md:12");
    expect(consoleOutput).toContain(
      "[OVERRIDDEN] package_manager AGENTS.md:14",
    );
    expect(markdownOutput).toContain("### ADVISORY · advisory");
    expect(markdownOutput).toContain("### OVERRIDDEN · package manager");
    expect(htmlOutput).toContain(
      '<article class="claim status-advisory">',
    );
    expect(htmlOutput).toContain(
      '<article class="claim status-overridden">',
    );
  });

  it("preserves source ranges and multiline command output without mutating the report", () => {
    const report = createRichReport();
    const original = structuredClone(report);
    const consoleOutput = renderConsoleReport(report);
    const jsonOutput = JSON.parse(renderJsonReport(report)) as typeof report;
    const markdownOutput = renderMarkdownReport(report);
    const htmlOutput = renderHtmlReport(report);

    expect(report).toEqual(original);
    expect(jsonOutput).toEqual(original);
    for (const output of [consoleOutput, markdownOutput, htmlOutput]) {
      expect(output).toContain("packages/api/AGENTS.override.md:4-5");
      expect(output).toContain("first stdout line");
      expect(output).toContain("first stderr line");
    }
    expect(consoleOutput).toContain("second <script>stdout</script> line");
    expect(markdownOutput).toContain(
      "second &lt;script&gt;stdout&lt;/script&gt; line",
    );
    expect(htmlOutput).toContain(
      "second &lt;script&gt;stdout&lt;/script&gt; line",
    );
  });
});
