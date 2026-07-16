import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createRepositoryReport } from "../../../src/commands/check.js";
import { fixRepository } from "../../../src/commands/fix.js";
import type { RawExtractedClaim } from "../../../src/models/claims.js";
import type { CodexProcessRunner } from "../../../src/extraction/codexClient.js";
import type { AgentContractReport, ReportSummary } from "../../../src/models/reports.js";
import { renderConsoleReport } from "../../../src/reporting/consoleReporter.js";
import { renderHtmlReport } from "../../../src/reporting/htmlReporter.js";
import { renderJsonReport } from "../../../src/reporting/jsonReporter.js";
import { renderMarkdownReport } from "../../../src/reporting/markdownReporter.js";
import {
  startUiServer,
  type RunningUiServer,
} from "../../../src/web/server.js";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SOURCE_DEMO = join(PROJECT_ROOT, "demo/sample-monorepo");
const temporaryDirectories: string[] = [];
const servers: RunningUiServer[] = [];
const GENERATED_AT = "2026-07-14T18:00:00.000Z";

const DEMO_REPAIR_PATCH = `diff --git a/AGENTS.md b/AGENTS.md
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,7 +1,5 @@
 # Sample monorepo instructions
${" "}
-- Use npm as the package manager for this repository.
-- Read \`docs/DELETED_SETUP.md\` before changing workspace configuration.
-- Run unit tests with \`pnpm test\`.
-- Use the installed Jest dependency for unit tests.
+- Use pnpm as the package manager for this repository.
+- Run unit tests with \`pnpm test:unit\`.
 - Run \`node scripts/healthcheck.mjs\` to verify the repository health check.
`;

async function createDemoRepository(): Promise<string> {
  const container = await realpath(await mkdtemp(join(tmpdir(), "escrow-demo-test-")));
  temporaryDirectories.push(container);
  const repository = join(container, "sample-monorepo");
  await cp(SOURCE_DEMO, repository, { recursive: true });
  await execFileAsync("git", ["-C", repository, "init", "--quiet"]);
  await execFileAsync("git", ["-C", repository, "config", "user.name", "Escrow Test"]);
  await execFileAsync("git", ["-C", repository, "config", "user.email", "test@example.invalid"]);
  await execFileAsync("git", ["-C", repository, "add", "."]);
  await execFileAsync("git", ["-C", repository, "commit", "--quiet", "-m", "demo baseline"]);
  return repository;
}

function runnerFor(claims: RawExtractedClaim[]): CodexProcessRunner {
  return vi.fn<CodexProcessRunner>().mockResolvedValue({
    exitCode: 0,
    stdout: JSON.stringify({ claims }),
    stderr: "",
    timedOut: false,
  });
}

function rootClaim(
  repository: string,
  claim: Omit<RawExtractedClaim, "sourceFile" | "confidence" | "extractionReason">,
): RawExtractedClaim {
  return {
    ...claim,
    sourceFile: join(repository, "AGENTS.md"),
    confidence: 1,
    extractionReason: "Explicit demo instruction.",
  } as RawExtractedClaim;
}

function brokenClaims(repository: string): RawExtractedClaim[] {
  return [
    rootClaim(repository, {
      id: "wrong-manager",
      type: "package_manager",
      lineStart: 3,
      lineEnd: 3,
      normalizedValue: "npm",
      packageManager: "npm",
    }),
    rootClaim(repository, {
      id: "missing-doc",
      type: "path_exists",
      lineStart: 4,
      lineEnd: 4,
      normalizedValue: "docs/DELETED_SETUP.md",
      referencedPath: "docs/DELETED_SETUP.md",
    }),
    rootClaim(repository, {
      id: "missing-script",
      type: "package_script",
      lineStart: 5,
      lineEnd: 5,
      normalizedValue: "test",
      command: "pnpm test",
      packageManager: "pnpm",
      packageScript: "test",
    }),
    rootClaim(repository, {
      id: "outdated-framework",
      type: "dependency_present",
      lineStart: 6,
      lineEnd: 6,
      normalizedValue: "Jest",
      dependencyNames: ["jest"],
    }),
    rootClaim(repository, {
      id: "safe-command",
      type: "command_runs",
      lineStart: 7,
      lineEnd: 7,
      normalizedValue: "node scripts/healthcheck.mjs",
      command: "node scripts/healthcheck.mjs",
    }),
  ];
}

function repairedClaims(repository: string): RawExtractedClaim[] {
  return [
    rootClaim(repository, {
      id: "manager",
      type: "package_manager",
      lineStart: 3,
      lineEnd: 3,
      normalizedValue: "pnpm",
      packageManager: "pnpm",
    }),
    rootClaim(repository, {
      id: "unit-script",
      type: "package_script",
      lineStart: 4,
      lineEnd: 4,
      normalizedValue: "test:unit",
      command: "pnpm test:unit",
      packageManager: "pnpm",
      packageScript: "test:unit",
    }),
    rootClaim(repository, {
      id: "safe-command",
      type: "command_runs",
      lineStart: 5,
      lineEnd: 5,
      normalizedValue: "node scripts/healthcheck.mjs",
      command: "node scripts/healthcheck.mjs",
    }),
  ];
}

async function evaluateDemo(
  repository: string,
  options: { execute?: boolean | undefined },
): Promise<AgentContractReport> {
  const canonicalRepository = await realpath(repository);
  const instructions = await readFile(
    join(canonicalRepository, "AGENTS.md"),
    "utf8",
  );
  const claims = instructions.includes("DELETED_SETUP.md")
    ? brokenClaims(canonicalRepository)
    : repairedClaims(canonicalRepository);
  return createRepositoryReport(canonicalRepository, options, {
    generatedAt: () => GENERATED_AT,
    codexRunner: runnerFor(claims),
  });
}

function expectSummaryInEveryRenderedFormat(
  report: AgentContractReport,
  summary: ReportSummary,
): void {
  const consoleOutput = renderConsoleReport(report);
  const json = JSON.parse(renderJsonReport(report)) as AgentContractReport;
  const markdown = renderMarkdownReport(report);
  const html = renderHtmlReport(report);

  expect(json.summary).toEqual(summary);
  expect(consoleOutput).toContain(
    `Summary: ${String(summary.passed)} passed, ${String(summary.failed)} failed, ${String(summary.warnings)} warnings, ${String(summary.blocked)} blocked, ${String(summary.inconclusive)} inconclusive, ${String(summary.advisory)} advisory, ${String(summary.overridden)} overridden`,
  );
  for (const [key, total] of Object.entries(summary)) {
    expect(html).toContain(
      `data-summary-key="${key}" data-summary-value="${String(total)}"`,
    );
  }
  for (const [label, total] of [
    ["Passed", summary.passed],
    ["Failed", summary.failed],
    ["Warnings", summary.warnings],
    ["Blocked", summary.blocked],
    ["Inconclusive", summary.inconclusive],
    ["Advisory", summary.advisory],
    ["Overridden", summary.overridden],
  ] as const) {
    expect(markdown).toContain(`| ${label} | ${String(total)} |`);
  }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => server.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Escrow demo workflow", () => {
  it("produces exactly four genuine failures and one passing safe command", async () => {
    const repository = await createDemoRepository();

    const report = await createRepositoryReport(
      repository,
      { execute: true },
      {
        generatedAt: () => GENERATED_AT,
        codexRunner: runnerFor(brokenClaims(repository)),
      },
    );

    expect(report.overallStatus).toBe("fail");
    expect(report.summary).toEqual({
      passed: 1,
      failed: 4,
      warnings: 0,
      blocked: 0,
      inconclusive: 0,
      advisory: 0,
      overridden: 0,
    });
    expect(report.claims).toHaveLength(5);
    expect(report.claims.filter((claim) => claim.status === "failed").map((claim) => claim.type)).toEqual([
      "package_manager",
      "path_exists",
      "package_script",
      "dependency_present",
    ]);
    expect(report.claims.find((claim) => claim.id === "safe-command")).toMatchObject({
      status: "passed",
      commandResult: {
        status: "passed",
        command: "node scripts/healthcheck.mjs",
        exitCode: 0,
        stdout: "sample healthcheck passed\n",
      },
    });
  });

  it("treats the nested pnpm instruction as a valid override, not a conflict", async () => {
    const repository = await createDemoRepository();
    const claims: RawExtractedClaim[] = [
      rootClaim(repository, {
        id: "root-manager",
        type: "package_manager",
        lineStart: 3,
        lineEnd: 3,
        normalizedValue: "npm",
        packageManager: "npm",
      }),
      {
        id: "api-manager",
        type: "package_manager",
        sourceFile: join(repository, "packages/api/AGENTS.override.md"),
        lineStart: 3,
        lineEnd: 3,
        normalizedValue: "pnpm",
        packageManager: "pnpm",
        confidence: 1,
        extractionReason: "Explicit nested package-manager instruction.",
      },
    ];

    const report = await createRepositoryReport(
      repository,
      { target: "packages/api" },
      { generatedAt: () => GENERATED_AT, codexRunner: runnerFor(claims) },
    );

    expect(report.conflicts).toEqual([]);
    expect(report.instructionChain.map((instruction) => instruction.fileName)).toEqual([
      "AGENTS.md",
      "AGENTS.override.md",
    ]);
    expect(report.claims.find((claim) => claim.id === "root-manager")?.status).toBe(
      "overridden",
    );
    expect(report.claims.find((claim) => claim.id === "api-manager")?.status).toBe(
      "passed",
    );
  });

  it("previews an instruction-only repair and revalidates it without changing the active repository", async () => {
    const repository = await createDemoRepository();
    const activeInstructions = await readFile(join(repository, "AGENTS.md"), "utf8");
    const output: string[] = [];
    const result = await fixRepository(
      repository,
      { execute: true },
      {
        generatedAt: () => GENERATED_AT,
        writeConsole: (value) => output.push(value),
        evaluate: evaluateDemo,
        repairRunner: vi.fn<CodexProcessRunner>().mockResolvedValue({
          exitCode: 0,
          stdout: JSON.stringify({ patch: DEMO_REPAIR_PATCH }),
          stderr: "",
          timedOut: false,
        }),
      },
    );

    expect(result.beforeReport.summary).toMatchObject({ passed: 1, failed: 4 });
    expect(result.afterReport?.overallStatus).toBe("pass");
    expect(result.afterReport?.summary).toEqual({
      passed: 3,
      failed: 0,
      warnings: 0,
      blocked: 0,
      inconclusive: 0,
      advisory: 0,
      overridden: 0,
    });
    expect(result.afterReport?.claims.every((claim) => claim.status === "passed")).toBe(
      true,
    );
    expect(result.changedFiles).toEqual(["AGENTS.md"]);
    expect(result.patch).toContain("diff --git a/AGENTS.md b/AGENTS.md");
    expect(result.patch?.match(/^diff --git /gmu)).toHaveLength(1);
    expect(result.applied).toBe(false);
    expect(output.join("")).toContain(
      "Preview only: the active repository was not modified.",
    );
    expect(await readFile(join(repository, "AGENTS.md"), "utf8")).toBe(
      activeInstructions,
    );
    const { stdout: status } = await execFileAsync("git", [
      "-C",
      repository,
      "status",
      "--short",
    ]);
    expect(status).toBe("");
  });

  it("keeps console, JSON, Markdown, HTML, and UI totals identical", async () => {
    const repository = await createDemoRepository();
    const report = await evaluateDemo(repository, { execute: true });
    const expectedSummary = {
      passed: 1,
      failed: 4,
      warnings: 0,
      blocked: 0,
      inconclusive: 0,
      advisory: 0,
      overridden: 0,
    };
    expectSummaryInEveryRenderedFormat(report, expectedSummary);

    const server = await startUiServer(
      { repository, port: 0, model: "gpt-test", execute: true },
      { evaluate: async () => report },
    );
    servers.push(server);
    const scan = await fetch(`${server.url}/api/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ execute: true }),
    });
    const uiReport = (await scan.json()) as AgentContractReport;
    expect(scan.status).toBe(200);
    expect(uiReport.summary).toEqual(expectedSummary);
    expect(uiReport.overallStatus).toBe(report.overallStatus);

    const [jsonResponse, markdownResponse, htmlResponse] = await Promise.all([
      fetch(`${server.url}/api/report?format=json`),
      fetch(`${server.url}/api/report?format=markdown`),
      fetch(`${server.url}/api/report?format=html`),
    ]);
    const [json, markdown, html] = await Promise.all([
      jsonResponse.text(),
      markdownResponse.text(),
      htmlResponse.text(),
    ]);
    expect(json).toBe(renderJsonReport(report));
    expect(markdown).toBe(renderMarkdownReport(report));
    expect(html).toBe(renderHtmlReport(report));
  });
});
