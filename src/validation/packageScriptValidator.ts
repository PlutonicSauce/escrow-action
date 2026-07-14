import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type { ExtractedClaim, PackageManager, ValidatedClaim } from "../models/claims.js";
import {
  findSimilarPackageScript,
  normalizePackageScriptCommand,
} from "../utils/packageCommands.js";
import { isPathInsideRepository } from "../utils/paths.js";

export interface PackageScriptValidationContext {
  repositoryRoot: string;
}

interface ReferencedScript {
  script: string;
  evidence: string;
}

type PackageJsonLookup =
  | { outcome: "found"; path: string }
  | { outcome: "missing" }
  | { outcome: "inconclusive"; evidence: string };

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withValidation(
  claim: ExtractedClaim,
  status: "passed" | "failed" | "inconclusive",
  evidence: string[],
  suggestion?: string,
): ValidatedClaim {
  return suggestion === undefined
    ? { ...claim, status, evidence }
    : { ...claim, status, evidence, suggestion };
}

function identifyReferencedScript(
  claim: ExtractedClaim,
): { result?: ReferencedScript; error?: string } {
  if (claim.command !== undefined) {
    const normalization = normalizePackageScriptCommand(claim.command);
    if (!normalization.success) {
      return {
        error: `Cannot identify a package script from command "${claim.command}": ${normalization.reason}.`,
      };
    }

    const { packageManager, script } = normalization.command;
    if (
      claim.packageManager !== undefined &&
      claim.packageManager !== packageManager
    ) {
      return {
        error: `Package-manager metadata declares ${claim.packageManager}, but command "${claim.command}" uses ${packageManager}.`,
      };
    }
    if (claim.packageScript !== undefined && claim.packageScript !== script) {
      return {
        error: `Package-script metadata declares "${claim.packageScript}", but command "${claim.command}" references "${script}".`,
      };
    }

    return {
      result: {
        script,
        evidence: `Normalized package command "${claim.command}" to ${packageManager} script "${script}".`,
      },
    };
  }

  if (claim.packageScript === undefined) {
    return { error: `Package-script claim "${claim.id}" has no command or packageScript value.` };
  }
  if (
    claim.packageScript.length === 0 ||
    claim.packageScript.trim() !== claim.packageScript ||
    /[\r\n\0]/u.test(claim.packageScript)
  ) {
    return {
      error: `Package-script metadata "${claim.packageScript}" is empty or ambiguous.`,
    };
  }

  return {
    result: {
      script: claim.packageScript,
      evidence: `Used extracted package script "${claim.packageScript}".`,
    },
  };
}

async function inspectScopeDirectory(
  repositoryRoot: string,
  scopeDirectory: string,
): Promise<string | undefined> {
  const relativeScope = relative(repositoryRoot, scopeDirectory);
  if (relativeScope === "") {
    return undefined;
  }

  let currentDirectory = repositoryRoot;
  for (const segment of relativeScope.split(sep)) {
    currentDirectory = join(currentDirectory, segment);
    try {
      const stats = await lstat(currentDirectory);
      if (stats.isSymbolicLink()) {
        return `Claim scope crosses a symbolic link at "${currentDirectory}".`;
      }
      if (!stats.isDirectory()) {
        return `Claim scope component is not a directory: "${currentDirectory}".`;
      }
    } catch (error: unknown) {
      const reason =
        (isFileSystemError(error) && error.code) || "unknown filesystem error";
      return `Unable to inspect claim scope "${currentDirectory}": ${reason}.`;
    }
  }

  return undefined;
}

async function findNearestPackageJson(
  repositoryRoot: string,
  scopeDirectory: string,
): Promise<PackageJsonLookup> {
  let currentDirectory = scopeDirectory;

  while (true) {
    const packageJsonPath = join(currentDirectory, "package.json");
    try {
      const stats = await lstat(packageJsonPath);
      if (stats.isSymbolicLink()) {
        return {
          outcome: "inconclusive",
          evidence: `Nearest package.json is a symbolic link and was not followed: "${packageJsonPath}".`,
        };
      }
      if (!stats.isFile()) {
        return {
          outcome: "inconclusive",
          evidence: `Nearest package.json is not a regular file: "${packageJsonPath}".`,
        };
      }

      return { outcome: "found", path: packageJsonPath };
    } catch (error: unknown) {
      if (!isFileSystemError(error) || error.code !== "ENOENT") {
        const reason =
          (isFileSystemError(error) && error.code) || "unknown filesystem error";
        return {
          outcome: "inconclusive",
          evidence: `Unable to inspect package.json "${packageJsonPath}": ${reason}.`,
        };
      }
    }

    if (currentDirectory === repositoryRoot) {
      return { outcome: "missing" };
    }
    currentDirectory = dirname(currentDirectory);
  }
}

async function readScripts(
  packageJsonPath: string,
): Promise<{ scripts?: Record<string, string>; error?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as unknown;
  } catch (error: unknown) {
    const reason = error instanceof SyntaxError ? "invalid JSON" : "file could not be read";
    return { error: `Cannot inspect scripts in "${packageJsonPath}": ${reason}.` };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: `Cannot inspect scripts in "${packageJsonPath}": package.json must contain a JSON object.` };
  }

  const scriptsValue = (parsed as Record<string, unknown>).scripts;
  if (scriptsValue === undefined) {
    return { scripts: {} };
  }
  if (
    typeof scriptsValue !== "object" ||
    scriptsValue === null ||
    Array.isArray(scriptsValue)
  ) {
    return { error: `Cannot inspect scripts in "${packageJsonPath}": scripts must be a JSON object.` };
  }

  const scripts: Record<string, string> = {};
  for (const [name, value] of Object.entries(scriptsValue)) {
    if (typeof value !== "string") {
      return {
        error: `Cannot inspect scripts in "${packageJsonPath}": script "${name}" must be a string.`,
      };
    }
    scripts[name] = value;
  }

  return { scripts };
}

export async function validatePackageScriptClaim(
  claim: ExtractedClaim,
  context: PackageScriptValidationContext,
): Promise<ValidatedClaim> {
  if (claim.type !== "package_script") {
    throw new TypeError(
      `Package-script validator cannot validate claim type: ${claim.type}`,
    );
  }

  const identified = identifyReferencedScript(claim);
  if (identified.result === undefined) {
    return withValidation(claim, "inconclusive", [
      identified.error ?? `Unable to identify package script for claim "${claim.id}".`,
    ]);
  }

  let repositoryRoot: string;
  try {
    repositoryRoot = await realpath(context.repositoryRoot);
    const rootStats = await lstat(repositoryRoot);
    if (!rootStats.isDirectory()) {
      return withValidation(claim, "inconclusive", [
        identified.result.evidence,
        `Repository root is not a directory: "${repositoryRoot}".`,
      ]);
    }
  } catch (error: unknown) {
    const reason =
      (isFileSystemError(error) && error.code) || "unknown filesystem error";
    return withValidation(claim, "inconclusive", [
      identified.result.evidence,
      `Unable to inspect repository root "${context.repositoryRoot}": ${reason}.`,
    ]);
  }

  const instructionFilePath = isAbsolute(claim.sourceFile)
    ? resolve(claim.sourceFile)
    : resolve(repositoryRoot, claim.sourceFile);
  if (!isPathInsideRepository(repositoryRoot, instructionFilePath)) {
    return withValidation(claim, "failed", [
      identified.result.evidence,
      `Rejected source file "${claim.sourceFile}" because it is outside repository root "${repositoryRoot}".`,
    ]);
  }

  const scopeDirectory = isAbsolute(claim.scopeDirectory)
    ? resolve(claim.scopeDirectory)
    : resolve(repositoryRoot, claim.scopeDirectory);
  if (!isPathInsideRepository(repositoryRoot, scopeDirectory)) {
    return withValidation(claim, "failed", [
      identified.result.evidence,
      `Rejected claim scope "${claim.scopeDirectory}" because it is outside repository root "${repositoryRoot}".`,
    ]);
  }

  const scopeIssue = await inspectScopeDirectory(repositoryRoot, scopeDirectory);
  if (scopeIssue !== undefined) {
    return withValidation(claim, "inconclusive", [
      identified.result.evidence,
      scopeIssue,
    ]);
  }

  const packageJson = await findNearestPackageJson(repositoryRoot, scopeDirectory);
  if (packageJson.outcome === "missing") {
    return withValidation(claim, "inconclusive", [
      identified.result.evidence,
      `No package.json found from claim scope "${scopeDirectory}" through repository root "${repositoryRoot}".`,
    ]);
  }
  if (packageJson.outcome === "inconclusive") {
    return withValidation(claim, "inconclusive", [
      identified.result.evidence,
      packageJson.evidence,
    ]);
  }

  const scriptsResult = await readScripts(packageJson.path);
  const packageEvidence = `Selected nearest package.json "${packageJson.path}" for claim scope "${scopeDirectory}".`;
  if (scriptsResult.scripts === undefined) {
    return withValidation(claim, "inconclusive", [
      identified.result.evidence,
      packageEvidence,
      scriptsResult.error ?? `Unable to inspect scripts in "${packageJson.path}".`,
    ]);
  }

  if (Object.hasOwn(scriptsResult.scripts, identified.result.script)) {
    return withValidation(claim, "passed", [
      identified.result.evidence,
      packageEvidence,
      `Package script "${identified.result.script}" exists in "${packageJson.path}".`,
    ]);
  }

  const similarScript = findSimilarPackageScript(
    identified.result.script,
    Object.keys(scriptsResult.scripts),
  );
  return withValidation(
    claim,
    "failed",
    [
      identified.result.evidence,
      packageEvidence,
      `Package script "${identified.result.script}" does not exist in "${packageJson.path}".`,
    ],
    similarScript === undefined
      ? undefined
      : `Did you mean package script "${similarScript}"?`,
  );
}
