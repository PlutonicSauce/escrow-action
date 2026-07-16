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
    expect(
      report.claims
        .filter((claim) => claim.status === "failed")
        .map((claim) => claim.type),
    ).toEqual([
      "package_manager",
      "path_exists",
      "package_script",
      "dependency_present",
    ]);
    expect(report.claims.find((claim) => claim.type === "command_runs")).toMatchObject({
      status: "passed",
      commandResult: {
        command: "node scripts/healthcheck.mjs",
        exitCode: 0,
        stdout: "sample healthcheck passed\n",
      },
    });
    expect(renderJsonReport(report)).toBe(json);
    expect(renderMarkdownReport(report)).toBe(markdown);
    expect(renderHtmlReport(report)).toBe(html);
    expect(renderConsoleReport(report)).toBe(consoleOutput);
  });

  it("documents setup, architecture, safety, limitations, and the timed demo", async () => {
    const [
      readme,
      architecture,
      demoScript,
      demoReadme,
      resetScript,
      action,
      site,
      license,
      caseStudy,
    ] = await Promise.all([
      readFile(join(PROJECT_ROOT, "README.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "docs/architecture.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "docs/demo-script.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "demo/README.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "scripts/reset-demo.mjs"), "utf8"),
      readFile(join(PROJECT_ROOT, "action.yml"), "utf8"),
      readFile(join(PROJECT_ROOT, "site/index.html"), "utf8"),
      readFile(join(PROJECT_ROOT, "LICENSE"), "utf8"),
      readFile(join(PROJECT_ROOT, "docs/case-study.md"), "utf8"),
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
    expect(demoScript).toContain(
      '--model "${ESCROW_DEMO_MODEL:-gpt-5.6-luna}" --execute',
    );
    expect(demoScript).not.toContain("gpt-5.6-terra");
    for (const judgeSurface of [demoReadme, resetScript, action, site]) {
      expect(judgeSurface).toContain("gpt-5.6-luna");
    }
    expect(demoReadme).toContain("gpt-5.6-luna --execute");
    expect(resetScript).toContain("gpt-5.6-luna --execute");
    expect(demoReadme).not.toContain("gpt-5.6-terra");
    expect(resetScript).not.toContain("gpt-5.6-terra");
    expect(site).not.toContain("gpt-5.6-terra");
    expect(license).toContain("MIT License");
    for (const requiredText of [
      "1 | 4",
      "3 | 0",
      "package_manager",
      "path_exists",
      "package_script",
      "dependency_present",
      "temporary Git worktree",
      "active repository unchanged",
      "Console, JSON, Markdown",
      "has not measured time",
    ]) {
      expect(caseStudy).toContain(requiredText);
    }
  });

  it("uses Escrow consistently across public package and documentation surfaces", async () => {
    const publicFiles = await Promise.all(
      [
        "README.md",
        "AGENTS.md",
        "SPEC.md",
        "PLAN.md",
        "IMPLEMENTATION.md",
        "docs/architecture.md",
        "docs/demo-script.md",
        "docs/devpost-submission.md",
      ].map((path) => readFile(join(PROJECT_ROOT, path), "utf8")),
    );
    const packageJson = JSON.parse(
      await readFile(join(PROJECT_ROOT, "package.json"), "utf8"),
    ) as { name: string; bin: Record<string, string> };

    expect(packageJson.name).toBe("escrow");
    expect(packageJson.bin).toEqual({ escrow: "dist/index.js" });
    for (const content of publicFiles) {
      expect(content).toContain("Escrow");
      expect(content).not.toMatch(/AgentContract|ProofCatcher/u);
    }
  });

  it("keeps the Build Week submission draft and canonical demo story complete", async () => {
    const [submission, demoScript] = await Promise.all([
      readFile(join(PROJECT_ROOT, "docs/devpost-submission.md"), "utf8"),
      readFile(join(PROJECT_ROOT, "docs/demo-script.md"), "utf8"),
    ]);

    for (const heading of [
      "Project name",
      "Selected track",
      "The problem",
      "What Escrow does",
      "How it works",
      "How Codex accelerated development",
      "How GPT-5.6 is integrated at runtime",
      "Key product and engineering decisions made by the builder",
      "Technical challenges",
      "Accomplishments",
      "What was learned",
      "What is next",
      "Technologies used",
      "Judge installation and testing",
    ]) {
      expect(submission).toContain(heading);
    }
    expect(submission).toContain("Developer Tools");
    expect(submission).toContain("public YouTube URL");
    expect(submission).toContain("Codex `/feedback` Session ID");
    expect(submission).toContain("GitHub Release URL");
    expect(submission).toContain("entrant/team information");
    expect(submission).not.toContain("Codex generated the backend");

    for (const timestamp of [
      "0:00–0:15",
      "0:15–0:55",
      "0:55–1:25",
      "1:25–1:55",
      "1:55–2:15",
      "2:15–2:35",
      "2:35–2:50",
    ]) {
      expect(demoScript).toContain(timestamp);
    }
    expect(demoScript).toContain("This is the canonical Escrow judge story.");
    expect(demoScript).toContain(
      "AI interprets\n> language, while deterministic repository evidence decides truth.",
    );
  });
});
