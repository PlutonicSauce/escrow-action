import { cp, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIRECTORY = fileURLToPath(
  new URL("../../fixtures/discovery/", import.meta.url),
);

export interface FixtureRepository {
  repositoryRoot: string;
  temporaryDirectory: string;
}

export async function createFixtureRepository(
  fixtureName: string,
): Promise<FixtureRepository> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "agentcontract-discovery-"),
  );
  const repositoryRoot = join(temporaryDirectory, "repository");

  await cp(join(FIXTURES_DIRECTORY, fixtureName), repositoryRoot, {
    recursive: true,
  });
  await mkdir(join(repositoryRoot, ".git"));

  return {
    repositoryRoot: await realpath(repositoryRoot),
    temporaryDirectory,
  };
}

export async function removeFixtureRepository(
  fixture: FixtureRepository,
): Promise<void> {
  await rm(fixture.temporaryDirectory, { recursive: true, force: true });
}

export function fixturePath(fixture: FixtureRepository, ...segments: string[]): string {
  return join(fixture.repositoryRoot, ...segments);
}
