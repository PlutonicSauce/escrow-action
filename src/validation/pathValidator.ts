import { lstat, realpath } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import type { ExtractedClaim, ValidatedClaim } from "../models/claims.js";
import {
  getUnsupportedPathReason,
  isPathInsideRepository,
  resolveReferencedPath,
  type ReferencedPathResolution,
} from "../utils/paths.js";

export interface PathValidationContext {
  repositoryRoot: string;
}

type PathEntryKind = "directory" | "file";

type PathInspection =
  | { outcome: "exists"; kind: PathEntryKind }
  | { outcome: "missing" }
  | { outcome: "unsupported"; reason: string }
  | { outcome: "unreadable"; reason: string };

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

function resolutionEvidence(resolution: ReferencedPathResolution, reference: string): string {
  if (resolution.resolutionKind === "repository_root") {
    return `Resolved repository-root-relative path "${reference}" to "${resolution.resolvedPath}".`;
  }

  return `Resolved path "${reference}" from instruction directory "${resolution.baseDirectory}" to "${resolution.resolvedPath}".`;
}

async function inspectRepositoryPath(
  repositoryRoot: string,
  candidatePath: string,
): Promise<PathInspection> {
  const relativeCandidate = relative(repositoryRoot, candidatePath);
  if (relativeCandidate === "") {
    return { outcome: "exists", kind: "directory" };
  }

  const segments = relativeCandidate.split(sep);
  let currentPath = repositoryRoot;

  for (const [index, segment] of segments.entries()) {
    currentPath = join(currentPath, segment);

    let entryStats;
    try {
      entryStats = await lstat(currentPath);
    } catch (error: unknown) {
      if (
        isFileSystemError(error) &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      ) {
        return { outcome: "missing" };
      }

      const reason =
        (isFileSystemError(error) && error.code) || "unknown filesystem error";
      return { outcome: "unreadable", reason };
    }

    if (entryStats.isSymbolicLink()) {
      return {
        outcome: "unsupported",
        reason: `symbolic link encountered at "${currentPath}"`,
      };
    }

    const isFinalSegment = index === segments.length - 1;
    if (!isFinalSegment && !entryStats.isDirectory()) {
      return { outcome: "missing" };
    }

    if (isFinalSegment) {
      if (entryStats.isFile()) {
        return { outcome: "exists", kind: "file" };
      }

      if (entryStats.isDirectory()) {
        return { outcome: "exists", kind: "directory" };
      }

      return {
        outcome: "unsupported",
        reason: `repository entry is neither a regular file nor a directory: "${currentPath}"`,
      };
    }
  }

  return { outcome: "missing" };
}

export async function validatePathClaim(
  claim: ExtractedClaim,
  context: PathValidationContext,
): Promise<ValidatedClaim> {
  if (claim.type !== "path_exists") {
    throw new TypeError(`Path validator cannot validate claim type: ${claim.type}`);
  }

  const reference = claim.referencedPath;
  if (reference === undefined) {
    return withValidation(claim, "inconclusive", [
      `Path claim "${claim.id}" has no referencedPath value.`,
    ]);
  }

  const unsupportedReason = getUnsupportedPathReason(reference);
  if (unsupportedReason !== undefined) {
    return withValidation(claim, "inconclusive", [
      `Cannot validate referenced path "${reference}": ${unsupportedReason}.`,
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

  const resolution = resolveReferencedPath(
    repositoryRoot,
    claim.sourceFile,
    reference,
  );

  if (!isPathInsideRepository(repositoryRoot, resolution.instructionFilePath)) {
    return withValidation(claim, "failed", [
      `Rejected source file "${claim.sourceFile}" because it is outside repository root "${repositoryRoot}".`,
    ]);
  }

  if (!isPathInsideRepository(repositoryRoot, resolution.resolvedPath)) {
    return withValidation(claim, "failed", [
      resolutionEvidence(resolution, reference),
      `Rejected referenced path because it resolves outside repository root "${repositoryRoot}".`,
    ]);
  }

  const evidence = [resolutionEvidence(resolution, reference)];
  const inspection = await inspectRepositoryPath(repositoryRoot, resolution.resolvedPath);

  switch (inspection.outcome) {
    case "exists":
      return withValidation(claim, "passed", [
        ...evidence,
        `Repository path exists and is a ${inspection.kind}: "${resolution.resolvedPath}".`,
      ]);
    case "missing":
      return withValidation(claim, "failed", [
        ...evidence,
        `Repository path does not exist: "${resolution.resolvedPath}".`,
      ]);
    case "unsupported":
      return withValidation(claim, "inconclusive", [
        ...evidence,
        `Path inspection is inconclusive: ${inspection.reason}.`,
      ]);
    case "unreadable":
      return withValidation(claim, "inconclusive", [
        ...evidence,
        `Unable to inspect repository path "${resolution.resolvedPath}": ${inspection.reason}.`,
      ]);
  }
}
