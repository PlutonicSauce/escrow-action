import { join } from "node:path";

const UNSAFE_GIT_ENVIRONMENT_NAME =
  /^(?:GIT_.+|BASH_ENV|ENV|BASHOPTS|SHELLOPTS|CDPATH|PROMPT_COMMAND|NODE_OPTIONS|PYTHONPATH|PYTHONSTARTUP|RUBYOPT|PERL5OPT|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_.+|BASH_FUNC_.+)$/iu;

export function buildIsolatedGitEnvironment(
  runtimeDirectory: string,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(baseEnvironment)) {
    if (!UNSAFE_GIT_ENVIRONMENT_NAME.test(name) && value !== undefined) {
      environment[name] = value;
    }
  }

  environment.HOME = join(runtimeDirectory, "git-home");
  environment.XDG_CONFIG_HOME = join(runtimeDirectory, "git-config");
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_CONFIG_GLOBAL = "/dev/null";
  environment.GIT_CONFIG_SYSTEM = "/dev/null";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GIT_ASKPASS = "/bin/false";
  return environment;
}

export function isolatedGitArgs(
  repositoryRoot: string,
  args: readonly string[],
): string[] {
  return [
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.attributesFile=/dev/null",
    "-c",
    "core.excludesFile=/dev/null",
    "-C",
    repositoryRoot,
    ...args,
  ];
}
