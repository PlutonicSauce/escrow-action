import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  PACKAGE_MANAGERS,
  type ExtractedClaim,
  type PackageManager,
  type RepositoryInconsistency,
  type ValidatedClaim,
} from "../models/claims.js";
import { isPathInsideRepository } from "../utils/paths.js";

export interface PackageManagerValidationContext {
  repositoryRoot: string;
}

type PackageManagerSignalKind = "lockfile" | "metadata";

interface PackageManagerSignal {
  manager: PackageManager;
  kind: PackageManagerSignalKind;
  description: string;
}

interface ScopeInspection {
  directory: string;
  signals: PackageManagerSignal[];
  issues: string[];
}

interface EntryInspection {
  outcome: "file" | "missing" | "unsupported" | "unreadable";
  reason?: string;
}

const LOCKFILE_MANAGERS = [
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
] as const satisfies readonly (readonly [string, PackageManager])[];

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withValidation(
  claim: ExtractedClaim,
  status: "passed" | "failed" | "warning" | "inconclusive",
  evidence: string[],
  repositoryInconsistencies: RepositoryInconsistency[] = [],
): ValidatedClaim {
  return repositoryInconsistencies.length === 0
    ? { ...claim, status, evidence }
    : { ...claim, status, evidence, repositoryInconsistencies };
}

async function inspectRegularFile(filePath: string): Promise<EntryInspection> {
  try {
    const stats = await lstat(filePath);
    if (stats.isSymbolicLink()) {
      return { outcome: "unsupported", reason: "symbolic links are unsupported" };
    }

    return stats.isFile()
      ? { outcome: "file" }
      : { outcome: "unsupported", reason: "the entry is not a regular file" };
  } catch (error: unknown) {
    if (isFileSystemError(error) && error.code === "ENOENT") {
      return { outcome: "missing" };
    }

    return {
      outcome: "unreadable",
      reason:
        (isFileSystemError(error) && error.code) || "unknown filesystem error",
    };
  }
}

async function inspectDirectoryChain(
  repositoryRoot: string,
  directory: string,
): Promise<string | undefined> {
  const relativeDirectory = relative(repositoryRoot, directory);
  if (relativeDirectory === "") {
    return undefined;
  }

  let currentDirectory = repositoryRoot;
  for (const segment of relativeDirectory.split(sep)) {
    currentDirectory = join(currentDirectory, segment);
    try {
      const stats = await lstat(currentDirectory);
      if (stats.isSymbolicLink()) {
        return `Instruction directory crosses a symbolic link at "${currentDirectory}".`;
      }
      if (!stats.isDirectory()) {
        return `Instruction directory component is not a directory: "${currentDirectory}".`;
      }
    } catch (error: unknown) {
      const reason =
        (isFileSystemError(error) && error.code) || "unknown filesystem error";
      return `Unable to inspect instruction directory "${currentDirectory}": ${reason}.`;
    }
  }

  return undefined;
}

function parsePackageManagerValue(value: string): PackageManager | undefined {
  if (value.trim() !== value || value.length === 0 || /\s/u.test(value)) {
    return undefined;
  }

  const separatorIndex = value.indexOf("@");
  const managerName = separatorIndex === -1 ? value : value.slice(0, separatorIndex);
  const version = separatorIndex === -1 ? undefined : value.slice(separatorIndex + 1);

  if (version !== undefined && version.length === 0) {
    return undefined;
  }

  return PACKAGE_MANAGERS.find((manager) => manager === managerName);
}

async function inspectPackageJson(
  packageJsonPath: string,
): Promise<{ signal?: PackageManagerSignal; issue?: string; establishesScope: boolean }> {
  const entry = await inspectRegularFile(packageJsonPath);
  if (entry.outcome === "missing") {
    return { establishesScope: false };
  }
  if (entry.outcome !== "file") {
    return {
      establishesScope: true,
      issue: `Cannot inspect package-manager metadata at "${packageJsonPath}": ${entry.reason}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as unknown;
  } catch (error: unknown) {
    const reason = error instanceof SyntaxError ? "invalid JSON" : "file could not be read";
    return {
      establishesScope: true,
      issue: `Cannot inspect package-manager metadata at "${packageJsonPath}": ${reason}.`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      establishesScope: true,
      issue: `Cannot inspect package-manager metadata at "${packageJsonPath}": package.json must contain a JSON object.`,
    };
  }

  const packageManagerValue = (parsed as Record<string, unknown>).packageManager;
  if (packageManagerValue === undefined) {
    return { establishesScope: false };
  }
  if (typeof packageManagerValue !== "string") {
    return {
      establishesScope: true,
      issue: `Cannot inspect package-manager metadata at "${packageJsonPath}": packageManager must be a string.`,
    };
  }

  const manager = parsePackageManagerValue(packageManagerValue);
  if (manager === undefined) {
    return {
      establishesScope: true,
      issue: `Unsupported or malformed packageManager value "${packageManagerValue}" at "${packageJsonPath}".`,
    };
  }

  return {
    establishesScope: true,
    signal: {
      manager,
      kind: "metadata",
      description: `Detected ${manager} from package.json#packageManager "${packageManagerValue}" at "${packageJsonPath}".`,
    },
  };
}

async function inspectScope(directory: string): Promise<ScopeInspection> {
  const signals: PackageManagerSignal[] = [];
  const issues: string[] = [];
  let lockfileEstablishesScope = false;

  for (const [fileName, manager] of LOCKFILE_MANAGERS) {
    const lockfilePath = join(directory, fileName);
    const entry = await inspectRegularFile(lockfilePath);
    if (entry.outcome === "file") {
      lockfileEstablishesScope = true;
      signals.push({
        manager,
        kind: "lockfile",
        description: `Detected ${manager} from lockfile "${lockfilePath}".`,
      });
    } else if (entry.outcome !== "missing") {
      lockfileEstablishesScope = true;
      issues.push(`Cannot use lockfile "${lockfilePath}": ${entry.reason}.`);
    }
  }

  const packageJson = await inspectPackageJson(join(directory, "package.json"));
  if (packageJson.signal !== undefined) {
    signals.push(packageJson.signal);
  }
  if (packageJson.issue !== undefined) {
    issues.push(packageJson.issue);
  }

  return {
    directory,
    signals,
    issues:
      lockfileEstablishesScope || packageJson.establishesScope ? issues : [],
  };
}

async function findApplicableScope(
  repositoryRoot: string,
  instructionDirectory: string,
): Promise<ScopeInspection> {
  let currentDirectory = instructionDirectory;

  while (true) {
    const inspection = await inspectScope(currentDirectory);
    if (inspection.signals.length > 0 || inspection.issues.length > 0) {
      return inspection;
    }

    if (currentDirectory === repositoryRoot) {
      return inspection;
    }

    currentDirectory = dirname(currentDirectory);
  }
}

function createRepositoryInconsistencies(
  inspection: ScopeInspection,
): RepositoryInconsistency[] {
  const lockfileSignals = inspection.signals.filter(
    (signal) => signal.kind === "lockfile",
  );
  const lockfileManagers = new Set(lockfileSignals.map((signal) => signal.manager));
  const metadataSignal = inspection.signals.find(
    (signal) => signal.kind === "metadata",
  );
  const inconsistencies: RepositoryInconsistency[] = [];

  if (lockfileSignals.length > 1) {
    inconsistencies.push({
      kind: "package_manager",
      message: `Multiple package-manager lockfile types were found in "${inspection.directory}".`,
      evidence: lockfileSignals.map((signal) => signal.description),
    });
  }

  if (
    metadataSignal !== undefined &&
    lockfileManagers.size > 0 &&
    !lockfileManagers.has(metadataSignal.manager)
  ) {
    inconsistencies.push({
      kind: "package_manager",
      message: `Lockfile evidence conflicts with package.json#packageManager in "${inspection.directory}".`,
      evidence: [
        ...lockfileSignals.map((signal) => signal.description),
        metadataSignal.description,
      ],
    });
  }

  return inconsistencies;
}

export async function validatePackageManagerClaim(
  claim: ExtractedClaim,
  context: PackageManagerValidationContext,
): Promise<ValidatedClaim> {
  if (claim.type !== "package_manager") {
    throw new TypeError(
      `Package-manager validator cannot validate claim type: ${claim.type}`,
    );
  }

  if (claim.packageManager === undefined) {
    return withValidation(claim, "inconclusive", [
      `Package-manager claim "${claim.id}" has no packageManager value.`,
    ]);
  }

  let repositoryRoot: string;
  try {
    repositoryRoot = await realpath(context.repositoryRoot);
    const rootStats = await lstat(repositoryRoot);
    if (!rootStats.isDirectory()) {
      return withValidation(claim, "inconclusive", [
        `Repository root is not a directory: "${repositoryRoot}".`,
      ]);
    }
  } catch (error: unknown) {
    const reason =
      (isFileSystemError(error) && error.code) || "unknown filesystem error";
    return withValidation(claim, "inconclusive", [
      `Unable to inspect repository root "${context.repositoryRoot}": ${reason}.`,
    ]);
  }

  const instructionFilePath = isAbsolute(claim.sourceFile)
    ? resolve(claim.sourceFile)
    : resolve(repositoryRoot, claim.sourceFile);
  if (!isPathInsideRepository(repositoryRoot, instructionFilePath)) {
    return withValidation(claim, "failed", [
      `Rejected source file "${claim.sourceFile}" because it is outside repository root "${repositoryRoot}".`,
    ]);
  }

  const instructionDirectory = dirname(instructionFilePath);
  const directoryIssue = await inspectDirectoryChain(
    repositoryRoot,
    instructionDirectory,
  );
  if (directoryIssue !== undefined) {
    return withValidation(claim, "inconclusive", [directoryIssue]);
  }

  const inspection = await findApplicableScope(repositoryRoot, instructionDirectory);
  const scopeEvidence = `Selected package-manager scope "${inspection.directory}".`;
  if (inspection.issues.length > 0) {
    return withValidation(claim, "inconclusive", [
      scopeEvidence,
      ...inspection.signals.map((signal) => signal.description),
      ...inspection.issues,
    ]);
  }

  if (inspection.signals.length === 0) {
    return withValidation(claim, "inconclusive", [
      `No reliable package-manager evidence found from instruction directory "${instructionDirectory}" through repository root "${repositoryRoot}".`,
    ]);
  }

  const inconsistencies = createRepositoryInconsistencies(inspection);
  const evidence = [
    scopeEvidence,
    ...inspection.signals.map((signal) => signal.description),
  ];
  if (inconsistencies.length > 0) {
    return withValidation(claim, "warning", evidence, inconsistencies);
  }

  const detectedManager = inspection.signals[0]!.manager;
  if (detectedManager === claim.packageManager) {
    return withValidation(claim, "passed", [
      ...evidence,
      `Instruction and repository evidence agree on ${claim.packageManager}.`,
    ]);
  }

  return withValidation(claim, "failed", [
    ...evidence,
    `Instruction declares ${claim.packageManager}, but repository evidence indicates ${detectedManager}.`,
  ]);
}
