import { Command, CommanderError, InvalidArgumentError } from "commander";

import {
  checkRepository,
  type CheckCommandHandler,
  type CheckCommandOptions,
} from "./commands/check.js";
import {
  fixRepository,
  type FixCommandHandler,
  type FixCommandOptions,
} from "./commands/fix.js";
import {
  uiRepository,
  type UiCommandHandler,
  type UiCommandOptions,
} from "./commands/ui.js";
import {
  initializeRepository,
  type InitCommandHandler,
  type InitCommandOptions,
} from "./commands/init.js";
import {
  AgentContractError,
  ExitCode,
  getErrorMessage,
  type ExitCode as ExitCodeValue,
} from "./utils/errors.js";
import { AGENTCONTRACT_VERSION } from "./version.js";

const PROGRAM_NAME = "escrow";
const PROGRAM_DESCRIPTION =
  "Verify that coding-agent repository instructions match the repository.";

function parseTimeoutSeconds(value: string): number {
  const seconds = Number(value);
  const milliseconds = seconds * 1_000;
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 1
  ) {
    throw new InvalidArgumentError(
      "timeout must be a positive number of seconds with millisecond precision",
    );
  }
  return seconds;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new InvalidArgumentError("port must be an integer between 1 and 65535");
  }
  return port;
}

export interface CliDependencies {
  check: CheckCommandHandler;
  fix: FixCommandHandler;
  ui: UiCommandHandler;
  init: InitCommandHandler;
  writeOut: (message: string) => void;
  writeError: (message: string) => void;
}

const defaultDependencies: CliDependencies = {
  check: checkRepository,
  fix: fixRepository,
  ui: uiRepository,
  init: initializeRepository,
  writeOut: (message: string): void => {
    process.stdout.write(message);
  },
  writeError: (message: string): void => {
    process.stderr.write(message);
  },
};

export function createProgram(dependencies: CliDependencies = defaultDependencies): Command {
  const program = new Command();

  program
    .name(PROGRAM_NAME)
    .description(PROGRAM_DESCRIPTION)
    .version(AGENTCONTRACT_VERSION)
    .exitOverride()
    .configureOutput({
      writeOut: dependencies.writeOut,
      writeErr: dependencies.writeError,
    });

  program
    .command("check")
    .description("Check repository instructions")
    .argument("<repository>", "path to the repository")
    .option("--target <directory>", "target directory within the repository")
    .option("--model <model>", "Codex model used for claim extraction")
    .option("--execute", "execute documented commands in a temporary Git worktree")
    .option("--allow-network", "allow network-capable documented commands")
    .option("--timeout <seconds>", "documented-command timeout", parseTimeoutSeconds)
    .option("--keep-worktree", "retain temporary command worktrees")
    .option("--json <path>", "write the JSON report to a file")
    .option("--markdown <path>", "write the Markdown report to a file")
    .option("--html <path>", "write the self-contained HTML report to a file")
    .action(async (repository: string, options: CheckCommandOptions): Promise<void> => {
      await dependencies.check(repository, options);
    });

  program
    .command("fix")
    .description("Generate and verify instruction-file repairs")
    .argument("<repository>", "path to the repository")
    .option("--target <directory>", "target directory within the repository")
    .option("--model <model>", "Codex model used for extraction and repair")
    .option("--apply", "apply a verified instruction-file patch")
    .option("--execute", "rerun documented commands during repair verification")
    .option("--allow-network", "allow network-capable documented commands")
    .option("--timeout <seconds>", "documented-command timeout", parseTimeoutSeconds)
    .option("--keep-worktree", "retain temporary command-execution worktrees")
    .action(async (repository: string, options: FixCommandOptions): Promise<void> => {
      await dependencies.fix(repository, options);
    });

  program
    .command("ui")
    .description("Run the local Escrow browser interface")
    .argument("<repository>", "path to the repository")
    .option("--target <directory>", "target directory within the repository")
    .option("--port <number>", "local TCP port", parsePort)
    .option("--model <model>", "Codex model used for extraction and repair")
    .option("--no-open", "do not open the browser automatically")
    .option("--execute", "execute documented commands in temporary Git worktrees")
    .option("--allow-network", "allow network-capable documented commands")
    .option("--timeout <seconds>", "documented-command timeout", parseTimeoutSeconds)
    .action(async (repository: string, options: UiCommandOptions): Promise<void> => {
      await dependencies.ui(repository, options);
    });

  program
    .command("init")
    .description("Create an Escrow GitHub Actions workflow")
    .argument("[repository]", "path to the repository", ".")
    .option("--force", "replace an existing Escrow workflow")
    .action(async (repository: string, options: InitCommandOptions): Promise<void> => {
      await dependencies.init(repository, options);
    });

  return program;
}

export async function runCli(
  arguments_: readonly string[],
  dependencies: CliDependencies = defaultDependencies,
): Promise<ExitCodeValue> {
  try {
    await createProgram(dependencies).parseAsync([...arguments_], { from: "user" });
    return ExitCode.success;
  } catch (error: unknown) {
    if (error instanceof CommanderError) {
      return error.exitCode === ExitCode.success
        ? ExitCode.success
        : ExitCode.invalidArguments;
    }

    if (error instanceof AgentContractError) {
      dependencies.writeError(`error: ${error.message}\n`);
      return error.exitCode;
    }

    dependencies.writeError(`Internal Escrow error: ${getErrorMessage(error)}\n`);
    return ExitCode.internalError;
  }
}
