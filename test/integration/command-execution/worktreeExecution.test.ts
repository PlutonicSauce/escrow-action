import { spawnSync } from "node:child_process";
import {
  access,
  cp,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupTemporaryWorktree } from "../../../src/execution/cleanupWorktree.js";
import type { ExtractedClaim } from "../../../src/models/claims.js";
import { validateCommandClaim } from "../../../src/validation/commandValidator.js";

const FIXTURE = fileURLToPath(
  new URL("../../fixtures/command-execution/repository/", import.meta.url),
);

let testDirectory: string;
let repositoryRoot: string;

function git(...args: string[]): string {
  const result = spawnSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function worktreePaths(): string[] {
  return git("worktree", "list", "--porcelain")
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));
}

function commandClaim(command: string, scopeDirectory = repositoryRoot): ExtractedClaim {
  return {
    id: `command-${command}`,
    type: "command_runs",
    sourceFile: join(scopeDirectory, "AGENTS.md"),
    lineStart: 1,
    lineEnd: 1,
    originalText: `Run ${command}.`,
    normalizedValue: command,
    scopeDirectory,
    command,
    confidence: 1,
    extractionReason: "Integration test command",
  };
}

async function execute(command: string, overrides = {}) {
  return validateCommandClaim(commandClaim(command), {
    repositoryRoot,
    commandExecution: {
      enabled: true,
      timeoutMs: 2_000,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  testDirectory = await mkdtemp(join(tmpdir(), "agentcontract-command-test-"));
  repositoryRoot = join(testDirectory, "repository");
  await cp(FIXTURE, repositoryRoot, { recursive: true });
  repositoryRoot = await realpath(repositoryRoot);
  git("init", "--quiet");
  git("config", "user.name", "AgentContract Tests");
  git("config", "user.email", "agentcontract@example.test");
  git("add", ".");
  git("commit", "--quiet", "-m", "fixture");
});

afterEach(async () => {
  for (const path of worktreePaths().slice(1)) {
    await cleanupTemporaryWorktree({
      repositoryRoot,
      worktreeDirectory: path,
      containerDirectory: dirname(path),
    });
  }
  await rm(testDirectory, { recursive: true, force: true });
});

describe("isolated command execution", () => {
  it("captures a passing command and cleans the worktree", async () => {
    const result = await execute('node -e "console.log(\'worktree-pass\')"');

    expect(result.status).toBe("passed");
    expect(result.commandResult).toMatchObject({
      status: "passed",
      exitCode: 0,
      stdout: "worktree-pass\n",
      stderr: "",
    });
    expect(result.commandResult?.workingDirectory).not.toBe(repositoryRoot);
    expect(result.commandResult?.durationMs).toBeGreaterThanOrEqual(0);
    await expect(
      access(result.commandResult?.workingDirectory ?? ""),
    ).rejects.toThrow();
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });

  it("captures a failing command and cleans the worktree", async () => {
    const result = await execute(
      'node -e "console.error(\'expected failure\'); process.exit(7)"',
    );

    expect(result.status).toBe("failed");
    expect(result.commandResult).toMatchObject({
      status: "failed",
      exitCode: 7,
      stderr: "expected failure\n",
    });
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });

  it("terminates a timed-out command and cleans the worktree", async () => {
    const result = await validateCommandClaim(
      commandClaim('node -e "setTimeout(() => {}, 5000)"'),
      {
        repositoryRoot,
        commandExecution: { enabled: true, timeoutMs: 50 },
      },
    );

    expect(result.status).toBe("failed");
    expect(result.commandResult?.status).toBe("failed");
    expect(result.commandResult?.exitCode).toBeNull();
    expect(result.commandResult?.stderr).toContain("timed out after 50ms");
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });

  it("uses the claim's nested scope inside the worktree", async () => {
    const nestedScope = join(repositoryRoot, "packages", "api");
    const result = await validateCommandClaim(
      commandClaim('node -e "console.log(process.cwd())"', nestedScope),
      {
        repositoryRoot,
        commandExecution: { enabled: true, timeoutMs: 2_000 },
      },
    );

    expect(result.status).toBe("passed");
    expect(result.commandResult?.stdout.trim()).toBe(
      result.commandResult?.workingDirectory,
    );
    expect(result.commandResult?.workingDirectory).toContain("packages/api");
    expect(result.commandResult?.workingDirectory).not.toContain(repositoryRoot);
  });

  it("sanitizes credentials and configures common clients offline", async () => {
    process.env.AGENTCONTRACT_TEST_TOKEN = "must-not-reach-command";
    process.env.NODE_OPTIONS = "--definitely-invalid-agentcontract-test-option";
    process.env.GIT_DIR = "/nonexistent-agentcontract-test-git-dir";
    try {
      const result = await execute(
        `node -e "console.log(JSON.stringify({home:process.env.HOME,proxy:process.env.HTTP_PROXY,token:process.env.AGENTCONTRACT_TEST_TOKEN,nodeOptions:process.env.NODE_OPTIONS,gitDir:process.env.GIT_DIR}))"`,
      );
      expect(result.status, JSON.stringify(result)).toBe("passed");
      const environment = JSON.parse(result.commandResult?.stdout ?? "{}") as {
        home?: string;
        proxy?: string;
        token?: string;
        nodeOptions?: string;
        gitDir?: string;
      };

      expect(environment.home).toContain("agentcontract-worktree-");
      expect(environment.home).toContain(".agentcontract/home");
      expect(environment.proxy).toBe("http://127.0.0.1:9");
      expect(environment.token).toBeUndefined();
      expect(environment.nodeOptions).toBeUndefined();
      expect(environment.gitDir).toBeUndefined();
    } finally {
      delete process.env.AGENTCONTRACT_TEST_TOKEN;
      delete process.env.NODE_OPTIONS;
      delete process.env.GIT_DIR;
    }
  });

  it("cleans the worktree after an execution exception", async () => {
    const result = await validateCommandClaim(commandClaim("node --version"), {
      repositoryRoot,
      commandExecution: { enabled: true },
      commandDependencies: {
        execute: vi.fn().mockRejectedValue(new Error("synthetic runner exception")),
      },
    });

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[0]).toContain("synthetic runner exception");
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });

  it("retains a worktree only with --keep-worktree", async () => {
    const result = await execute('node -e "console.log(\'retained\')"', {
      keepWorktree: true,
    });
    const retainedPath = result.commandResult?.workingDirectory;

    expect(result.status).toBe("passed");
    expect(retainedPath).toBeDefined();
    await expect(access(retainedPath ?? "")).resolves.toBeUndefined();
    expect(worktreePaths()).toHaveLength(2);

    await cleanupTemporaryWorktree({
      repositoryRoot,
      worktreeDirectory: retainedPath ?? "",
      containerDirectory: dirname(retainedPath ?? ""),
    });
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });

  it("leaves the active checkout unchanged", async () => {
    const activeFile = join(repositoryRoot, "tracked.txt");
    const before = await readFile(activeFile, "utf8");

    const result = await execute(
      `node -e "require('node:fs').writeFileSync('tracked.txt', 'worktree change')"`,
    );

    expect(result.status).toBe("passed");
    expect(await readFile(activeFile, "utf8")).toBe(before);
    expect(git("status", "--porcelain")).toBe("");
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });

  it("refuses a worktree containing an external symlink", async () => {
    await symlink("/tmp/agentcontract-external-target", join(repositoryRoot, "escape"));
    git("add", "escape");
    git("commit", "--quiet", "-m", "external symlink fixture");

    const result = await execute("node --version");

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[0]).toContain("symlink that escapes the worktree");
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });

  it("refuses checkout filters before creating an execution worktree", async () => {
    await writeFile(
      join(repositoryRoot, ".gitattributes"),
      "*.txt filter=unconfigured-test-filter\n",
    );
    git("add", ".gitattributes");
    git("commit", "--quiet", "-m", "checkout filter fixture");

    const result = await execute("node --version");

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[0]).toContain("requests a checkout filter");
    expect(worktreePaths()).toEqual([repositoryRoot]);
  });
});
