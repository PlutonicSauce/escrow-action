import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const MACOS_CODEX_APP_BINARY = "/Applications/Codex.app/Contents/Resources/codex";

/**
 * Use an explicit override first, then the bundled macOS app binary when the
 * Codex app is installed but its CLI directory has not been added to PATH.
 */
export function resolveCodexExecutable(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = environment.ESCROW_CODEX_PATH?.trim();
  if (configured !== undefined && configured.length > 0) return configured;
  if (process.platform === "darwin" && existsSync(MACOS_CODEX_APP_BINARY)) {
    return MACOS_CODEX_APP_BINARY;
  }
  return "codex";
}

export interface CodexProcessRequest {
  args: readonly string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
}

export interface CodexProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type CodexProcessRunner = (
  request: CodexProcessRequest,
) => Promise<CodexProcessResult>;

const FORCE_KILL_DELAY_MS = 1_000;

export const runCodexProcess: CodexProcessRunner = async (
  request,
): Promise<CodexProcessResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(resolveCodexExecutable(), [...request.args], {
      cwd: request.cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, FORCE_KILL_DELAY_MS);
    }, request.timeoutMs);

    const clearTimers = (): void => {
      clearTimeout(timeout);
      if (forceKillTimer !== undefined) {
        clearTimeout(forceKillTimer);
      }
    };

    child.once("error", (error) => {
      clearTimers();
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimers();
      resolve({ exitCode, stdout, stderr, timedOut });
    });

    child.stdin.on("error", () => {
      // Process startup/exit errors are reported through the child events.
    });
    child.stdin.end(request.stdin);
  });
