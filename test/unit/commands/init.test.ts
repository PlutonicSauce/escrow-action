import { describe, expect, it, vi } from "vitest";

import {
  ESCROW_WORKFLOW_TEMPLATE,
  initializeRepository,
  type InitCommandDependencies,
} from "../../../src/commands/init.js";

function createDependencies(workflowExists: boolean): InitCommandDependencies & {
  writes: Array<{ path: string; content: string }>;
} {
  const writes: Array<{ path: string; content: string }> = [];
  return {
    findRepositoryRoot: vi.fn().mockResolvedValue("/repo"),
    pathExists: vi.fn().mockResolvedValue(workflowExists),
    makeDirectory: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn(async (path: string, content: string) => {
      writes.push({ path, content });
    }),
    writeConsole: vi.fn(),
    writes,
  };
}

describe("initializeRepository", () => {
  it("writes the Luna GitHub Actions workflow", async () => {
    const dependencies = createDependencies(false);

    await initializeRepository("/repo", {}, dependencies);

    expect(dependencies.makeDirectory).toHaveBeenCalledWith("/repo/.github/workflows");
    expect(dependencies.writes).toEqual([
      { path: "/repo/.github/workflows/escrow.yml", content: ESCROW_WORKFLOW_TEMPLATE },
    ]);
    expect(ESCROW_WORKFLOW_TEMPLATE).toContain("PlutonicSauce/escrow-action@v1");
    expect(ESCROW_WORKFLOW_TEMPLATE).toContain("model: gpt-5.6-luna");
  });

  it("protects an existing workflow unless force is explicit", async () => {
    const dependencies = createDependencies(true);

    await expect(initializeRepository("/repo", {}, dependencies)).rejects.toThrow("already exists");
    expect(dependencies.writes).toHaveLength(0);
  });
});
