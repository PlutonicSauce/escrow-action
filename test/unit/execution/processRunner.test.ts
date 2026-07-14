import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { runProcess } from "../../../src/execution/processRunner.js";

interface FakeChildProcess extends EventEmitter {
  pid: number;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createFakeChild(): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess;
  child.pid = 4242;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

describe("runProcess process-group timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("force-kills the process group even when the shell leader closes first", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const processKill = vi.spyOn(process, "kill").mockReturnValue(true);
    let resolved = false;

    const resultPromise = runProcess({
      executable: "/bin/sh",
      args: ["-c", "mocked-only"],
      cwd: "/worktree",
      timeoutMs: 25,
      terminateProcessGroup: true,
    });
    void resultPromise.then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(25);
    expect(processKill).toHaveBeenCalledWith(-4242, "SIGTERM");

    child.emit("close", null);
    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(resultPromise).resolves.toMatchObject({
      exitCode: null,
      timedOut: true,
    });
    expect(processKill).toHaveBeenCalledWith(-4242, "SIGKILL");
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("reaps lingering process-group grandchildren after normal completion", async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const processKill = vi.spyOn(process, "kill").mockReturnValue(true);

    const resultPromise = runProcess({
      executable: "/bin/sh",
      args: ["-c", "mocked-only"],
      cwd: "/worktree",
      timeoutMs: 100,
      terminateProcessGroup: true,
    });
    child.emit("close", 0);

    await expect(resultPromise).resolves.toMatchObject({
      exitCode: 0,
      timedOut: false,
    });
    expect(processKill).toHaveBeenCalledWith(-4242, "SIGKILL");
  });
});
