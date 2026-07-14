import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

export interface ProcessRequest {
  executable: string;
  args: readonly string[];
  cwd: string;
  environment?: NodeJS.ProcessEnv | undefined;
  timeoutMs: number;
  terminateProcessGroup?: boolean | undefined;
}

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

const FORCE_KILL_DELAY_MS = 1_000;

export const runProcess: ProcessRunner = async (request) =>
  new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const child = spawn(request.executable, [...request.args], {
      cwd: request.cwd,
      env: request.environment,
      detached: request.terminateProcessGroup === true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    let forceKillCompleted = false;
    let closedExitCode: number | null | undefined;
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const signalProcessGroup = (signal: NodeJS.Signals): boolean => {
      if (request.terminateProcessGroup === true && child.pid !== undefined) {
        try {
          process.kill(-child.pid, signal);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };

    const terminate = (signal: NodeJS.Signals): void => {
      if (signalProcessGroup(signal)) {
        return;
      }
      child.kill(signal);
    };

    const clearTimers = (): void => {
      clearTimeout(timeout);
      if (forceKillTimer !== undefined) {
        clearTimeout(forceKillTimer);
      }
    };

    const finish = (exitCode: number | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      resolve({
        exitCode,
        stdout,
        stderr,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        timedOut,
      });
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      terminate("SIGTERM");
      forceKillTimer = setTimeout(() => {
        terminate("SIGKILL");
        forceKillCompleted = true;
        if (closedExitCode !== undefined) {
          finish(closedExitCode);
        }
      }, FORCE_KILL_DELAY_MS);
    }, request.timeoutMs);

    child.once("error", (error) => {
      settled = true;
      clearTimers();
      reject(error);
    });
    child.once("close", (exitCode) => {
      if (timedOut && !forceKillCompleted) {
        closedExitCode = exitCode;
        return;
      }
      if (!timedOut && request.terminateProcessGroup === true) {
        signalProcessGroup("SIGKILL");
      }
      finish(exitCode);
    });
  });
