import { lstat, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import type {
  InstructionFile,
  InstructionFileName,
} from "../models/instructions.js";
import { InvalidRepositoryError } from "../utils/errors.js";
import { isPathInsideRepository } from "../utils/paths.js";

const OVERRIDE_FILE: InstructionFileName = "AGENTS.override.md";
const STANDARD_FILE: InstructionFileName = "AGENTS.md";

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export function listDirectoriesFromRoot(
  repositoryRoot: string,
  targetDirectory: string,
): string[] {
  if (!isPathInsideRepository(repositoryRoot, targetDirectory)) {
    throw new InvalidRepositoryError(
      `Target directory is outside the Git repository: ${targetDirectory}`,
    );
  }

  const relativeTarget = relative(repositoryRoot, targetDirectory);
  if (relativeTarget === "") {
    return [repositoryRoot];
  }

  const pathSegments = relativeTarget.split(sep);
  const directories = [repositoryRoot];
  let currentDirectory = repositoryRoot;

  for (const segment of pathSegments) {
    currentDirectory = join(currentDirectory, segment);
    directories.push(currentDirectory);
  }

  return directories;
}

async function readNonEmptyInstructionFile(
  directory: string,
  fileName: InstructionFileName,
): Promise<InstructionFile | undefined> {
  const filePath = join(directory, fileName);

  try {
    const fileStats = await lstat(filePath);
    if (!fileStats.isFile()) {
      return undefined;
    }
  } catch (error: unknown) {
    if (isFileSystemError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  const content = await readFile(filePath, "utf8");
  if (content.trim().length === 0) {
    return undefined;
  }

  return {
    path: filePath,
    directory,
    fileName,
    content,
  };
}

async function discoverInstructionInDirectory(
  directory: string,
): Promise<InstructionFile | undefined> {
  const overrideFile = await readNonEmptyInstructionFile(directory, OVERRIDE_FILE);
  if (overrideFile !== undefined) {
    return overrideFile;
  }

  return readNonEmptyInstructionFile(directory, STANDARD_FILE);
}

export async function buildInstructionChain(
  repositoryRoot: string,
  targetDirectory: string,
): Promise<InstructionFile[]> {
  const instructionChain: InstructionFile[] = [];

  for (const directory of listDirectoriesFromRoot(repositoryRoot, targetDirectory)) {
    const instructionFile = await discoverInstructionInDirectory(directory);
    if (instructionFile !== undefined) {
      instructionChain.push(instructionFile);
    }
  }

  return instructionChain;
}
