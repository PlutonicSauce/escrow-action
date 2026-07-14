import { describe, expect, it } from "vitest";

import { renderJsonReport } from "../../../src/reporting/jsonReporter.js";
import {
  createReport,
  createValidatedClaim,
} from "../models/claimFixtures.js";

describe("renderJsonReport", () => {
  it("serializes the shared report without losing source locations", () => {
    const report = createReport([
      createValidatedClaim({
        sourceFile: "packages/api/AGENTS.override.md",
        lineStart: 4,
        lineEnd: 6,
      }),
    ]);

    const output = renderJsonReport(report);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed).toEqual(report);
    expect(output.endsWith("\n")).toBe(true);
  });

  it("serializes deterministic totals and no AI-generated score", () => {
    const report = createReport([
      createValidatedClaim({ status: "warning" }),
      createValidatedClaim({ id: "advisory", type: "advisory", status: "advisory" }),
    ]);

    const parsed = JSON.parse(renderJsonReport(report)) as {
      overallStatus: string;
      summary: Record<string, number>;
      qualityScore?: unknown;
    };

    expect(parsed.overallStatus).toBe("pass_with_warnings");
    expect(parsed.summary.warnings).toBe(1);
    expect(parsed.summary.advisory).toBe(1);
    expect(parsed.qualityScore).toBeUndefined();
  });

  it("round-trips optional validated-claim and command-result data", () => {
    const report = createReport([
      createValidatedClaim({
        type: "command_runs",
        command: "npm test",
        status: "blocked",
        evidence: ["Command is prohibited"],
        suggestion: "Remove the prohibited command.",
        commandResult: {
          command: "npm test",
          workingDirectory: "/repo",
          status: "blocked",
          exitCode: null,
          stdout: "output\nwith unicode: ✓",
          stderr: "blocked\n",
          durationMs: 0,
        },
      }),
    ]);

    expect(JSON.parse(renderJsonReport(report))).toEqual(report);
  });

  it("serializes normalized advisory status and matching totals", () => {
    const report = createReport([
      createValidatedClaim({ type: "advisory", status: "failed" }),
    ]);
    const parsed = JSON.parse(renderJsonReport(report)) as typeof report;

    expect(parsed.claims[0]?.status).toBe("advisory");
    expect(parsed.summary.failed).toBe(0);
    expect(parsed.summary.advisory).toBe(1);
    expect(parsed.overallStatus).toBe("pass");
  });

  it("serializes conflict source locations without changing them", () => {
    const report = createReport([
      createValidatedClaim({
        id: "jest",
        type: "dependency_present",
        sourceFile: "AGENTS.md",
        lineStart: 3,
        lineEnd: 3,
        normalizedValue: "Jest",
        dependencyNames: ["jest"],
        status: "failed",
      }),
      createValidatedClaim({
        id: "vitest",
        type: "dependency_present",
        sourceFile: "AGENTS.override.md",
        lineStart: 8,
        lineEnd: 9,
        normalizedValue: "Vitest",
        dependencyNames: ["vitest"],
        status: "failed",
      }),
    ], [
      {
        id: "conflict-1",
        type: "dependency_present",
        effectiveScopeDirectory: "/repo",
        message: "Jest versus Vitest",
        claims: [
          {
            claimId: "jest",
            claimType: "dependency_present",
            sourceFile: "AGENTS.md",
            lineStart: 3,
            lineEnd: 3,
            scopeDirectory: "/repo",
            normalizedValue: "Jest",
          },
          {
            claimId: "vitest",
            claimType: "dependency_present",
            sourceFile: "AGENTS.override.md",
            lineStart: 8,
            lineEnd: 9,
            scopeDirectory: "/repo",
            normalizedValue: "Vitest",
          },
        ],
      },
    ]);

    const parsed = JSON.parse(renderJsonReport(report)) as typeof report;
    expect(parsed.conflicts).toEqual(report.conflicts);
    expect(parsed.overallStatus).toBe("fail");
  });
});
