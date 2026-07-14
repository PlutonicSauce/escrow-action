import { isAbsolute, relative, resolve, sep } from "node:path";

import type { ExtractedClaim, PackageManager, ValidatedClaim } from "../models/claims.js";
import type {
  ConflictingClaimSource,
  InstructionConflict,
  InstructionConflictType,
} from "../models/conflicts.js";
import { normalizePackageScriptCommand } from "../utils/packageCommands.js";
import { isPathInsideRepository } from "../utils/paths.js";

export interface ConflictAnalysisContext {
  repositoryRoot: string;
  targetDirectory: string;
}

export interface EffectiveClaimScope {
  claimId: string;
  scopeDirectory: string;
  targetDirectory: string;
  applicable: boolean;
  specificity: number;
}

export interface ConflictAnalysisResult {
  claims: ValidatedClaim[];
  conflicts: InstructionConflict[];
  scopes: EffectiveClaimScope[];
}

interface ComparableClaim {
  claim: ValidatedClaim;
  inputIndex: number;
  type: InstructionConflictType;
  relationshipKey: string;
  value: string;
  valueLabel: string;
  scope: EffectiveClaimScope;
}

function absoluteRepositoryPath(repositoryRoot: string, path: string): string {
  return resolve(isAbsolute(path) ? path : resolve(repositoryRoot, path));
}

function pathSpecificity(repositoryRoot: string, path: string): number {
  const pathFromRoot = relative(repositoryRoot, path);
  return pathFromRoot === "" ? 0 : pathFromRoot.split(sep).length;
}

export function resolveEffectiveClaimScope(
  claim: ExtractedClaim,
  context: ConflictAnalysisContext,
): EffectiveClaimScope {
  const repositoryRoot = resolve(context.repositoryRoot);
  const targetDirectory = absoluteRepositoryPath(
    repositoryRoot,
    context.targetDirectory,
  );
  const scopeDirectory = absoluteRepositoryPath(
    repositoryRoot,
    claim.scopeDirectory,
  );

  if (!isPathInsideRepository(repositoryRoot, targetDirectory)) {
    throw new TypeError(
      `Conflict-analysis target is outside repository root: "${targetDirectory}".`,
    );
  }
  if (!isPathInsideRepository(repositoryRoot, scopeDirectory)) {
    throw new TypeError(
      `Claim "${claim.id}" has a scope outside repository root: "${scopeDirectory}".`,
    );
  }

  return {
    claimId: claim.id,
    scopeDirectory,
    targetDirectory,
    applicable: isPathInsideRepository(scopeDirectory, targetDirectory),
    specificity: pathSpecificity(repositoryRoot, scopeDirectory),
  };
}

function packageScriptComparison(
  claim: ValidatedClaim,
): { script: string; packageManager: PackageManager } | undefined {
  if (claim.packageScript === undefined) {
    return undefined;
  }

  if (claim.command !== undefined) {
    const normalized = normalizePackageScriptCommand(claim.command);
    if (
      !normalized.success ||
      normalized.command.script !== claim.packageScript ||
      (claim.packageManager !== undefined &&
        claim.packageManager !== normalized.command.packageManager)
    ) {
      return undefined;
    }
    return normalized.command;
  }

  return claim.packageManager === undefined
    ? undefined
    : { script: claim.packageScript, packageManager: claim.packageManager };
}

function frameworkComparison(claim: ValidatedClaim): string | undefined {
  const dependencies = new Set(
    (claim.dependencyNames ?? []).map((name) =>
      name.trim().toLocaleLowerCase("en-US"),
    ),
  );
  const hasJest = dependencies.has("jest");
  const hasVitest = dependencies.has("vitest");

  if (hasJest === hasVitest) {
    return undefined;
  }
  return hasJest ? "jest" : "vitest";
}

function comparableClaim(
  claim: ValidatedClaim,
  inputIndex: number,
  scope: EffectiveClaimScope,
): ComparableClaim | undefined {
  if (!scope.applicable || claim.type === "advisory") {
    return undefined;
  }

  if (claim.type === "package_manager" && claim.packageManager !== undefined) {
    return {
      claim,
      inputIndex,
      type: "package_manager",
      relationshipKey: "package-manager",
      value: claim.packageManager,
      valueLabel: claim.packageManager,
      scope,
    };
  }

  if (claim.type === "package_script") {
    const comparison = packageScriptComparison(claim);
    if (comparison !== undefined) {
      return {
        claim,
        inputIndex,
        type: "package_script",
        relationshipKey: `package-script:${comparison.script}`,
        value: comparison.packageManager,
        valueLabel: `${comparison.packageManager} script "${comparison.script}"`,
        scope,
      };
    }
  }

  if (claim.type === "dependency_present") {
    const framework = frameworkComparison(claim);
    if (framework !== undefined) {
      return {
        claim,
        inputIndex,
        type: "dependency_present",
        relationshipKey: "framework:test-runner",
        value: framework,
        valueLabel: framework === "jest" ? "Jest" : "Vitest",
        scope,
      };
    }
  }

  return undefined;
}

function conflictSource(item: ComparableClaim): ConflictingClaimSource {
  return {
    claimId: item.claim.id,
    claimType: item.claim.type,
    sourceFile: item.claim.sourceFile,
    lineStart: item.claim.lineStart,
    lineEnd: item.claim.lineEnd,
    scopeDirectory: item.scope.scopeDirectory,
    normalizedValue: item.claim.normalizedValue,
  };
}

function appendEvidence(
  claim: ValidatedClaim,
  status: "failed" | "overridden",
  evidence: string,
): ValidatedClaim {
  return {
    ...claim,
    status,
    evidence: [...claim.evidence, evidence],
  };
}

export function analyzeClaimConflicts(
  inputClaims: readonly ValidatedClaim[],
  context: ConflictAnalysisContext,
): ConflictAnalysisResult {
  const scopes = inputClaims.map((claim) =>
    resolveEffectiveClaimScope(claim, context),
  );
  const applicableClaims = inputClaims
    .map((claim, inputIndex) => ({ claim, inputIndex }))
    .filter(({ inputIndex }) => scopes[inputIndex]?.applicable === true);
  const outputByInputIndex = new Map(
    applicableClaims.map(({ claim, inputIndex }) => [inputIndex, claim]),
  );
  const groups = new Map<string, ComparableClaim[]>();

  for (const { claim, inputIndex } of applicableClaims) {
    const scope = scopes[inputIndex];
    if (scope === undefined) {
      continue;
    }
    const comparable = comparableClaim(claim, inputIndex, scope);
    if (comparable === undefined) {
      continue;
    }
    const groupKey = `${comparable.type}\0${comparable.relationshipKey}`;
    const group = groups.get(groupKey) ?? [];
    group.push(comparable);
    groups.set(groupKey, group);
  }

  const pendingConflicts: Omit<InstructionConflict, "id">[] = [];
  const orderedGroups = [...groups.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );

  for (const [, group] of orderedGroups) {
    const deepestSpecificity = Math.max(
      ...group.map((item) => item.scope.specificity),
    );
    const active = group.filter(
      (item) => item.scope.specificity === deepestSpecificity,
    );
    const activeClaimIds = active.map((item) => item.claim.id).join(", ");

    for (const item of group) {
      if (item.scope.specificity < deepestSpecificity) {
        outputByInputIndex.set(
          item.inputIndex,
          appendEvidence(
            item.claim,
            "overridden",
            `Claim is overridden for target "${item.scope.targetDirectory}" by more specific claim(s): ${activeClaimIds}.`,
          ),
        );
      }
    }

    const distinctValues = new Set(active.map((item) => item.value));
    if (distinctValues.size <= 1) {
      continue;
    }

    const valueLabels = [...new Set(active.map((item) => item.valueLabel))].sort();
    const conflictEvidence = `Mutually exclusive ${active[0]?.type ?? "instruction"} guidance applies in scope "${active[0]?.scope.scopeDirectory ?? ""}": ${valueLabels.join(" versus ")}.`;
    for (const item of active) {
      outputByInputIndex.set(
        item.inputIndex,
        appendEvidence(item.claim, "failed", conflictEvidence),
      );
    }

    const first = active[0];
    if (first !== undefined) {
      pendingConflicts.push({
        type: first.type,
        effectiveScopeDirectory: first.scope.scopeDirectory,
        message: conflictEvidence,
        claims: active.map(conflictSource),
      });
    }
  }

  const conflicts = pendingConflicts.map((conflict, index) => ({
    id: `conflict-${String(index + 1)}`,
    ...conflict,
  }));

  return {
    claims: applicableClaims.map(({ inputIndex }) => {
      const claim = outputByInputIndex.get(inputIndex);
      if (claim === undefined) {
        throw new TypeError(`Missing analyzed claim at input index ${String(inputIndex)}.`);
      }
      return claim;
    }),
    conflicts,
    scopes,
  };
}
