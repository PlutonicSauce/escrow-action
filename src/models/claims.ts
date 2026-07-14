export const CLAIM_TYPES = [
  "path_exists",
  "package_manager",
  "package_script",
  "dependency_present",
  "command_runs",
  "advisory",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_STATUSES = [
  "passed",
  "failed",
  "warning",
  "blocked",
  "inconclusive",
  "advisory",
  "overridden",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn"] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const REPOSITORY_INCONSISTENCY_KINDS = ["package_manager"] as const;

export type RepositoryInconsistencyKind =
  (typeof REPOSITORY_INCONSISTENCY_KINDS)[number];

export interface RepositoryInconsistency {
  kind: RepositoryInconsistencyKind;
  message: string;
  evidence: string[];
}

export interface ExtractedClaim {
  id: string;
  type: ClaimType;
  sourceFile: string;
  lineStart: number;
  lineEnd: number;
  originalText: string;
  normalizedValue: string;
  scopeDirectory: string;
  command?: string | undefined;
  referencedPath?: string | undefined;
  packageManager?: PackageManager | undefined;
  packageScript?: string | undefined;
  dependencyNames?: string[] | undefined;
  confidence: number;
  extractionReason: string;
}

export const COMMAND_RESULT_STATUSES = [
  "passed",
  "failed",
  "blocked",
  "inconclusive",
] as const;

export type CommandResultStatus = (typeof COMMAND_RESULT_STATUSES)[number];

export interface BranchCommandResult {
  command: string;
  workingDirectory: string;
  status: CommandResultStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface ValidatedClaim extends ExtractedClaim {
  status: ClaimStatus;
  evidence: string[];
  repositoryInconsistencies?: RepositoryInconsistency[] | undefined;
  suggestion?: string | undefined;
  commandResult?: BranchCommandResult | undefined;
}
