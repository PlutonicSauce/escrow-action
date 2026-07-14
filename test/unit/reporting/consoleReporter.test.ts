import { describe, expect, it } from "vitest";

import { renderConsoleReport } from "../../../src/reporting/consoleReporter.js";
import {
  createReport,
  createValidatedClaim,
} from "../models/claimFixtures.js";

describe("renderConsoleReport", () => {
  it("renders source files and line ranges", () => {
    const report = createReport([
      createValidatedClaim({
        id: "range",
        sourceFile: "packages/api/AGENTS.md",
        lineStart: 12,
        lineEnd: 14,
      }),
      createValidatedClaim({
        id: "single-line",
        sourceFile: "AGENTS.md",
        lineStart: 7,
        lineEnd: 7,
      }),
    ]);

    const output = renderConsoleReport(report);

    expect(output).toContain("packages/api/AGENTS.md:12-14");
    expect(output).toContain("AGENTS.md:7");
    expect(output).toContain("Instruction chain:");
    expect(output).toContain("/repo/AGENTS.md (AGENTS.md)");
    expect(output).toContain("Normalized: docs/architecture.md");
  });

  it("renders deterministic status totals and evidence", () => {
    const report = createReport([
      createValidatedClaim({ status: "failed", evidence: ["File is missing"] }),
      createValidatedClaim({
        id: "advisory",
        type: "advisory",
        status: "advisory",
        evidence: [],
      }),
    ]);

    const output = renderConsoleReport(report);

    expect(output).toContain("AgentContract: FAIL");
    expect(output).toContain("1 failed");
    expect(output).toContain("1 advisory");
    expect(output).toContain("Evidence: File is missing");
  });

  it("does not render an AI quality score", () => {
    const output = renderConsoleReport(createReport([]));

    expect(output.toLowerCase()).not.toContain("score");
  });

  it("renders conflicts with every source location", () => {
    const output = renderConsoleReport(
      createReport([
        createValidatedClaim({
          id: "npm",
          type: "package_manager",
          sourceFile: "AGENTS.md",
          lineStart: 2,
          lineEnd: 2,
          normalizedValue: "npm",
          packageManager: "npm",
          status: "failed",
        }),
        createValidatedClaim({
          id: "pnpm",
          type: "package_manager",
          sourceFile: "packages/api/AGENTS.md",
          lineStart: 5,
          lineEnd: 7,
          normalizedValue: "pnpm",
          packageManager: "pnpm",
          status: "failed",
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
              sourceFile: "AGENTS.md",
              lineStart: 2,
              lineEnd: 2,
              scopeDirectory: "/repo",
              normalizedValue: "npm",
            },
            {
              claimId: "pnpm",
              claimType: "package_manager",
              sourceFile: "packages/api/AGENTS.md",
              lineStart: 5,
              lineEnd: 7,
              scopeDirectory: "/repo/packages/api",
              normalizedValue: "pnpm",
            },
          ],
        },
      ]),
    );

    expect(output).toContain(
      "[CONFLICT] package manager in /repo/packages/api",
    );
    expect(output).toContain("AgentContract: FAIL");
    expect(output).toContain("Source: AGENTS.md:2 (npm)");
    expect(output).toContain("Source: packages/api/AGENTS.md:5-7 (pnpm)");
  });

  it("renders blocked commands and captured command details", () => {
    const output = renderConsoleReport(
      createReport([
        createValidatedClaim({
          type: "command_runs",
          command: "git push origin main",
          status: "blocked",
          evidence: ["Command blocked by safety policy."],
          commandResult: {
            command: "git push origin main",
            workingDirectory: "/repo",
            status: "blocked",
            exitCode: null,
            stdout: "",
            stderr: "Command blocked by safety policy.",
            durationMs: 0,
          },
        }),
      ]),
    );

    expect(output).toContain("[BLOCKED] command_runs");
    expect(output).toContain("Command: git push origin main");
    expect(output).toContain("Command status: BLOCKED");
    expect(output).toContain("Exit code: none");
    expect(output).toContain("Stderr:\nCommand blocked by safety policy.");
  });

  it("renders normalized advisory statuses consistently with report totals", () => {
    const output = renderConsoleReport(
      createReport([
        createValidatedClaim({ type: "advisory", status: "failed" }),
      ]),
    );

    expect(output).toContain("AgentContract: PASS");
    expect(output).toContain("[ADVISORY]");
    expect(output).toContain("1 advisory");
    expect(output).not.toContain("[FAIL]");
  });

  it.each([
    [[], "AgentContract: PASS"],
    [[createValidatedClaim({ status: "warning" })], "AgentContract: PASS WITH WARNINGS"],
    [[createValidatedClaim({ status: "failed" })], "AgentContract: FAIL"],
  ] as const)("renders the shared overall status for %#", (claims, expectedLabel) => {
    expect(renderConsoleReport(createReport([...claims]))).toContain(expectedLabel);
  });
});
