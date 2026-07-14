import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { classifyCommand } from "../../../src/execution/commandPolicy.js";
import type { AgentContractReport } from "../../../src/models/reports.js";
import { renderConsoleReport } from "../../../src/reporting/consoleReporter.js";
import { renderHtmlReport } from "../../../src/reporting/htmlReporter.js";
import { renderJsonReport } from "../../../src/reporting/jsonReporter.js";
import { renderMarkdownReport } from "../../../src/reporting/markdownReporter.js";

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DEMO_ROOT = join(PROJECT_ROOT, "demo");
const SAMPLE_REPOSITORY = join(DEMO_ROOT, "sample-monorepo");
const SAMPLE_REPORTS = join(DEMO_ROOT, "sample-reports");

describe("Milestone 13 demo assets", () => {
  it("contains every intentional stale instruction and its repository evidence", async () => {
    const [instructions, packageText, override] = await Promise.all([
      readFile(join(SAMPLE_REPOSITORY, "AGENTS.md"), "utf8"),
      readFile(join(SAMPLE_REPOSITORY, "package.json"), "utf8"),
      readFile(join(SAMPLE_REPOSITORY, "packages/api/AGENTS.override.md"), "utf8"),
    ]);
    const packageJson = JSON.parse(packageText) as {
      packageManager: string;
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(instructions).toContain("Use npm as the package manager");
    expect(instructions).toContain("docs/DELETED_SETUP.md");
    expect(instructions).toContain("`pnpm test`");
    expect(instructions).toContain("installed Jest dependency");
    expect(instructions).toContain("node scripts/healthcheck.mjs");
    expect(packageJson.packageManager).toBe("pnpm@10.0.0");
    expect(packageJson.scripts.test).toBeUndefined();
    expect(packageJson.scripts["test:unit"]).toBeDefined();
    expect(packageJson.devDependencies.vitest).toBeDefined();
    expect(packageJson.devDependencies.jest).toBeUndefined();
    expect(override).toContain("use pnpm");
    await expect(
      access(join(SAMPLE_REPOSITORY, "docs/DELETED_SETUP.md")),
    ).rejects.toThrow();
  });

  it("blocks the separate dangerous fixture deterministically", async () => {
    const instruction = await readFile(
      join(DEMO_ROOT, "dangerous-command-fixture/AGENTS.md"),
      "utf8",
    );

    expect(instruction).toContain("git push origin main");
    expect(
      classifyCommand("git push origin main", { allowNetwork: false }),
    ).toMatchObject({ allowed: false, category: "git_destructive" });
  });

  it("keeps all checked-in sample reports derived from one report object", async () => {
    const [json, markdown, html, consoleOutput] = await Promise.all([
      readFile(join(SAMPLE_REPORTS, "broken-report.json"), "utf8"),
      readFile(join(SAMPLE_REPORTS, "broken-report.md"), "utf8"),
      readFile(join(SAMPLE_REPORTS, "broken-report.html"), "utf8"),
      readFile(join(SAMPLE_REPORTS, "broken-console.txt"), "utf8"),
    ]);
    const report = JSON.parse(json) as AgentContractReport;

    expect(report.summary).toEqual({
      passed: 1,
      failed: 4,
      warnings: 0,
      blocked: 0,
      inconclusive: 0,
      advisory: 0,
      overridden: 0,
    });
    expect(report.overallStatus).toBe("fail");
    expect(renderJsonReport(report)).toBe(json);
    expect(renderMarkdownReport(report)).toBe(markdown);
    expect(renderHtmlReport(report)).toBe(html);
    expect(renderConsoleReport(report)).toBe(consoleOutput);
  });

  it("documents setup, architecture, safety, limitations, and the timed demo", async () => {
    const [readme, architecture, demoScript, license] = await Promise.all([
      readFile(join(PROJECT_ROOT, "README.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "docs/architecture.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "docs/demo-script.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "LICENSE"), "utf8"),
    ]);

    for (const requiredText of [
      "npm ci",
      "Codex CLI",
      "macOS or Linux",
      "Supported claim",
      "Safety model",
      "Known limitations",
      "GPT-5.6",
      "npm run typecheck",
      "npm test",
    ]) {
      expect(readme).toContain(requiredText);
    }
    expect(architecture).toContain("Trust boundaries");
    expect(demoScript).toContain("three minutes");
    expect(demoScript).toContain("repair");
    expect(license).toContain("MIT License");
  });
});
