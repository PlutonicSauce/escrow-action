import type { ClaimType } from "./claims.js";

export const INSTRUCTION_CONFLICT_TYPES = [
  "package_manager",
  "package_script",
  "dependency_present",
] as const;

export type InstructionConflictType =
  (typeof INSTRUCTION_CONFLICT_TYPES)[number];

export interface ConflictingClaimSource {
  claimId: string;
  claimType: ClaimType;
  sourceFile: string;
  lineStart: number;
  lineEnd: number;
  scopeDirectory: string;
  normalizedValue: string;
}

export interface InstructionConflict {
  id: string;
  type: InstructionConflictType;
  effectiveScopeDirectory: string;
  message: string;
  claims: ConflictingClaimSource[];
}
