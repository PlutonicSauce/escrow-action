import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { findGitRoot } from "../../../src/discovery/findGitRoot.js";
import { InvalidRepositoryError } from "../../../src/utils/errors.js";
import {
  createFixtureRepository,
  fixturePath,
  removeFixtureRepository,
  type FixtureRepository,
} from "./fixtureRepository.js";

const fixtures: FixtureRepository[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(removeFixtureRepository));
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("findGitRoot", () => {
  it("finds the Git root from a nested directory", async () => {
    const fixture = await createFixtureRepository("root-and-nested");
    fixtures.push(fixture);

    await expect(findGitRoot(fixturePath(fixture, "packages/api"))).resolves.toBe(
      fixture.repositoryRoot,
    );
  });

  it("supports a .git file used by Git worktrees", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentcontract-git-file-"));
    temporaryDirectories.push(directory);
    const nestedDirectory = join(directory, "packages/api");
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(join(directory, ".git"), "gitdir: /temporary/gitdir\n", "utf8");

    await expect(findGitRoot(nestedDirectory)).resolves.toBe(await realpath(directory));
  });

  it("returns the nearest Git root for a nested repository", async () => {
    const fixture = await createFixtureRepository("root-and-nested");
    fixtures.push(fixture);
    const nestedRoot = fixturePath(fixture, "packages/api");
    await mkdir(join(nestedRoot, ".git"));

    await expect(findGitRoot(nestedRoot)).resolves.toBe(nestedRoot);
  });

  it("rejects a directory that is not inside a Git repository", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentcontract-no-git-"));
    temporaryDirectories.push(directory);

    await expect(findGitRoot(directory)).rejects.toThrow(InvalidRepositoryError);
    await expect(findGitRoot(directory)).rejects.toThrow("No Git repository found");
  });
});
