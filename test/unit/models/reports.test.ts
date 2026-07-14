import { describe, expect, it } from "vitest";

import {
  aggregateClaimStatuses,
  calculateOverallStatus,
  createAgentContractReport,
  type ReportSummary,
} from "../../../src/models/reports.js";
import { createReport, createValidatedClaim } from "./claimFixtures.js";

describe("report aggregation", () => {
  it("counts every status deterministically", () => {
    const summary = aggregateClaimStatuses([
      createValidatedClaim({ id: "passed", status: "passed" }),
      createValidatedClaim({ id: "failed", status: "failed" }),
      createValidatedClaim({ id: "warning", status: "warning" }),
      createValidatedClaim({ id: "blocked", status: "blocked" }),
      createValidatedClaim({ id: "inconclusive", status: "inconclusive" }),
      createValidatedClaim({ id: "advisory", type: "advisory", status: "advisory" }),
      createValidatedClaim({ id: "overridden", status: "overridden" }),
    ]);

    expect(summary).toEqual({
      passed: 1,
      failed: 1,
      warnings: 1,
      blocked: 1,
      inconclusive: 1,
      advisory: 1,
      overridden: 1,
    });
  });

  it("does not count advisory claims as passed or failed", () => {
    const summary = aggregateClaimStatuses([
      createValidatedClaim({ type: "advisory", status: "advisory" }),
    ]);

    expect(summary.advisory).toBe(1);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it("never counts advisory claim types as passed or failed", () => {
    const summary = aggregateClaimStatuses([
      createValidatedClaim({ id: "advisory-pass", type: "advisory", status: "passed" }),
      createValidatedClaim({ id: "advisory-fail", type: "advisory", status: "failed" }),
    ]);

    expect(summary.advisory).toBe(2);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it("normalizes advisory pass/fail statuses in the shared report", () => {
    const report = createReport([
      createValidatedClaim({ id: "advisory-pass", type: "advisory", status: "passed" }),
      createValidatedClaim({ id: "advisory-fail", type: "advisory", status: "failed" }),
    ]);

    expect(report.claims.map((claim) => claim.status)).toEqual([
      "advisory",
      "advisory",
    ]);
    expect(report.summary.advisory).toBe(2);
    expect(report.summary.passed).toBe(0);
    expect(report.summary.failed).toBe(0);
    expect(report.overallStatus).toBe("pass");
  });

  it("preserves non-pass/fail statuses assigned to advisory claim types", () => {
    const summary = aggregateClaimStatuses([
      createValidatedClaim({ type: "advisory", status: "warning" }),
      createValidatedClaim({ id: "blocked", type: "advisory", status: "blocked" }),
    ]);

    expect(summary.advisory).toBe(0);
    expect(summary.warnings).toBe(1);
    expect(summary.blocked).toBe(1);
  });

  it("creates reports with derived totals and overall status", () => {
    const report = createReport([
      createValidatedClaim({ id: "passed", status: "passed" }),
      createValidatedClaim({ id: "warning", status: "warning" }),
    ]);

    expect(report.summary.passed).toBe(1);
    expect(report.summary.warnings).toBe(1);
    expect(report.overallStatus).toBe("pass_with_warnings");
    expect(report.conflicts).toEqual([]);
  });

  it("preserves source locations when constructing a report", () => {
    const claim = createValidatedClaim({
      sourceFile: "packages/web/AGENTS.md",
      lineStart: 20,
      lineEnd: 22,
    });

    const report = createReport([claim]);

    expect(report.claims[0]?.sourceFile).toBe("packages/web/AGENTS.md");
    expect(report.claims[0]?.lineStart).toBe(20);
    expect(report.claims[0]?.lineEnd).toBe(22);
  });

  it("preserves deterministic instruction conflicts", () => {
    const report = createReport([
      createValidatedClaim({
        id: "npm",
        type: "package_manager",
        sourceFile: "/repo/AGENTS.md",
        lineStart: 2,
        lineEnd: 2,
        normalizedValue: "npm",
        scopeDirectory: "/repo/packages/api",
        packageManager: "npm",
        status: "passed",
      }),
      createValidatedClaim({
        id: "pnpm",
        type: "package_manager",
        sourceFile: "/repo/packages/api/AGENTS.md",
        lineStart: 4,
        lineEnd: 4,
        normalizedValue: "pnpm",
        scopeDirectory: "/repo/packages/api",
        packageManager: "pnpm",
        status: "passed",
      }),
    ], [
      {
        id: "conflict-1",
        type: "package_manager",
        effectiveScopeDirectory: "/repo/packages/api",
        message: "npm versus pnpm",
        claims: [
          {
            claimId: "npm",
            claimType: "package_manager",
            sourceFile: "/repo/AGENTS.md",
            lineStart: 2,
            lineEnd: 2,
            scopeDirectory: "/repo/packages/api",
            normalizedValue: "npm",
          },
          {
            claimId: "pnpm",
            claimType: "package_manager",
            sourceFile: "/repo/packages/api/AGENTS.md",
            lineStart: 4,
            lineEnd: 4,
            scopeDirectory: "/repo/packages/api",
            normalizedValue: "pnpm",
          },
        ],
      },
    ]);

    expect(report.conflicts[0]?.claims.map((claim) => claim.sourceFile)).toEqual([
      "/repo/AGENTS.md",
      "/repo/packages/api/AGENTS.md",
    ]);
    expect(report.summary.failed).toBe(2);
    expect(report.overallStatus).toBe("fail");
    expect(report.claims.every((claim) => claim.status === "failed")).toBe(true);
  });

  it("rejects conflicts whose source claim is absent from the report", () => {
    expect(() =>
      createAgentContractReport({
        version: "0.1.0",
        generatedAt: "2026-07-13T12:00:00.000Z",
        repositoryRoot: "/repo",
        targetDirectory: "/repo",
        instructionChain: [],
        claims: [],
        conflicts: [
          {
            id: "conflict-1",
            type: "package_manager",
            effectiveScopeDirectory: "/repo",
            message: "npm versus pnpm",
            claims: [
              {
                claimId: "missing",
                claimType: "package_manager",
                sourceFile: "/repo/AGENTS.md",
                lineStart: 1,
                lineEnd: 1,
                scopeDirectory: "/repo",
                normalizedValue: "npm",
              },
            ],
          },
        ],
      }),
    ).toThrow("source data that is absent from the report");
  });
});

describe("calculateOverallStatus", () => {
  const emptySummary: ReportSummary = {
    passed: 0,
    failed: 0,
    warnings: 0,
    blocked: 0,
    inconclusive: 0,
    advisory: 0,
    overridden: 0,
  };

  it("returns fail when one or more claims failed", () => {
    expect(
      calculateOverallStatus({ ...emptySummary, failed: 1, warnings: 2 }),
    ).toBe("fail");
  });

  it.each(["warnings", "blocked", "inconclusive"] as const)(
    "returns pass_with_warnings when %s exist without failures",
    (summaryKey) => {
      expect(calculateOverallStatus({ ...emptySummary, [summaryKey]: 1 })).toBe(
        "pass_with_warnings",
      );
    },
  );

  it("returns pass when all counted claims passed", () => {
    expect(calculateOverallStatus({ ...emptySummary, passed: 3 })).toBe("pass");
  });

  it("returns pass for advisory and overridden claims without warnings", () => {
    expect(
      calculateOverallStatus({ ...emptySummary, advisory: 2, overridden: 1 }),
    ).toBe("pass");
  });

  it("returns pass for an empty report", () => {
    expect(calculateOverallStatus(emptySummary)).toBe("pass");
  });

  it("does not accept caller-provided totals when constructing a report", () => {
    const report = createAgentContractReport({
      version: "0.1.0",
      generatedAt: "2026-07-13T12:00:00.000Z",
      repositoryRoot: "/repo",
      targetDirectory: "/repo",
      instructionChain: [],
      claims: [createValidatedClaim({ status: "failed" })],
    });

    expect(report.summary.failed).toBe(1);
    expect(report.overallStatus).toBe("fail");
  });
});
