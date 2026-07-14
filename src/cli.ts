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
  AgentContractError,
  ExitCode,
  getErrorMessage,
  type ExitCode as ExitCodeValue,
} from "./utils/errors.js";

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

export interface CliDependencies {
  check: CheckCommandHandler;
  fix: FixCommandHandler;
  writeOut: (message: string) => void;
  writeError: (message: string) => void;
}

const defaultDependencies: CliDependencies = {
  check: checkRepository,
  fix: fixRepository,
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
    .version("0.1.0")
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
