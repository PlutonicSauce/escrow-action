import { isAbsolute, resolve } from "node:path";

import type { InstructionDiscoveryResult } from "../models/instructions.js";
import { InvalidRepositoryError } from "../utils/errors.js";
import { isPathInsideRepository } from "../utils/paths.js";
import { buildInstructionChain } from "./buildInstructionChain.js";
import { findGitRoot, resolveExistingDirectory } from "./findGitRoot.js";

export interface DiscoverInstructionsOptions {
  repository: string;
  target?: string;
}

export async function discoverInstructions(
  options: DiscoverInstructionsOptions,
): Promise<InstructionDiscoveryResult> {
  const repositoryDirectory = await resolveExistingDirectory(
    options.repository,
    "Repository",
  );
  const repositoryRoot = await findGitRoot(repositoryDirectory);

  const targetCandidate =
    options.target === undefined
      ? repositoryDirectory
      : isAbsolute(options.target)
        ? options.target
        : resolve(repositoryRoot, options.target);

  const resolvedTargetCandidate = resolve(targetCandidate);
  if (
    options.target !== undefined &&
    !isAbsolute(options.target) &&
    !isPathInsideRepository(repositoryRoot, resolvedTargetCandidate)
  ) {
    throw new InvalidRepositoryError(
      `Target directory is outside the Git repository: ${resolvedTargetCandidate}`,
    );
  }

  const targetDirectory = await resolveExistingDirectory(targetCandidate, "Target");

  if (!isPathInsideRepository(repositoryRoot, targetDirectory)) {
    throw new InvalidRepositoryError(
      `Target directory is outside the Git repository: ${targetDirectory}`,
    );
  }

  const instructionChain = await buildInstructionChain(
    repositoryRoot,
    targetDirectory,
  );

  return {
    repositoryRoot,
    targetDirectory,
    instructionChain,
  };
}
