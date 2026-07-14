import type { ClaimStatus } from "../models/claims.js";
import type {
  OverallStatus,
  ReportSummary,
} from "../models/reports.js";

export const OVERALL_STATUS_LABELS: Record<OverallStatus, string> = {
  pass: "PASS",
  fail: "FAIL",
  pass_with_warnings: "PASS WITH WARNINGS",
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  passed: "PASS",
  failed: "FAIL",
  warning: "WARNING",
  blocked: "BLOCKED",
  inconclusive: "INCONCLUSIVE",
  advisory: "ADVISORY",
  overridden: "OVERRIDDEN",
};

export const SUMMARY_FIELDS = [
  { key: "passed", label: "Passed" },
  { key: "failed", label: "Failed" },
  { key: "warnings", label: "Warnings" },
  { key: "blocked", label: "Blocked" },
  { key: "inconclusive", label: "Inconclusive" },
  { key: "advisory", label: "Advisory" },
  { key: "overridden", label: "Overridden" },
] as const satisfies readonly {
  key: keyof ReportSummary;
  label: string;
}[];

export function formatSourceLocation(
  sourceFile: string,
  lineStart: number,
  lineEnd: number,
): string {
  return lineStart === lineEnd
    ? `${sourceFile}:${String(lineStart)}`
    : `${sourceFile}:${String(lineStart)}-${String(lineEnd)}`;
}

export function formatTypeLabel(type: string): string {
  return type.replaceAll("_", " ");
}
