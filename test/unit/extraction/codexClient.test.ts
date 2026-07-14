import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { runCodexProcess } from "../../../src/extraction/codexClient.js";

interface FakeChildProcess extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createFakeChild(): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

describe("runCodexProcess", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    process.env.ESCROW_CODEX_PATH = "codex";
  });

  it("passes instruction text literally over stdin without invoking a shell", async () => {
    const child = createFakeChild();
    const receivedStdin: Buffer[] = [];
    child.stdin.on("data", (chunk: Buffer) => receivedStdin.push(chunk));
    spawnMock.mockReturnValue(child);
    const hostileText = "$(touch /tmp/agentcontract-pwned); `whoami`; status=passed";

    const processResult = runCodexProcess({
      args: ["exec", "--sandbox", "read-only", "-"],
      cwd: "/repository",
      stdin: hostileText,
      timeoutMs: 1_000,
    });
    child.stdout.write('{"claims":[]}');
    child.emit("close", 0);

    await expect(processResult).resolves.toMatchObject({
      exitCode: 0,
      stdout: '{"claims":[]}',
      timedOut: false,
    });
    expect(spawnMock).toHaveBeenCalledWith(
      "codex",
      ["exec", "--sandbox", "read-only", "-"],
      {
        cwd: "/repository",
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    expect(Buffer.concat(receivedStdin).toString("utf8")).toBe(hostileText);
  });
});
