import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  branchCommandResultSchema,
  extractedClaimSchema,
  validatedClaimSchema,
} from "../../../src/extraction/claimSchema.js";
import {
  CLAIM_STATUSES,
  CLAIM_TYPES,
  COMMAND_RESULT_STATUSES,
  type ClaimType,
  type ExtractedClaim,
} from "../../../src/models/claims.js";
import { createExtractedClaim, createValidatedClaim } from "./claimFixtures.js";

const CLAIM_TYPE_FIELDS: Record<ClaimType, Partial<ExtractedClaim>> = {
  path_exists: { referencedPath: "docs/architecture.md" },
  package_manager: { packageManager: "pnpm" },
  package_script: { packageManager: "npm", packageScript: "test" },
  dependency_present: { dependencyNames: ["vitest"] },
  command_runs: { command: "npm test" },
  advisory: { normalizedValue: "Prefer small modules" },
};

describe("claim schemas", () => {
  it("declares a JSON Schema type for every extraction discriminator", () => {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), "schemas/claims.schema.json"), "utf8"),
    ) as {
      properties: {
        claims: {
          items: {
            anyOf: Array<{
              properties: { type: { const: string; type?: string } };
            }>;
          };
        };
      };
    };

    const discriminatorSchemas = schema.properties.claims.items.anyOf.map(
      (variant) => variant.properties.type,
    );

    expect(discriminatorSchemas).toHaveLength(9);
    expect(discriminatorSchemas.every((discriminator) => discriminator.type === "string"))
      .toBe(true);
    expect(readFileSync(resolve(process.cwd(), "schemas/claims.schema.json"), "utf8"))
      .not.toContain('"uniqueItems"');
  });

  it.each(CLAIM_TYPES)("accepts the %s claim type", (type) => {
    const claim = createExtractedClaim({ type, ...CLAIM_TYPE_FIELDS[type] });

    expect(extractedClaimSchema.parse(claim)).toEqual(claim);
  });

  it.each(CLAIM_STATUSES)("accepts the %s claim status", (status) => {
    const claim = createValidatedClaim(
      status === "advisory"
        ? { type: "advisory", status }
        : { status },
    );

    expect(validatedClaimSchema.parse(claim)).toEqual(claim);
  });

  it("accepts model-valid claims without optional metadata", () => {
    const claim: ExtractedClaim = {
      id: "advisory-minimal",
      type: "advisory",
      sourceFile: "AGENTS.md",
      lineStart: 1,
      lineEnd: 1,
      originalText: "Prefer small modules.",
      normalizedValue: "Prefer small modules",
      scopeDirectory: ".",
      confidence: 0.8,
      extractionReason: "Advisory instruction",
    };

    expect(extractedClaimSchema.parse(claim)).toEqual(claim);
  });

  it.each(COMMAND_RESULT_STATUSES)(
    "keeps the %s command-result status aligned with its model",
    (status) => {
      const commandResult = {
        command: "npm test",
        workingDirectory: "/repo",
        status,
        exitCode: status === "passed" ? 0 : 1,
        stdout: "",
        stderr: "",
        durationMs: 25,
      };

      expect(branchCommandResultSchema.parse(commandResult)).toEqual(commandResult);
    },
  );

  it("preserves source files and line ranges", () => {
    const claim = createExtractedClaim({
      sourceFile: "packages/api/AGENTS.md",
      lineStart: 12,
      lineEnd: 15,
    });

    const parsedClaim = extractedClaimSchema.parse(claim);

    expect(parsedClaim.sourceFile).toBe("packages/api/AGENTS.md");
    expect(parsedClaim.lineStart).toBe(12);
    expect(parsedClaim.lineEnd).toBe(15);
  });

  it("rejects unsupported claim types", () => {
    const result = extractedClaimSchema.safeParse({
      ...createExtractedClaim(),
      type: "quality_score",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing source locations", () => {
    const { sourceFile: _sourceFile, ...claimWithoutSource } = createExtractedClaim();

    const result = extractedClaimSchema.safeParse(claimWithoutSource);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "sourceFile")).toBe(
        true,
      );
    }
  });

  it("rejects reversed or non-positive line ranges with useful errors", () => {
    const result = extractedClaimSchema.safeParse(
      createExtractedClaim({ lineStart: 5, lineEnd: 2 }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "lineEnd must be greater than or equal to lineStart",
      );
    }

    expect(
      extractedClaimSchema.safeParse(createExtractedClaim({ lineStart: 0 })).success,
    ).toBe(false);
  });

  it("rejects confidence outside the inclusive zero-to-one range", () => {
    expect(
      extractedClaimSchema.safeParse(createExtractedClaim({ confidence: 1.01 })).success,
    ).toBe(false);
    expect(
      extractedClaimSchema.safeParse(createExtractedClaim({ confidence: -0.01 })).success,
    ).toBe(false);
  });

  it("rejects unknown properties", () => {
    const result = extractedClaimSchema.safeParse({
      ...createExtractedClaim(),
      verdict: "passed",
    });

    expect(result.success).toBe(false);
  });

  it("requires failed claims to include repository evidence", () => {
    const result = validatedClaimSchema.safeParse(
      createValidatedClaim({ status: "failed", evidence: [] }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Failed claims must include repository evidence",
      );
    }
  });

  it("requires repository inconsistencies to include deterministic evidence", () => {
    const result = validatedClaimSchema.safeParse(
      createValidatedClaim({
        status: "warning",
        repositoryInconsistencies: [
          {
            kind: "package_manager",
            message: "Lockfile and packageManager metadata disagree.",
            evidence: [],
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Repository inconsistencies must include evidence",
      );
    }
  });

  it("keeps optional advisory metadata separate from deterministic status logic", () => {
    expect(
      validatedClaimSchema.parse(
        createValidatedClaim({ type: "advisory", status: "passed" }),
      ).status,
    ).toBe("passed");
  });
});
