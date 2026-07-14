import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type { ExtractedClaim, ValidatedClaim } from "../models/claims.js";
import { isPathInsideRepository } from "../utils/paths.js";
import {
  findDependencyMapping,
  type DependencyMapping,
} from "./dependencyMappings.js";

export interface DependencyValidationContext {
  repositoryRoot: string;
}

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencySection = (typeof DEPENDENCY_SECTIONS)[number];

type PackageJsonLookup =
  | { outcome: "found"; path: string }
  | { outcome: "missing" }
  | { outcome: "inconclusive"; evidence: string };

interface DependencyMetadata {
  sectionsByDependency: ReadonlyMap<string, readonly DependencySection[]>;
}

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function withValidation(
  claim: ExtractedClaim,
  status: "passed" | "failed" | "inconclusive",
  evidence: string[],
): ValidatedClaim {
  return { ...claim, status, evidence };
}

function formatDependencyList(dependencyNames: readonly string[]): string {
  return dependencyNames.map((name) => `"${name}"`).join(" or ");
}

function mappingEvidence(mapping: DependencyMapping): string {
  return `Mapped framework or tool "${mapping.displayName}" to ${
    mapping.dependencyNames.length === 1 ? "dependency" : "supported dependencies"
  } ${formatDependencyList(mapping.dependencyNames)}.`;
}

function hasCompatibleDependencyMetadata(
  extractedNames: readonly string[],
  mappedNames: readonly string[],
): boolean {
  const extracted = [...new Set(extractedNames)].sort();

  return (
    extracted.length > 0 &&
    extracted.length === extractedNames.length &&
    extracted.every((name) => mappedNames.includes(name))
  );
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

async function readDependencyMetadata(
  packageJsonPath: string,
): Promise<{ metadata?: DependencyMetadata; error?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as unknown;
  } catch (error: unknown) {
    const reason = error instanceof SyntaxError ? "invalid JSON" : "file could not be read";
    return {
      error: `Cannot inspect dependencies in "${packageJsonPath}": ${reason}.`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      error: `Cannot inspect dependencies in "${packageJsonPath}": package.json must contain a JSON object.`,
    };
  }

  const packageData = parsed as Record<string, unknown>;
  const mutableSections = new Map<string, DependencySection[]>();

  for (const section of DEPENDENCY_SECTIONS) {
    const sectionValue = packageData[section];
    if (sectionValue === undefined) {
      continue;
    }
    if (
      typeof sectionValue !== "object" ||
      sectionValue === null ||
      Array.isArray(sectionValue)
    ) {
      return {
        error: `Cannot inspect dependencies in "${packageJsonPath}": ${section} must be a JSON object.`,
      };
    }

    for (const [dependencyName, version] of Object.entries(sectionValue)) {
      if (typeof version !== "string") {
        return {
          error: `Cannot inspect dependencies in "${packageJsonPath}": ${section} entry "${dependencyName}" must be a string.`,
        };
      }

      const sections = mutableSections.get(dependencyName) ?? [];
      sections.push(section);
      mutableSections.set(dependencyName, sections);
    }
  }

  return { metadata: { sectionsByDependency: mutableSections } };
}

export async function validateDependencyClaim(
  claim: ExtractedClaim,
  context: DependencyValidationContext,
): Promise<ValidatedClaim> {
  if (claim.type !== "dependency_present") {
    throw new TypeError(
      `Dependency validator cannot validate claim type: ${claim.type}`,
    );
  }

  const mapping = findDependencyMapping(claim.normalizedValue);
  if (mapping === undefined) {
    return withValidation(claim, "inconclusive", [
      `Cannot safely map framework or tool "${claim.normalizedValue}" to a supported dependency.`,
    ]);
  }

  const mappedEvidence = mappingEvidence(mapping);
  if (
    claim.dependencyNames !== undefined &&
    !hasCompatibleDependencyMetadata(claim.dependencyNames, mapping.dependencyNames)
  ) {
    return withValidation(claim, "inconclusive", [
      mappedEvidence,
      `Extracted dependency metadata (${formatDependencyList(claim.dependencyNames)}) does not match the deterministic mapping.`,
    ]);
  }

  let repositoryRoot: string;
  try {
    repositoryRoot = await realpath(context.repositoryRoot);
    const rootStats = await lstat(repositoryRoot);
    if (!rootStats.isDirectory()) {
      return withValidation(claim, "inconclusive", [
        mappedEvidence,
        `Repository root is not a directory: "${repositoryRoot}".`,
      ]);
    }
  } catch (error: unknown) {
    const reason =
      (isFileSystemError(error) && error.code) || "unknown filesystem error";
    return withValidation(claim, "inconclusive", [
      mappedEvidence,
      `Unable to inspect repository root "${context.repositoryRoot}": ${reason}.`,
    ]);
  }

  const instructionFilePath = isAbsolute(claim.sourceFile)
    ? resolve(claim.sourceFile)
    : resolve(repositoryRoot, claim.sourceFile);
  if (!isPathInsideRepository(repositoryRoot, instructionFilePath)) {
    return withValidation(claim, "failed", [
      mappedEvidence,
      `Rejected source file "${claim.sourceFile}" because it is outside repository root "${repositoryRoot}".`,
    ]);
  }

  const scopeDirectory = isAbsolute(claim.scopeDirectory)
    ? resolve(claim.scopeDirectory)
    : resolve(repositoryRoot, claim.scopeDirectory);
  if (!isPathInsideRepository(repositoryRoot, scopeDirectory)) {
    return withValidation(claim, "failed", [
      mappedEvidence,
      `Rejected claim scope "${claim.scopeDirectory}" because it is outside repository root "${repositoryRoot}".`,
    ]);
  }

  const scopeIssue = await inspectScopeDirectory(repositoryRoot, scopeDirectory);
  if (scopeIssue !== undefined) {
    return withValidation(claim, "inconclusive", [mappedEvidence, scopeIssue]);
  }

  const packageJson = await findNearestPackageJson(repositoryRoot, scopeDirectory);
  if (packageJson.outcome === "missing") {
    return withValidation(claim, "inconclusive", [
      mappedEvidence,
      `No package.json found from claim scope "${scopeDirectory}" through repository root "${repositoryRoot}".`,
    ]);
  }
  if (packageJson.outcome === "inconclusive") {
    return withValidation(claim, "inconclusive", [
      mappedEvidence,
      packageJson.evidence,
    ]);
  }

  const packageEvidence = `Selected nearest package.json "${packageJson.path}" for claim scope "${scopeDirectory}".`;
  const metadataResult = await readDependencyMetadata(packageJson.path);
  if (metadataResult.metadata === undefined) {
    return withValidation(claim, "inconclusive", [
      mappedEvidence,
      packageEvidence,
      metadataResult.error ?? `Unable to inspect dependencies in "${packageJson.path}".`,
    ]);
  }

  for (const dependencyName of mapping.dependencyNames) {
    const sections = metadataResult.metadata.sectionsByDependency.get(dependencyName);
    if (sections !== undefined) {
      return withValidation(claim, "passed", [
        mappedEvidence,
        packageEvidence,
        `Dependency "${dependencyName}" is declared in ${sections.join(" and ")} of "${packageJson.path}".`,
      ]);
    }
  }

  return withValidation(claim, "failed", [
    mappedEvidence,
    packageEvidence,
    `Mapped ${mapping.dependencyNames.length === 1 ? "dependency" : "dependencies"} ${formatDependencyList(mapping.dependencyNames)} for "${mapping.displayName}" ${
      mapping.dependencyNames.length === 1 ? "is" : "are"
    } absent from dependencies, devDependencies, peerDependencies, and optionalDependencies in "${packageJson.path}".`,
  ]);
}
