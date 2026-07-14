import { lstat, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { InvalidRepositoryError } from "../utils/errors.js";

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export async function resolveExistingDirectory(
  directoryPath: string,
  label: "Repository" | "Target",
): Promise<string> {
  const absolutePath = resolve(directoryPath);

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(absolutePath);
  } catch (error: unknown) {
    const reason = isFileSystemError(error) ? error.code : "unknown error";
    throw new InvalidRepositoryError(
      `${label} directory does not exist or cannot be accessed: ${absolutePath} (${reason})`,
    );
  }

  try {
    const directoryStats = await stat(canonicalPath);
    if (!directoryStats.isDirectory()) {
      throw new InvalidRepositoryError(`${label} path is not a directory: ${absolutePath}`);
    }
  } catch (error: unknown) {
    if (error instanceof InvalidRepositoryError) {
      throw error;
    }

    throw new InvalidRepositoryError(
      `${label} directory cannot be inspected: ${absolutePath}`,
    );
  }

  return canonicalPath;
}

async function hasGitMarker(directory: string): Promise<boolean> {
  const markerPath = join(directory, ".git");

  try {
    const markerStats = await lstat(markerPath);
    return markerStats.isDirectory() || markerStats.isFile();
  } catch (error: unknown) {
    if (isFileSystemError(error) && error.code === "ENOENT") {
      return false;
    }

    throw new InvalidRepositoryError(
      `Unable to inspect Git metadata at: ${markerPath}`,
    );
  }
}

export async function findGitRoot(startDirectory: string): Promise<string> {
  const canonicalStart = await resolveExistingDirectory(startDirectory, "Repository");
  let currentDirectory = canonicalStart;

  while (true) {
    if (await hasGitMarker(currentDirectory)) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new InvalidRepositoryError(
        `No Git repository found at or above: ${canonicalStart}`,
      );
    }

    currentDirectory = parentDirectory;
  }
}
