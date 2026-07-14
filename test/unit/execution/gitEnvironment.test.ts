import { describe, expect, it } from "vitest";

import {
  buildIsolatedGitEnvironment,
  isolatedGitArgs,
} from "../../../src/execution/gitEnvironment.js";

describe("isolated Git lifecycle configuration", () => {
  it("strips Git, shell, loader, and runtime injection variables", () => {
    const environment = buildIsolatedGitEnvironment("/temporary", {
      PATH: "/usr/bin",
      GIT_DIR: "/outside/repository",
      GIT_CONFIG_COUNT: "1",
      BASH_ENV: "/outside/shell-init",
      NODE_OPTIONS: "--require=/outside/module.js",
      LD_PRELOAD: "/outside/library.so",
    });

    expect(environment.PATH).toBe("/usr/bin");
    expect(environment.GIT_DIR).toBeUndefined();
    expect(environment.GIT_CONFIG_COUNT).toBeUndefined();
    expect(environment.BASH_ENV).toBeUndefined();
    expect(environment.NODE_OPTIONS).toBeUndefined();
    expect(environment.LD_PRELOAD).toBeUndefined();
    expect(environment.HOME).toBe("/temporary/git-home");
    expect(environment.GIT_CONFIG_GLOBAL).toBe("/dev/null");
    expect(environment.GIT_CONFIG_NOSYSTEM).toBe("1");
  });

  it("disables repository hooks and external attribute/config files", () => {
    expect(isolatedGitArgs("/repo", ["worktree", "prune"])).toEqual([
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.attributesFile=/dev/null",
      "-c",
      "core.excludesFile=/dev/null",
      "-C",
      "/repo",
      "worktree",
      "prune",
    ]);
  });
});
