#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const [reportPath, expectedExitCode] = process.argv.slice(2);
if (reportPath === undefined || expectedExitCode === undefined) throw new Error("Usage: verify-ci-report.mjs <report.json> <escrow-exit-code>");
const exitCode = Number(expectedExitCode);
if (!Number.isInteger(exitCode)) throw new Error(`Escrow returned an invalid exit code: ${expectedExitCode}`);
try {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (exitCode !== 0) {
    console.error(`Escrow failed with exit code ${exitCode} (overall status: ${report.overallStatus ?? "unknown"}).`);
    process.exitCode = exitCode;
  } else if (report.overallStatus !== "pass") {
    console.error(`Escrow exited successfully but reported ${report.overallStatus ?? "an unknown status"}.`);
    process.exitCode = 4;
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Escrow did not produce a valid JSON report: ${reason}`);
  process.exitCode = exitCode === 0 ? 4 : exitCode;
}
