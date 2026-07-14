export const ExitCode = {
  success: 0,
  checkFailed: 1,
  invalidArguments: 2,
  extractionFailed: 3,
  internalError: 4,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export class AgentContractError extends Error {
  public readonly exitCode: ExitCode;

  public constructor(message: string, exitCode: ExitCode) {
    super(message);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

export class InvalidRepositoryError extends AgentContractError {
  public constructor(message: string) {
    super(message, ExitCode.invalidArguments);
  }
}

export class CodexExtractionError extends AgentContractError {
  public constructor(message: string) {
    super(message, ExitCode.extractionFailed);
  }
}

export class CodexRepairError extends AgentContractError {
  public constructor(message: string) {
    super(message, ExitCode.extractionFailed);
  }
}

export class RepairRejectedError extends AgentContractError {
  public constructor(message: string) {
    super(message, ExitCode.checkFailed);
  }
}

export class CheckFailedError extends AgentContractError {
  public constructor(message = "One or more Escrow claims failed.") {
    super(message, ExitCode.checkFailed);
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
