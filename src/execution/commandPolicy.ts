export type CommandPolicyCategory =
  | "allowed"
  | "invalid"
  | "sensitive_access"
  | "privilege_escalation"
  | "system_destructive"
  | "git_destructive"
  | "filesystem_destructive"
  | "external_write"
  | "interactive_credentials"
  | "network_disabled";

export interface CommandPolicyOptions {
  allowNetwork: boolean;
}

export interface CommandPolicyDecision {
  allowed: boolean;
  category: CommandPolicyCategory;
  reason: string;
}

function block(category: Exclude<CommandPolicyCategory, "allowed">, reason: string) {
  return { allowed: false, category, reason } as const;
}

const SENSITIVE_PATH_PATTERN =
  /(?:^|[\/\s"'])(?:~\/)?(?:\.ssh|\.aws|\.gnupg|\.mozilla)(?:[\/\s"']|$)|(?:google[\/-]chrome|chromium|firefox|chrome[\/]user data|bravesoftware|microsoft edge|opera|vivaldi|library[\/]safari|library[\/]application support[\/](?:google[\/]chrome|firefox|bravesoftware|microsoft edge))/iu;

const SENSITIVE_ENV_PATTERN =
  /\$(?:\{)?(?:HOME|USERPROFILE|SSH_AUTH_SOCK|AWS_CONFIG_FILE|AWS_SHARED_CREDENTIALS_FILE|GNUPGHOME)(?:\})?/u;

const PRIVILEGE_PATTERN =
  /(?:^|[\s;&|(),:=]|\[|\{)(?:sudo|su)(?:\s|$)/iu;

const DYNAMIC_SHELL_PATTERN =
  /`|\$|[<>]\(|(?:^|[\s;&|(),:=]|\[|\{)(?:eval|source|xargs|parallel|nohup|setsid|disown)(?:\s|$)|(?:^|[\s;&|(),:=]|\[|\{)(?:(?:env|command|exec)\s+)*(?:sh|bash|dash|ash|zsh|ksh|fish|csh|tcsh)(?:\s|$)|(?:^|[\s;&|(),:=]|\[|\{)busybox\s+sh(?:\s|$)|(?:^|[\s;&|(),:=]|\[|\{)find\s+[^;&|]*(?:-exec|-execdir)(?:\s|$)|(?:^|[;&|])\s*\.\s+/iu;

const BACKGROUND_OPERATOR_PATTERN = /(?:^|[^&>|])&(?:[^&>0-9-]|$)/u;

const EXECUTION_ENVIRONMENT_ASSIGNMENT_PATTERN =
  /(?:^|\s)(?:PATH|HOME|SHELL|IFS|ENV|BASH_ENV|NODE_OPTIONS|PYTHONPATH|RUBYOPT|PERL5OPT|LD_PRELOAD|LD_LIBRARY_PATH|DYLD_[A-Za-z0-9_]+|GIT_[A-Za-z0-9_]+)=/iu;

const PIPE_TO_INTERPRETER_PATTERN =
  /\|\s*(?:(?:env|command|exec)\s+)*(?:sh|bash|dash|ash|zsh|ksh|fish|csh|tcsh|python[0-9.]*|perl|ruby|node|busybox\s+sh)(?:\s|$)/iu;

const SYSTEM_DESTRUCTIVE_PATTERNS: readonly RegExp[] = [
  /(?:^|[\s;&|(),:=]|\[|\{)(?:shutdown|reboot|halt|poweroff)(?:\s|$)/iu,
  /(?:^|[\s;&|(),:=]|\[|\{)mkfs(?:\.|\s|$)/iu,
  /(?:^|[\s;&|(),:=]|\[|\{)diskutil\s+erase/iu,
];

const ALLOWED_GIT_SUBCOMMANDS = new Set([
  "cat-file",
  "describe",
  "diff",
  "grep",
  "log",
  "ls-files",
  "name-rev",
  "rev-parse",
  "shortlog",
  "show",
  "status",
]);

const FILESYSTEM_DESTRUCTIVE_PATTERNS: readonly RegExp[] = [
  /(?:^|[\s;&|(),:=]|\[|\{)rm\s+(?=[^\n;|]*(?:-[^\s]*[rR]|--recursive))(?=[^\n;|]*(?:-[^\s]*f|--force))/iu,
  /(?:^|[\s;&|(),:=]|\[|\{)chmod\s+(?:-[^\s]*[rR]|--recursive)\s+777(?:\s|$)/iu,
  /(?:^|[\s;&|(),:=]|\[|\{)chown\s+(?:-[^\s]*[rR]|--recursive)(?:\s|$)/iu,
  /(?:curl|wget)[^\n|]*\|\s*(?:ba)?sh(?:\s|$)/iu,
];

const INTERACTIVE_CREDENTIAL_PATTERN =
  /(?:^|[\s;&|(),:=]|\[|\{)(?:ssh|scp|sftp)(?:\s|$)|(?:npm|pnpm)\s+(?:adduser|login)|yarn\s+npm\s+login|(?:docker|podman)\s+login|gh\s+auth|aws\s+configure|gcloud\s+auth|git\s+credential/iu;

const NETWORK_PATTERN =
  /(?:^|[\s;&|])(?:curl|wget|ftp|telnet|nc|netcat)(?:\s|$)|git\s+(?:clone|fetch|pull|ls-remote)(?:\s|$)|(?:npm|pnpm|yarn)\s+(?:install|add|publish)|(?:npx|pnpm\s+dlx|yarn\s+dlx)(?:\s|$)/iu;

const EXTERNAL_REDIRECTION_PATTERN =
  /(?:^|\s)(?:>{1,2}|<{1,2})\s*(?:~(?:[A-Za-z0-9._-]+)?(?:\/|$)|\.\.(?:\/|$)|\/(?!dev\/null(?:\s|$)))/u;

const EXTERNAL_ABSOLUTE_OR_HOME_PATTERN =
  /(?:^|[\s"'(=,:])(?:~(?:[A-Za-z0-9._-]+)?(?:\/|$)|\/(?!\/|dev\/null(?:[\s"')]|$)))/u;

const PARENT_TRAVERSAL_PATTERN =
  /(?:^|[\/\s"'(=,:])\.\.(?:\/|$)/u;

const DOUBLE_SLASH_PATH_PATTERN =
  /(?:^|[\s"'(=,])\/{2,}(?!\/)/u;

function normalizePolicyText(command: string): string {
  return command.replace(/\\(.)/gu, "$1").replace(/["']/gu, "");
}

function gitPolicyDecision(
  command: string,
): CommandPolicyDecision | undefined {
  const segments = command.split(/&&|\|\||[;&|]/u);

  for (const segment of segments) {
    const tokens = segment
      .trim()
      .split(/[\s()[\]{},:=]+/u)
      .filter(Boolean);

    for (const [index, token] of tokens.entries()) {
      if (token !== "git") {
        continue;
      }
      const subcommand = tokens[index + 1];
      if (
        /(?:^|\s)GIT_[A-Za-z0-9_]*=/u.test(segment) ||
        subcommand === undefined ||
        !ALLOWED_GIT_SUBCOMMANDS.has(subcommand)
      ) {
        return block(
          "git_destructive",
          "only an explicit allowlist of read-only Git subcommands is permitted; aliases, config overrides, and mutating Git commands are prohibited",
        );
      }
    }
  }

  return undefined;
}

export function classifyCommand(
  command: string,
  options: CommandPolicyOptions,
): CommandPolicyDecision {
  if (command.trim().length === 0) {
    return block("invalid", "the command is empty");
  }
  if (command.includes("\0") || /[\r\n]/u.test(command)) {
    return block("invalid", "multiline commands and control characters are unsupported");
  }
  const policyText = normalizePolicyText(command);
  if (FILESYSTEM_DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(policyText))) {
    return block("filesystem_destructive", "destructive filesystem commands are prohibited");
  }
  if (
    DYNAMIC_SHELL_PATTERN.test(policyText) ||
    BACKGROUND_OPERATOR_PATTERN.test(policyText) ||
    EXECUTION_ENVIRONMENT_ASSIGNMENT_PATTERN.test(policyText) ||
    PIPE_TO_INTERPRETER_PATTERN.test(policyText)
  ) {
    return block(
      "invalid",
      "dynamic shell evaluation, nested executors, and background commands are unsupported",
    );
  }

  if (SENSITIVE_PATH_PATTERN.test(policyText) || SENSITIVE_ENV_PATTERN.test(policyText)) {
    return block(
      "sensitive_access",
      "access to credential directories, browser profiles, or sensitive environment paths is prohibited",
    );
  }
  if (PRIVILEGE_PATTERN.test(policyText)) {
    return block("privilege_escalation", "privilege-escalation commands are prohibited");
  }
  if (SYSTEM_DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(policyText))) {
    return block("system_destructive", "system-destructive commands are prohibited");
  }
  const gitDecision = gitPolicyDecision(policyText);
  if (gitDecision !== undefined) {
    return gitDecision;
  }
  if (INTERACTIVE_CREDENTIAL_PATTERN.test(policyText)) {
    return block(
      "interactive_credentials",
      "commands requiring interactive credentials are prohibited",
    );
  }
  if (
    EXTERNAL_REDIRECTION_PATTERN.test(policyText) ||
    EXTERNAL_ABSOLUTE_OR_HOME_PATTERN.test(policyText) ||
    PARENT_TRAVERSAL_PATTERN.test(policyText) ||
    DOUBLE_SLASH_PATH_PATTERN.test(policyText)
  ) {
    return block(
      "external_write",
      "absolute, home-relative, and parent-directory paths are prohibited during command execution",
    );
  }
  const mayUseNetwork = NETWORK_PATTERN.test(policyText);
  if (mayUseNetwork && /&&|\|\||[;|]/u.test(policyText)) {
    return block(
      "filesystem_destructive",
      "network-capable commands cannot be chained or piped to another command",
    );
  }
  if (!options.allowNetwork && mayUseNetwork) {
    return block(
      "network_disabled",
      "the command may access the network; pass --allow-network to opt in",
    );
  }

  return {
    allowed: true,
    category: "allowed",
    reason: options.allowNetwork
      ? "the command passed deterministic safety checks with network access allowed"
      : "the command passed deterministic safety checks with network access disabled",
  };
}
