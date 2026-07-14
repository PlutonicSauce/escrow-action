import type { AgentContractReport } from "../models/reports.js";

export function renderJsonReport(report: AgentContractReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
