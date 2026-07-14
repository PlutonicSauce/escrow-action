import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractClaims } from "../../../src/extraction/extractClaims.js";
import type { InstructionFile } from "../../../src/models/instructions.js";

const manualRunEnabled =
  process.env.AGENTCONTRACT_RUN_CODEX_INTEGRATION === "1";
const codexInstalled =
  manualRunEnabled &&
  spawnSync("codex", ["--version"], { stdio: "ignore" }).status === 0;

describe.runIf(manualRunEnabled && codexInstalled)(
  "Codex extraction manual integration",
  () => {
    it(
      "extracts a schema-valid claim with the installed Codex CLI",
      async () => {
        const repositoryRoot = await mkdtemp(
          join(tmpdir(), "agentcontract-codex-integration-"),
        );

        try {
          const sourceFile = join(repositoryRoot, "AGENTS.md");
          const content = "Read docs/guide.md before editing.\n";
          await writeFile(sourceFile, content, "utf8");
          const gitInit = spawnSync("git", ["init", "--quiet", repositoryRoot], {
            encoding: "utf8",
          });
          if (gitInit.status !== 0) {
            throw new Error(`git init failed: ${gitInit.stderr}`);
          }

          const instruction: InstructionFile = {
            path: sourceFile,
            directory: repositoryRoot,
            fileName: "AGENTS.md",
            content,
          };
          const claims = await extractClaims({
            repositoryRoot,
            instructionChain: [instruction],
            timeoutMs: 180_000,
          });

          expect(claims.some((claim) => claim.type === "path_exists")).toBe(true);
          expect(claims.every((claim) => claim.sourceFile === sourceFile)).toBe(true);
        } finally {
          await rm(repositoryRoot, { recursive: true, force: true });
        }
      },
      200_000,
    );
  },
);
