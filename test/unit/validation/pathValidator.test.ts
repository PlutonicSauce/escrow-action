import type { PathLike } from "node:fs";
import { cp, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractedClaim } from "../../../src/models/claims.js";
import { validatePathClaim } from "../../../src/validation/pathValidator.js";
import { validateClaim } from "../../../src/validation/validateClaim.js";

const observedLstatPaths = vi.hoisted((): string[] => []);

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();

  return {
    ...actual,
    lstat: async (path: PathLike) => {
      observedLstatPaths.push(String(path));
      return actual.lstat(path);
    },
  };
});

const FIXTURE_ROOT = fileURLToPath(
  new URL("../../fixtures/path-validation/repository/", import.meta.url),
);
const temporaryDirectories: string[] = [];

function createPathClaim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: "path-claim",
    type: "path_exists",
    sourceFile: "AGENTS.md",
    lineStart: 2,
    lineEnd: 2,
    originalText: "Read docs/guide.md before making changes.",
    normalizedValue: "docs/guide.md",
    scopeDirectory: ".",
    referencedPath: "docs/guide.md",
    confidence: 1,
    extractionReason: "The instruction references a repository path.",
    ...overrides,
  };
}

async function expectInspectionsInside(repositoryRoot: string): Promise<void> {
  const canonicalRoot = await realpath(repositoryRoot);
  expect(
    observedLstatPaths.every(
      (inspectedPath) =>
        inspectedPath === canonicalRoot ||
        inspectedPath.startsWith(`${canonicalRoot}${sep}`),
    ),
  ).toBe(true);
}

beforeEach(() => {
  observedLstatPaths.length = 0;
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("validatePathClaim", () => {
  it("passes for an existing relative file", async () => {
    const result = await validatePathClaim(createPathClaim(), {
      repositoryRoot: FIXTURE_ROOT,
    });

    expect(result.status).toBe("passed");
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[1]).toContain("exists and is a file");
  });

  it("passes for an existing relative directory", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "docs/reference" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[1]).toContain("exists and is a directory");
  });

  it("resolves a leading slash from the repository root", async () => {
    const result = await validatePathClaim(
      createPathClaim({
        sourceFile: "packages/api/AGENTS.md",
        referencedPath: "/docs/guide.md",
      }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain("repository-root-relative");
    expect(result.evidence[1]).toContain("docs/guide.md");
  });

  it("fails with deterministic evidence for a missing path", async () => {
    const canonicalRoot = await realpath(FIXTURE_ROOT);
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "docs/missing.md" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence).toEqual([
      `Resolved path "docs/missing.md" from instruction directory "${canonicalRoot}" to "${join(canonicalRoot, "docs/missing.md")}".`,
      `Repository path does not exist: "${join(canonicalRoot, "docs/missing.md")}".`,
    ]);
    expect(result.sourceFile).toBe("AGENTS.md");
    expect(result.lineStart).toBe(2);
    expect(result.lineEnd).toBe(2);
  });

  it("rejects a parent traversal escape before inspecting it", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "../outside.md" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[1]).toContain("outside repository root");
    await expectInspectionsInside(FIXTURE_ROOT);
  });

  it("normalizes repeated separators for a path that remains in the repository", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "docs//reference///README.md" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[1]).toContain("exists and is a file");
  });

  it("rejects traversal hidden among repeated separators", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "docs////../../outside.md" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[1]).toContain("outside repository root");
    await expectInspectionsInside(FIXTURE_ROOT);
  });

  it("rejects traversal from a repository-root reference", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "/../../outside.md" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[0]).toContain("repository-root-relative");
    expect(result.evidence[1]).toContain("outside repository root");
    await expectInspectionsInside(FIXTURE_ROOT);
  });

  it("allows a nested instruction reference to move toward the root without escaping", async () => {
    const result = await validatePathClaim(
      createPathClaim({
        sourceFile: "packages/api/AGENTS.md",
        referencedPath: "../../docs/guide.md",
      }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[1]).toContain("docs/guide.md");
  });

  it("fails when a referenced path has nonexistent parent directories", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "missing/parents/file.txt" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[1]).toContain("does not exist");
  });

  it("validates the repository root itself as a directory", async () => {
    const result = await validatePathClaim(
      createPathClaim({
        sourceFile: "packages/api/AGENTS.md",
        referencedPath: "/",
      }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[1]).toContain("exists and is a directory");
  });

  it("treats an absolute host path as repository-root-relative and never reads it", async () => {
    const outsideDirectory = await mkdtemp(join(tmpdir(), "agentcontract-path-outside-"));
    temporaryDirectories.push(outsideDirectory);
    const outsideFile = join(outsideDirectory, "secret.txt");
    await writeFile(outsideFile, "outside secret", "utf8");

    const result = await validatePathClaim(
      createPathClaim({ referencedPath: outsideFile }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[0]).toContain("repository-root-relative");
    expect(result.evidence[1]).toContain("does not exist");
    expect(result.evidence.join("\n")).not.toContain("outside secret");

    expect(observedLstatPaths).not.toContain(outsideFile);
    await expectInspectionsInside(FIXTURE_ROOT);
  });

  it("classifies wildcard references as inconclusive without filesystem access", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "docs/*.md" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence).toEqual([
      'Cannot validate referenced path "docs/*.md": wildcard patterns are unsupported.',
    ]);
  });

  it("resolves relative paths from a nested instruction directory", async () => {
    const result = await validatePathClaim(
      createPathClaim({
        sourceFile: "packages/api/AGENTS.md",
        referencedPath: "local.txt",
      }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("passed");
    expect(result.evidence[0]).toContain("packages/api");
    expect(result.evidence[1]).toContain("packages/api/local.txt");
  });

  it("does not follow a symlink that could escape the repository", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "agentcontract-path-repo-"));
    temporaryDirectories.push(temporaryRoot);
    const repositoryRoot = join(temporaryRoot, "repository");
    await cp(FIXTURE_ROOT, repositoryRoot, { recursive: true });
    const outsideDirectory = join(temporaryRoot, "outside");
    await cp(join(FIXTURE_ROOT, "docs"), outsideDirectory, { recursive: true });
    await symlink(
      join(outsideDirectory, "guide.md"),
      join(repositoryRoot, "linked-guide.md"),
      "file",
    );

    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "linked-guide.md" }),
      { repositoryRoot },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[1]).toContain("symbolic link encountered");
  });

  it("stops at an intermediate symlink without exposing its external target", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "agentcontract-path-repo-"));
    temporaryDirectories.push(temporaryRoot);
    const repositoryRoot = join(temporaryRoot, "repository");
    await cp(FIXTURE_ROOT, repositoryRoot, { recursive: true });
    const outsideDirectory = join(temporaryRoot, "outside");
    await cp(join(FIXTURE_ROOT, "docs"), outsideDirectory, { recursive: true });
    await writeFile(join(outsideDirectory, "secret.txt"), "external secret", "utf8");
    await symlink(outsideDirectory, join(repositoryRoot, "linked-outside"), "dir");

    const result = await validatePathClaim(
      createPathClaim({ referencedPath: "linked-outside/secret.txt" }),
      { repositoryRoot },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[1]).toContain("symbolic link encountered");
    expect(result.evidence.join("\n")).not.toContain(outsideDirectory);
    expect(result.evidence.join("\n")).not.toContain("external secret");
    const canonicalRoot = await realpath(repositoryRoot);
    expect(observedLstatPaths).toEqual([
      canonicalRoot,
      join(canonicalRoot, "linked-outside"),
    ]);
  });

  it("rejects a source instruction file outside the repository", async () => {
    const result = await validatePathClaim(
      createPathClaim({ sourceFile: join(tmpdir(), "outside/AGENTS.md") }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("failed");
    expect(result.evidence[0]).toContain("source file");
    expect(result.evidence[0]).toContain("outside repository root");
  });

  it.each(["~/secret.txt", "$HOME/secret.txt", "file:///tmp/secret.txt"])(
    "classifies ambiguous reference %s as inconclusive",
    async (referencedPath) => {
      const result = await validatePathClaim(
        createPathClaim({ referencedPath }),
        { repositoryRoot: FIXTURE_ROOT },
      );

      expect(result.status).toBe("inconclusive");
      expect(result.evidence).toHaveLength(1);
    },
  );

  it.each(["//server/share/secret.txt", "C:\\Users\\someone\\secret.txt"])(
    "classifies platform-specific absolute reference %s as inconclusive",
    async (referencedPath) => {
      const result = await validatePathClaim(
        createPathClaim({ referencedPath }),
        { repositoryRoot: FIXTURE_ROOT },
      );

      expect(result.status).toBe("inconclusive");
      expect(result.evidence).toHaveLength(1);
    },
  );

  it("returns inconclusive when referencedPath is absent", async () => {
    const result = await validatePathClaim(
      createPathClaim({ referencedPath: undefined }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[0]).toContain("has no referencedPath");
  });
});

describe("validateClaim", () => {
  it("dispatches path_exists claims", async () => {
    const result = await validateClaim(createPathClaim(), {
      repositoryRoot: FIXTURE_ROOT,
    });

    expect(result.status).toBe("passed");
  });

  it("dispatches command_runs claims without executing by default", async () => {
    const result = await validateClaim(
      createPathClaim({ type: "command_runs", command: "npm test" }),
      { repositoryRoot: FIXTURE_ROOT },
    );

    expect(result.status).toBe("inconclusive");
    expect(result.evidence[0]).toContain("--execute was not supplied");
  });

  it("does not dispatch advisory claims into a deterministic validator", async () => {
    await expect(
      validateClaim(createPathClaim({ type: "advisory" }), {
        repositoryRoot: FIXTURE_ROOT,
      }),
    ).rejects.toThrow("No validator is implemented for claim type: advisory");
  });
});
