import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { findGitRoot } from "../discovery/findGitRoot.js";

export interface InitCommandOptions {
  force?: boolean;
}

export interface InitCommandDependencies {
  findRepositoryRoot: (path: string) => Promise<string>;
  pathExists: (path: string) => Promise<boolean>;
  makeDirectory: (path: string) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  writeConsole: (message: string) => void;
}

const WORKFLOW_PATH = join(".github", "workflows", "escrow.yml");

export const ESCROW_WORKFLOW_TEMPLATE = `name: Escrow instruction integrity

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  escrow:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
          persist-credentials: false

      - id: escrow
        uses: PlutonicSauce/escrow-action@v1
        with:
          openai-api-key: \${{ secrets.OPENAI_API_KEY }}
          model: gpt-5.6-luna
          execute: "true"

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: escrow-report
          path: .escrow-artifacts/
`;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const defaultDependencies: InitCommandDependencies = {
  findRepositoryRoot: findGitRoot,
  pathExists,
  makeDirectory: async (path: string): Promise<void> => {
    await mkdir(path, { recursive: true });
  },
  writeFile: async (path: string, content: string): Promise<void> => {
    await writeFile(path, content, "utf8");
  },
  writeConsole: (message: string): void => {
    process.stdout.write(message);
  },
};

export async function initializeRepository(
  repository: string,
  options: InitCommandOptions,
  dependencies: InitCommandDependencies = defaultDependencies,
): Promise<void> {
  const repositoryRoot = await dependencies.findRepositoryRoot(repository);
  const workflowPath = join(repositoryRoot, WORKFLOW_PATH);

  if (await dependencies.pathExists(workflowPath) && options.force !== true) {
    throw new Error(`${WORKFLOW_PATH} already exists. Re-run with --force to replace it.`);
  }

  await dependencies.makeDirectory(dirname(workflowPath));
  await dependencies.writeFile(workflowPath, ESCROW_WORKFLOW_TEMPLATE);
  dependencies.writeConsole(
    `Created ${WORKFLOW_PATH}. Add OPENAI_API_KEY to this repository's GitHub Actions secrets, then push the workflow.\n`,
  );
}

export type InitCommandHandler = (
  repository: string,
  options: InitCommandOptions,
) => Promise<void> | void;
