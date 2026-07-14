import { beforeEach, describe, expect, it, vi } from "vitest";

const discoverInstructionsMock = vi.hoisted(() => vi.fn());
const extractAndValidateClaimsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/discovery/discoverInstructions.js", () => ({
  discoverInstructions: discoverInstructionsMock,
}));
vi.mock("../../../src/extraction/extractClaims.js", () => ({
  extractAndValidateClaims: extractAndValidateClaimsMock,
}));

import {
  checkRepository,
  type CheckCommandDependencies,
} from "../../../src/commands/check.js";

let consoleOutput: string[];
let fileOutput: Array<{ path: string; content: string }>;

const dependencies: CheckCommandDependencies = {
  generatedAt: () => "2026-07-13T18:00:00.000Z",
  writeConsole: (output) => {
    consoleOutput.push(output);
  },
  writeFile: async (path, content) => {
    fileOutput.push({ path, content });
  },
};

describe("checkRepository command execution options", () => {
  beforeEach(() => {
    discoverInstructionsMock.mockReset();
    extractAndValidateClaimsMock.mockReset();
    consoleOutput = [];
    fileOutput = [];
    discoverInstructionsMock.mockResolvedValue({
      repositoryRoot: "/repo",
      targetDirectory: "/repo/packages/api",
      instructionChain: [],
    });
    extractAndValidateClaimsMock.mockResolvedValue({
      claims: [],
      validatedClaims: [],
      deferredClaims: [],
      conflicts: [],
      claimScopes: [],
    });
  });

  it("keeps documented command execution disabled by default", async () => {
    await checkRepository("/repo", {}, dependencies);

    expect(extractAndValidateClaimsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetDirectory: "/repo/packages/api",
        commandExecution: {
          enabled: false,
          allowNetwork: false,
          timeoutMs: undefined,
          keepWorktree: false,
        },
      }),
    );
  });

  it("passes explicit execution, network, timeout, and retention settings", async () => {
    await checkRepository("/repo", {
      execute: true,
      allowNetwork: true,
      timeout: 2.5,
      keepWorktree: true,
    }, dependencies);

    expect(extractAndValidateClaimsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        commandExecution: {
          enabled: true,
          allowNetwork: true,
          timeoutMs: 2_500,
          keepWorktree: true,
        },
      }),
    );
  });

  it("renders every requested format from one shared report", async () => {
    discoverInstructionsMock.mockResolvedValueOnce({
      repositoryRoot: "/repo",
      targetDirectory: "/repo/packages/api",
      instructionChain: [
        {
          path: "/repo/AGENTS.md",
          directory: "/repo",
          fileName: "AGENTS.md",
          content: "Use npm.\nPrefer focused changes.",
        },
      ],
    });
    extractAndValidateClaimsMock.mockResolvedValueOnce({
      claims: [],
      validatedClaims: [
        {
          id: "manager",
          type: "package_manager",
          sourceFile: "/repo/AGENTS.md",
          lineStart: 1,
          lineEnd: 1,
          originalText: "Use npm.",
          normalizedValue: "npm",
          scopeDirectory: "/repo",
          packageManager: "npm",
          confidence: 1,
          extractionReason: "Explicit package manager.",
          status: "failed",
          evidence: ["Repository uses pnpm."],
        },
      ],
      deferredClaims: [
        {
          id: "advisory",
          type: "advisory",
          sourceFile: "/repo/AGENTS.md",
          lineStart: 2,
          lineEnd: 2,
          originalText: "Prefer focused changes.",
          normalizedValue: "focused changes",
          scopeDirectory: "/repo",
          confidence: 1,
          extractionReason: "Non-verifiable preference.",
        },
      ],
      conflicts: [],
      claimScopes: [],
    });

    await expect(
      checkRepository(
        "/repo",
        {
          json: "report.json",
          markdown: "report.md",
          html: "report.html",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ exitCode: 1 });

    expect(consoleOutput).toHaveLength(1);
    expect(consoleOutput[0]).toContain("1 failed");
    expect(consoleOutput[0]).toContain("1 advisory");
    expect(fileOutput.map(({ path }) => path)).toEqual([
      "report.json",
      "report.md",
      "report.html",
    ]);
    const json = JSON.parse(fileOutput[0]?.content ?? "{}") as {
      generatedAt?: string;
      summary?: { failed?: number; advisory?: number };
    };
    expect(json.generatedAt).toBe("2026-07-13T18:00:00.000Z");
    expect(json.summary).toMatchObject({ failed: 1, advisory: 1 });
    expect(fileOutput[1]?.content).toContain("| Failed | 1 |");
    expect(fileOutput[1]?.content).toContain("| Advisory | 1 |");
    expect(fileOutput[2]?.content).toContain(
      'data-summary-key="failed" data-summary-value="1"',
    );
    expect(fileOutput[2]?.content).toContain(
      'data-summary-key="advisory" data-summary-value="1"',
    );
  });
});
