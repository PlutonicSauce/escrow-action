import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { discoverInstructions } from "../../../src/discovery/discoverInstructions.js";
import { InvalidRepositoryError } from "../../../src/utils/errors.js";
import {
  createFixtureRepository,
  fixturePath,
  removeFixtureRepository,
  type FixtureRepository,
} from "./fixtureRepository.js";

const fixtures: FixtureRepository[] = [];
const temporaryDirectories: string[] = [];

interface RepositorySnapshotEntry {
  path: string;
  type: "directory" | "file" | "symlink";
  size: number;
  mtimeMs: number;
  value: string;
}

async function snapshotRepository(
  repositoryRoot: string,
): Promise<RepositorySnapshotEntry[]> {
  const snapshot: RepositorySnapshotEntry[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = join(directory, entry.name);
      const entryStats = await lstat(entryPath);
      const pathFromRoot = relative(repositoryRoot, entryPath);

      if (entry.isDirectory()) {
        snapshot.push({
          path: pathFromRoot,
          type: "directory",
          size: entryStats.size,
          mtimeMs: entryStats.mtimeMs,
          value: "",
        });
        await visit(entryPath);
      } else if (entry.isSymbolicLink()) {
        snapshot.push({
          path: pathFromRoot,
          type: "symlink",
          size: entryStats.size,
          mtimeMs: entryStats.mtimeMs,
          value: await readlink(entryPath),
        });
      } else {
        snapshot.push({
          path: pathFromRoot,
          type: "file",
          size: entryStats.size,
          mtimeMs: entryStats.mtimeMs,
          value: (await readFile(entryPath)).toString("base64"),
        });
      }
    }
  }

  await visit(repositoryRoot);
  return snapshot;
}

async function useFixture(fixtureName: string): Promise<FixtureRepository> {
  const fixture = await createFixtureRepository(fixtureName);
  fixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(removeFixtureRepository));
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("discoverInstructions", () => {
  it("discovers a root AGENTS.md", async () => {
    const fixture = await useFixture("root-only");

    const result = await discoverInstructions({ repository: fixture.repositoryRoot });

    expect(result.repositoryRoot).toBe(fixture.repositoryRoot);
    expect(result.targetDirectory).toBe(fixture.repositoryRoot);
    expect(result.instructionChain).toEqual([
      {
        path: fixturePath(fixture, "AGENTS.md"),
        directory: fixture.repositoryRoot,
        fileName: "AGENTS.md",
        content: "# Root instructions\n",
      },
    ]);
  });

  it("returns root and nested instructions in root-to-target order", async () => {
    const fixture = await useFixture("root-and-nested");

    const result = await discoverInstructions({
      repository: fixture.repositoryRoot,
      target: "packages/api",
    });

    expect(result.targetDirectory).toBe(fixturePath(fixture, "packages/api"));
    expect(result.instructionChain.map((instruction) => instruction.path)).toEqual([
      fixturePath(fixture, "AGENTS.md"),
      fixturePath(fixture, "packages/api/AGENTS.md"),
    ]);
  });

  it("prefers a non-empty AGENTS.override.md in the same directory", async () => {
    const fixture = await useFixture("override-precedence");

    const result = await discoverInstructions({ repository: fixture.repositoryRoot });

    expect(result.instructionChain).toHaveLength(1);
    expect(result.instructionChain[0]?.fileName).toBe("AGENTS.override.md");
    expect(result.instructionChain[0]?.content).toContain("Override instructions");
  });

  it("applies override precedence only within the override's directory", async () => {
    const fixture = await useFixture("nested-override");

    const result = await discoverInstructions({
      repository: fixture.repositoryRoot,
      target: "packages/api",
    });

    expect(result.instructionChain.map((instruction) => instruction.path)).toEqual([
      fixturePath(fixture, "AGENTS.md"),
      fixturePath(fixture, "packages/api/AGENTS.override.md"),
    ]);
    expect(result.instructionChain.map((instruction) => instruction.directory)).toEqual([
      fixture.repositoryRoot,
      fixturePath(fixture, "packages/api"),
    ]);
    expect(
      new Set(result.instructionChain.map((instruction) => instruction.directory)).size,
    ).toBe(result.instructionChain.length);
  });

  it("falls back to AGENTS.md when AGENTS.override.md is empty", async () => {
    const fixture = await useFixture("empty-override-fallback");

    const result = await discoverInstructions({ repository: fixture.repositoryRoot });

    expect(result.instructionChain).toHaveLength(1);
    expect(result.instructionChain[0]?.fileName).toBe("AGENTS.md");
    expect(result.instructionChain[0]?.content).toContain("Fallback instructions");
  });

  it("ignores empty instruction files", async () => {
    const fixture = await useFixture("empty-instructions");

    const result = await discoverInstructions({
      repository: fixture.repositoryRoot,
      target: "packages/api",
    });

    expect(result.instructionChain).toEqual([]);
  });

  it("returns an empty chain when there are no instruction files", async () => {
    const fixture = await useFixture("no-instructions");

    const result = await discoverInstructions({
      repository: fixture.repositoryRoot,
      target: "packages/api",
    });

    expect(result.instructionChain).toEqual([]);
  });

  it("excludes global instructions by default", async () => {
    const fixture = await useFixture("no-instructions");
    const codexHome = await mkdtemp(join(tmpdir(), "agentcontract-codex-home-"));
    temporaryDirectories.push(codexHome);
    await writeFile(join(codexHome, "AGENTS.md"), "# Global instructions\n", "utf8");
    const previousCodexHome = process.env.CODEX_HOME;

    try {
      process.env.CODEX_HOME = codexHome;
      const result = await discoverInstructions({ repository: fixture.repositoryRoot });
      expect(result.instructionChain).toEqual([]);
    } finally {
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousCodexHome;
      }
    }
  });

  it("rejects an absolute target outside the repository", async () => {
    const fixture = await useFixture("root-only");
    const outsideTarget = await mkdtemp(join(tmpdir(), "agentcontract-outside-"));
    temporaryDirectories.push(outsideTarget);

    await expect(
      discoverInstructions({
        repository: fixture.repositoryRoot,
        target: outsideTarget,
      }),
    ).rejects.toThrow(InvalidRepositoryError);
    await expect(
      discoverInstructions({
        repository: fixture.repositoryRoot,
        target: outsideTarget,
      }),
    ).rejects.toThrow("outside the Git repository");
  });

  it("rejects relative parent traversal outside the repository", async () => {
    const fixture = await useFixture("root-only");
    await mkdir(join(fixture.temporaryDirectory, "outside-target"));

    await expect(
      discoverInstructions({
        repository: fixture.repositoryRoot,
        target: "../outside-target",
      }),
    ).rejects.toThrow("outside the Git repository");
  });

  it("rejects a target symlink that escapes the repository", async () => {
    const fixture = await useFixture("root-only");
    const outsideTarget = await mkdtemp(join(tmpdir(), "agentcontract-symlink-outside-"));
    temporaryDirectories.push(outsideTarget);
    const linkPath = fixturePath(fixture, "linked-target");
    await symlink(outsideTarget, linkPath, "dir");

    await expect(
      discoverInstructions({
        repository: fixture.repositoryRoot,
        target: basename(linkPath),
      }),
    ).rejects.toThrow("outside the Git repository");
  });

  it("accepts an absolute symlink alias that canonicalizes inside the repository", async () => {
    const fixture = await useFixture("root-and-nested");
    const repositoryAlias = join(fixture.temporaryDirectory, "repository-alias");
    await symlink(fixture.repositoryRoot, repositoryAlias, "dir");

    const result = await discoverInstructions({
      repository: fixture.repositoryRoot,
      target: join(repositoryAlias, "packages/api"),
    });

    expect(result.targetDirectory).toBe(fixturePath(fixture, "packages/api"));
    expect(result.instructionChain.map((instruction) => instruction.fileName)).toEqual([
      "AGENTS.md",
      "AGENTS.md",
    ]);
  });

  it("ignores a symlinked override instead of reading outside the repository", async () => {
    const fixture = await useFixture("root-only");
    const outsideDirectory = await mkdtemp(
      join(tmpdir(), "agentcontract-instruction-symlink-outside-"),
    );
    temporaryDirectories.push(outsideDirectory);
    const outsideOverride = join(outsideDirectory, "AGENTS.override.md");
    await writeFile(outsideOverride, "# Outside override\n", "utf8");
    await symlink(
      outsideOverride,
      fixturePath(fixture, "AGENTS.override.md"),
      "file",
    );

    const result = await discoverInstructions({ repository: fixture.repositoryRoot });

    expect(result.instructionChain).toHaveLength(1);
    expect(result.instructionChain[0]?.fileName).toBe("AGENTS.md");
    expect(result.instructionChain[0]?.content).toBe("# Root instructions\n");
  });

  it("rejects a missing target directory", async () => {
    const fixture = await useFixture("root-only");

    await expect(
      discoverInstructions({
        repository: fixture.repositoryRoot,
        target: "packages/missing",
      }),
    ).rejects.toThrow("Target directory does not exist");
  });

  it("does not modify the inspected repository", async () => {
    const fixture = await useFixture("nested-override");
    const snapshotBefore = await snapshotRepository(fixture.repositoryRoot);

    await discoverInstructions({
      repository: fixture.repositoryRoot,
      target: "packages/api",
    });

    expect(await snapshotRepository(fixture.repositoryRoot)).toEqual(snapshotBefore);
  });
});
