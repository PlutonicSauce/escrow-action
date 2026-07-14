import type { ExtractedClaim, ValidatedClaim } from "../models/claims.js";
import {
  validateCommandClaim,
  type CommandValidationContext,
} from "./commandValidator.js";
import {
  validateDependencyClaim,
  type DependencyValidationContext,
} from "./dependencyValidator.js";
import {
  validatePackageManagerClaim,
  type PackageManagerValidationContext,
} from "./packageManagerValidator.js";
import {
  validatePackageScriptClaim,
  type PackageScriptValidationContext,
} from "./packageScriptValidator.js";
import {
  validatePathClaim,
  type PathValidationContext,
} from "./pathValidator.js";

export type ValidationContext = PathValidationContext &
  PackageManagerValidationContext &
  PackageScriptValidationContext &
  DependencyValidationContext &
  CommandValidationContext;

export async function validateClaim(
  claim: ExtractedClaim,
  context: ValidationContext,
): Promise<ValidatedClaim> {
  switch (claim.type) {
    case "path_exists":
      return validatePathClaim(claim, context);
    case "package_manager":
      return validatePackageManagerClaim(claim, context);
    case "package_script":
      return validatePackageScriptClaim(claim, context);
    case "dependency_present":
      return validateDependencyClaim(claim, context);
    case "command_runs":
      return validateCommandClaim(claim, context);
    default:
      throw new TypeError(`No validator is implemented for claim type: ${claim.type}`);
  }
}
