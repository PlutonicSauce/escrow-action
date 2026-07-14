import { describe, expect, it, vi } from "vitest";

import { runCli, type CliDependencies } from "../../src/cli.js";
import type { CheckCommandHandler } from "../../src/commands/check.js";
import type { FixCommandHandler } from "../../src/commands/fix.js";
import type { UiCommandHandler } from "../../src/commands/ui.js";
import {
  CheckFailedError,
  CodexExtractionError,
  ExitCode,
  InvalidRepositoryError,
} from "../../src/utils/errors.js";

interface CliHarness {
  check: ReturnType<typeof vi.fn<CheckCommandHandler>>;
  fix: ReturnType<typeof vi.fn<FixCommandHandler>>;
  ui: ReturnType<typeof vi.fn<UiCommandHandler>>;
  dependencies: CliDependencies;
  stdout: string[];
  stderr: string[];
}

function createHarness(): CliHarness {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const check = vi.fn<CheckCommandHandler>();
  const fix = vi.fn<FixCommandHandler>();
  const ui = vi.fn<UiCommandHandler>();

  return {
    check,
    fix,
    ui,
    dependencies: {
      check,
      fix,
      ui,
      writeOut: (message: string): void => {
        stdout.push(message);
      },
      writeError: (message: string): void => {
        stderr.push(message);
      },
    },
    stdout,
    stderr,
  };
}

describe("runCli", () => {
  it("parses the repository path", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["check", "./example-repository"], harness.dependencies);

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.check).toHaveBeenCalledOnce();
    expect(harness.check).toHaveBeenCalledWith("./example-repository", {});
  });

  it("parses --target", async () => {
    const harness = createHarness();

    const exitCode = await runCli(
      ["check", ".", "--target", "packages/api"],
      harness.dependencies,
    );

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.check).toHaveBeenCalledWith(".", { target: "packages/api" });
  });

  it("parses --model", async () => {
    const harness = createHarness();

    const exitCode = await runCli(
      ["check", ".", "--model", "gpt-5.6-mini"],
      harness.dependencies,
    );

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.check).toHaveBeenCalledWith(".", {
      model: "gpt-5.6-mini",
    });
  });

  it("parses command execution options", async () => {
    const harness = createHarness();

    const exitCode = await runCli(
      [
        "check",
        ".",
        "--execute",
        "--allow-network",
        "--timeout",
        "2.5",
        "--keep-worktree",
      ],
      harness.dependencies,
    );

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.check).toHaveBeenCalledWith(".", {
      execute: true,
      allowNetwork: true,
      timeout: 2.5,
      keepWorktree: true,
    });
  });

  it("parses JSON, Markdown, and HTML report paths", async () => {
    const harness = createHarness();

    const exitCode = await runCli(
      [
        "check",
        ".",
        "--json",
        "artifacts/report.json",
        "--markdown",
        "artifacts/report.md",
        "--html",
        "artifacts/report.html",
      ],
      harness.dependencies,
    );

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.check).toHaveBeenCalledWith(".", {
      json: "artifacts/report.json",
      markdown: "artifacts/report.md",
      html: "artifacts/report.html",
    });
  });

  it("parses fix preview, apply, and compatible execution options", async () => {
    const harness = createHarness();

    const exitCode = await runCli(
      [
        "fix",
        ".",
        "--target",
        "packages/api",
        "--model",
        "gpt-repair",
        "--apply",
        "--execute",
        "--allow-network",
        "--timeout",
        "2.5",
        "--keep-worktree",
      ],
      harness.dependencies,
    );

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.fix).toHaveBeenCalledWith(".", {
      target: "packages/api",
      model: "gpt-repair",
      apply: true,
      execute: true,
      allowNetwork: true,
      timeout: 2.5,
      keepWorktree: true,
    });
    expect(harness.check).not.toHaveBeenCalled();
  });

  it("parses local UI options without enabling browser opening explicitly", async () => {
    const harness = createHarness();

    const exitCode = await runCli(
      [
        "ui",
        ".",
        "--target",
        "packages/api",
        "--port",
        "4173",
        "--model",
        "gpt-ui",
        "--no-open",
        "--execute",
        "--allow-network",
        "--timeout",
        "2.5",
      ],
      harness.dependencies,
    );

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.ui).toHaveBeenCalledWith(".", {
      target: "packages/api",
      port: 4173,
      model: "gpt-ui",
      open: false,
      execute: true,
      allowNetwork: true,
      timeout: 2.5,
    });
    expect(harness.check).not.toHaveBeenCalled();
    expect(harness.fix).not.toHaveBeenCalled();
  });

  it("selects an available port and opens the browser by default", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["ui", "."], harness.dependencies);

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.ui).toHaveBeenCalledWith(".", { open: true });
  });

  it("rejects invalid local UI ports", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["ui", ".", "--port", "70000"], harness.dependencies);

    expect(exitCode).toBe(ExitCode.invalidArguments);
    expect(harness.ui).not.toHaveBeenCalled();
    expect(harness.stderr.join("")).toContain("port must be an integer between 1 and 65535");
  });

  it("rejects invalid command timeouts", async () => {
    const harness = createHarness();

    const exitCode = await runCli(
      ["check", ".", "--timeout", "0"],
      harness.dependencies,
    );

    expect(exitCode).toBe(ExitCode.invalidArguments);
    expect(harness.check).not.toHaveBeenCalled();
    expect(harness.stderr.join("")).toContain("timeout must be a positive number");
  });

  it("returns exit code 2 and a useful error when the repository is missing", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["check"], harness.dependencies);

    expect(exitCode).toBe(ExitCode.invalidArguments);
    expect(harness.check).not.toHaveBeenCalled();
    expect(harness.stderr.join("")).toContain("missing required argument 'repository'");
  });

  it("returns exit code 4 for unexpected internal errors", async () => {
    const harness = createHarness();
    harness.check.mockRejectedValueOnce(new Error("unexpected failure"));

    const exitCode = await runCli(["check", "."], harness.dependencies);

    expect(exitCode).toBe(ExitCode.internalError);
    expect(harness.stderr.join("")).toContain(
      "Internal Escrow error: unexpected failure",
    );
  });

  it("returns exit code 2 for invalid repository input", async () => {
    const harness = createHarness();
    harness.check.mockRejectedValueOnce(
      new InvalidRepositoryError("Target directory is outside the Git repository"),
    );

    const exitCode = await runCli(["check", "."], harness.dependencies);

    expect(exitCode).toBe(ExitCode.invalidArguments);
    expect(harness.stderr.join("")).toContain(
      "error: Target directory is outside the Git repository",
    );
  });

  it("returns exit code 3 for Codex extraction failures", async () => {
    const harness = createHarness();
    harness.check.mockRejectedValueOnce(
      new CodexExtractionError("Codex claim extraction timed out"),
    );

    const exitCode = await runCli(["check", "."], harness.dependencies);

    expect(exitCode).toBe(ExitCode.extractionFailed);
    expect(harness.stderr.join("")).toContain(
      "error: Codex claim extraction timed out",
    );
  });

  it("returns exit code 1 when deterministic claims fail", async () => {
    const harness = createHarness();
    harness.check.mockRejectedValueOnce(new CheckFailedError());

    const exitCode = await runCli(["check", "."], harness.dependencies);

    expect(exitCode).toBe(ExitCode.checkFailed);
    expect(harness.stderr.join("")).toContain(
      "error: One or more Escrow claims failed.",
    );
  });

  it("renders help successfully", async () => {
    const harness = createHarness();

    const exitCode = await runCli(["--help"], harness.dependencies);

    expect(exitCode).toBe(ExitCode.success);
    expect(harness.stdout.join("")).toContain("Usage: escrow");
    expect(harness.stdout.join("")).toContain("local Escrow browser interface");
    expect(harness.stdout.join("")).not.toMatch(/AgentContract|ProofCatcher/u);
    expect(harness.stdout.join("")).toContain("check");
    expect(harness.stdout.join("")).toContain("fix");
    expect(harness.stdout.join("")).toContain("ui");
  });
});
