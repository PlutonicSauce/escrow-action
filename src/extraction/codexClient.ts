import { spawn } from "node:child_process";

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
    const child = spawn("codex", [...request.args], {
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
