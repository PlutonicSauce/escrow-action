import { z } from "zod";

import {
  CLAIM_STATUSES,
  CLAIM_TYPES,
  COMMAND_RESULT_STATUSES,
  PACKAGE_MANAGERS,
  REPOSITORY_INCONSISTENCY_KINDS,
  type BranchCommandResult,
  type ExtractedClaim,
  type RepositoryInconsistency,
  type ValidatedClaim,
} from "../models/claims.js";

export const claimTypeSchema = z.enum(CLAIM_TYPES);
export const claimStatusSchema = z.enum(CLAIM_STATUSES);
export const packageManagerSchema = z.enum(PACKAGE_MANAGERS);

const extractedClaimShape = {
  id: z.string().min(1, "Claim id is required"),
  type: claimTypeSchema,
  sourceFile: z.string().min(1, "Source file is required"),
  lineStart: z.int().positive("lineStart must be a positive integer"),
  lineEnd: z.int().positive("lineEnd must be a positive integer"),
  originalText: z.string().min(1, "Original text is required"),
  normalizedValue: z.string().min(1, "Normalized value is required"),
  scopeDirectory: z.string().min(1, "Scope directory is required"),
  command: z.string().min(1, "Command cannot be empty").optional(),
  referencedPath: z.string().min(1, "Referenced path cannot be empty").optional(),
  packageManager: packageManagerSchema.optional(),
  packageScript: z.string().min(1, "Package script cannot be empty").optional(),
  dependencyNames: z
    .array(z.string().min(1, "Dependency name cannot be empty"))
    .min(1, "dependencyNames cannot be empty")
    .optional(),
  confidence: z.number().min(0).max(1),
  extractionReason: z.string().min(1, "Extraction reason is required"),
};

const OPTIONAL_CLAIM_FIELDS = [
  "command",
  "referencedPath",
  "packageManager",
  "packageScript",
  "dependencyNames",
] as const;

type OptionalClaimField = (typeof OPTIONAL_CLAIM_FIELDS)[number];

const ALLOWED_FIELDS_BY_CLAIM_TYPE = {
  path_exists: ["referencedPath"],
  package_manager: ["packageManager"],
  package_script: ["command", "packageManager", "packageScript"],
  dependency_present: ["dependencyNames"],
  command_runs: ["command"],
  advisory: [],
} as const satisfies Record<
  (typeof CLAIM_TYPES)[number],
  readonly OptionalClaimField[]
>;

const REQUIRED_FIELDS_BY_CLAIM_TYPE = {
  path_exists: ["referencedPath"],
  package_manager: ["packageManager"],
  package_script: ["packageScript"],
  dependency_present: ["dependencyNames"],
  command_runs: ["command"],
  advisory: [],
} as const satisfies Record<
  (typeof CLAIM_TYPES)[number],
  readonly OptionalClaimField[]
>;

function addLineRangeIssue(
  value: { lineStart: number; lineEnd: number },
  context: z.RefinementCtx,
): void {
  if (value.lineEnd < value.lineStart) {
    context.addIssue({
      code: "custom",
      path: ["lineEnd"],
      message: "lineEnd must be greater than or equal to lineStart",
    });
  }
}

export const extractedClaimSchema = z
  .strictObject(extractedClaimShape)
  .superRefine(addLineRangeIssue);

export const codexExtractionResponseSchema = z
  .strictObject({
    claims: z.array(extractedClaimSchema),
  })
  .superRefine((value, context) => {
    for (const [claimIndex, claim] of value.claims.entries()) {
      const allowedFields: readonly OptionalClaimField[] =
        ALLOWED_FIELDS_BY_CLAIM_TYPE[claim.type];
      const requiredFields: readonly OptionalClaimField[] =
        REQUIRED_FIELDS_BY_CLAIM_TYPE[claim.type];

      for (const field of OPTIONAL_CLAIM_FIELDS) {
        if (claim[field] !== undefined && !allowedFields.includes(field)) {
          context.addIssue({
            code: "custom",
            path: ["claims", claimIndex, field],
            message: `${field} is not relevant to ${claim.type} claims`,
          });
        }
      }

      for (const field of requiredFields) {
        if (claim[field] === undefined) {
          context.addIssue({
            code: "custom",
            path: ["claims", claimIndex, field],
            message: `${field} is required for ${claim.type} claims`,
          });
        }
      }

      if (
        claim.dependencyNames !== undefined &&
        new Set(claim.dependencyNames).size !== claim.dependencyNames.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["claims", claimIndex, "dependencyNames"],
          message: "dependencyNames must not contain duplicates",
        });
      }
    }
  });

export const branchCommandResultSchema = z.strictObject({
  command: z.string().min(1, "Command is required"),
  workingDirectory: z.string().min(1, "Working directory is required"),
  status: z.enum(COMMAND_RESULT_STATUSES),
  exitCode: z.int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().nonnegative(),
});

export const repositoryInconsistencySchema = z.strictObject({
  kind: z.enum(REPOSITORY_INCONSISTENCY_KINDS),
  message: z.string().min(1, "Repository inconsistency message is required"),
  evidence: z
    .array(z.string().min(1, "Repository inconsistency evidence cannot be empty"))
    .min(1, "Repository inconsistencies must include evidence"),
});

export const validatedClaimSchema = z
  .strictObject({
    ...extractedClaimShape,
    status: claimStatusSchema,
    evidence: z.array(z.string().min(1, "Evidence entry cannot be empty")),
    repositoryInconsistencies: z.array(repositoryInconsistencySchema).optional(),
    suggestion: z.string().min(1, "Suggestion cannot be empty").optional(),
    commandResult: branchCommandResultSchema.optional(),
  })
  .superRefine((value, context) => {
    addLineRangeIssue(value, context);

    if (value.status === "failed" && value.evidence.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Failed claims must include repository evidence",
      });
    }
  });

type IsMutuallyAssignable<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;
type Assert<Condition extends true> = Condition;

type _ExtractedClaimSchemaMatchesModel = Assert<
  IsMutuallyAssignable<z.output<typeof extractedClaimSchema>, ExtractedClaim>
>;
type _ValidatedClaimSchemaMatchesModel = Assert<
  IsMutuallyAssignable<z.output<typeof validatedClaimSchema>, ValidatedClaim>
>;
type _CommandResultSchemaMatchesModel = Assert<
  IsMutuallyAssignable<z.output<typeof branchCommandResultSchema>, BranchCommandResult>
>;
type _RepositoryInconsistencySchemaMatchesModel = Assert<
  IsMutuallyAssignable<
    z.output<typeof repositoryInconsistencySchema>,
    RepositoryInconsistency
  >
>;
