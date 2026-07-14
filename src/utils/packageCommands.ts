import type { PackageManager } from "../models/claims.js";

export interface NormalizedPackageScriptCommand {
  packageManager: PackageManager;
  script: string;
}

export type PackageCommandNormalizationResult =
  | { success: true; command: NormalizedPackageScriptCommand }
  | { success: false; reason: string };

const SHELL_SYNTAX_PATTERN = /[;&|<>`$\\\r\n\0]/u;

function normalizedCommand(
  packageManager: PackageManager,
  script: string,
): PackageCommandNormalizationResult {
  if (script.length === 0 || script.startsWith("-")) {
    return {
      success: false,
      reason: `unsupported package-script name "${script}"`,
    };
  }

  return { success: true, command: { packageManager, script } };
}

function tokenizePackageCommand(
  command: string,
): { tokens?: string[]; reason?: string } {
  const tokens: string[] = [];
  let currentToken = "";
  let tokenStarted = false;
  let quote: '"' | "'" | undefined;

  for (const character of command) {
    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      } else {
        currentToken += character;
      }
      tokenStarted = true;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      tokenStarted = true;
    } else if (/\s/u.test(character)) {
      if (tokenStarted) {
        tokens.push(currentToken);
        currentToken = "";
        tokenStarted = false;
      }
    } else {
      currentToken += character;
      tokenStarted = true;
    }
  }

  if (quote !== undefined) {
    return { reason: "the command contains an unmatched quote" };
  }
  if (tokenStarted) {
    tokens.push(currentToken);
  }

  return { tokens };
}

export function normalizePackageScriptCommand(
  command: string,
): PackageCommandNormalizationResult {
  if (command.length === 0 || command.trim() !== command) {
    return {
      success: false,
      reason: "the command is empty or has ambiguous surrounding whitespace",
    };
  }

  if (SHELL_SYNTAX_PATTERN.test(command)) {
    return {
      success: false,
      reason: "shell operators, expansions, and escapes are unsupported",
    };
  }

  const tokenization = tokenizePackageCommand(command);
  if (tokenization.tokens === undefined) {
    return {
      success: false,
      reason: tokenization.reason ?? "the command could not be tokenized",
    };
  }

  const tokens = tokenization.tokens;
  const manager = tokens[0];

  if (manager === "npm") {
    if (tokens.length >= 2 && tokens[1] === "test") {
      return normalizedCommand("npm", "test");
    }
    if (tokens.length >= 3 && tokens[1] === "run" && tokens[2] !== undefined) {
      return normalizedCommand("npm", tokens[2]);
    }

    return {
      success: false,
      reason: "supported npm forms are `npm test` and `npm run <script>`",
    };
  }

  if (manager === "pnpm" || manager === "yarn") {
    if (tokens.length >= 2 && tokens[1] !== undefined && tokens[1] !== "run") {
      return normalizedCommand(manager, tokens[1]);
    }
    if (tokens.length >= 3 && tokens[1] === "run" && tokens[2] !== undefined) {
      return normalizedCommand(manager, tokens[2]);
    }

    return {
      success: false,
      reason: `supported ${manager} forms are \`${manager} <script>\` and \`${manager} run <script>\``,
    };
  }

  return {
    success: false,
    reason: "only npm, pnpm, and yarn package-script commands are supported",
  };
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index] ?? 0;
    }
  }

  return previous[right.length] ?? 0;
}

interface SimilarityCandidate {
  name: string;
  prefixRelated: boolean;
  distance: number;
}

export function findSimilarPackageScript(
  target: string,
  availableScripts: readonly string[],
): string | undefined {
  const candidates: SimilarityCandidate[] = [];

  for (const name of availableScripts) {
    if (name === target) {
      continue;
    }

    const prefixRelated =
      name.startsWith(`${target}:`) || target.startsWith(`${name}:`);
    const distance = levenshteinDistance(target, name);
    const threshold = Math.max(2, Math.floor(Math.max(target.length, name.length) * 0.3));

    if (prefixRelated || distance <= threshold) {
      candidates.push({ name, prefixRelated, distance });
    }
  }

  candidates.sort((left, right) => {
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    if (left.prefixRelated !== right.prefixRelated) {
      return left.prefixRelated ? -1 : 1;
    }
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
  });

  return candidates[0]?.name;
}
