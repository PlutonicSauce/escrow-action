import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export interface ReferencedPathResolution {
  instructionFilePath: string;
  baseDirectory: string;
  resolvedPath: string;
  resolutionKind: "instruction_directory" | "repository_root";
}

export function isPathInsideRepository(
  repositoryRoot: string,
  candidatePath: string,
): boolean {
  const relativePath = relative(repositoryRoot, candidatePath);

  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

export function getUnsupportedPathReason(reference: string): string | undefined {
  if (reference.length === 0) {
    return "the referenced path is empty";
  }

  if (reference.trim() !== reference) {
    return "leading or trailing whitespace makes the path ambiguous";
  }

  if (reference.includes("\0") || /[\r\n]/u.test(reference)) {
    return "control characters are unsupported";
  }

  if (["*", "?", "[", "]", "{", "}"].some((character) => reference.includes(character))) {
    return "wildcard patterns are unsupported";
  }

  if (reference === "~" || reference.startsWith("~/")) {
    return "home-directory expansion is unsupported";
  }

  if (/\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[^}]*\})/u.test(reference)) {
    return "environment-variable expansion is unsupported";
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(reference)) {
    return "URL-style references are unsupported";
  }

  if (/^[A-Za-z]:[\\/]/u.test(reference)) {
    return "Windows-style absolute paths are unsupported on this platform";
  }

  if (reference.startsWith("//")) {
    return "double-slash absolute paths are ambiguous";
  }

  return undefined;
}

export function resolveReferencedPath(
  repositoryRoot: string,
  sourceFile: string,
  reference: string,
): ReferencedPathResolution {
  const instructionFilePath = isAbsolute(sourceFile)
    ? resolve(sourceFile)
    : resolve(repositoryRoot, sourceFile);
  const baseDirectory = dirname(instructionFilePath);

  if (reference.startsWith("/")) {
    return {
      instructionFilePath,
      baseDirectory,
      resolvedPath: resolve(repositoryRoot, `.${reference}`),
      resolutionKind: "repository_root",
    };
  }

  return {
    instructionFilePath,
    baseDirectory,
    resolvedPath: resolve(baseDirectory, reference),
    resolutionKind: "instruction_directory",
  };
}
