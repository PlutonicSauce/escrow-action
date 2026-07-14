# AgentContract — Devpost submission

## Project name

AgentContract

## Tagline

> Executable tests for the instructions coding agents rely on.

## Category

Developer Tools

## Main description

Coding agents rely on repository instructions such as `AGENTS.md` and
`AGENTS.override.md`. Those files often describe the package manager, test
commands, installed frameworks, and documents that contributors should read.
As a repository evolves, the instructions can quietly become stale even though
they still look authoritative.

AgentContract is a local CLI that checks those instructions against the
repository they describe. It uses Codex with GPT-5.6 to convert natural-language
instructions into schema-constrained candidate claims, but it does not let the
model decide whether anything passed. TypeScript validators compare each claim
with concrete Git and package evidence, optionally execute documented commands
in temporary Git worktrees, and produce console, JSON, Markdown, and standalone
HTML reports with source locations and deterministic evidence.

The included demo repository intentionally says npm while using pnpm, points to
a deleted document, references a missing test script, and claims Jest is
installed while declaring Vitest. AgentContract reports all four discrepancies,
recognizes a valid nested pnpm override, safely runs a documented health check
outside the active checkout, and can ask Codex for a minimal `AGENTS.md` repair.
The repair is accepted only after deterministic changed-file checks and a full
revalidation.

## The problem

Repository instruction files are operational inputs for coding agents, but
normal build and test suites rarely verify them. A stale instruction can send an
agent toward a deleted file, the wrong package manager, a nonexistent script,
or a framework that is no longer installed. The text remains plausible, so the
failure may appear only after an agent has already acted on it.

## The solution

AgentContract turns the verifiable parts of repository guidance into evidence-
backed checks:

- `path_exists`: referenced files and directories must exist inside the Git
  repository;
- `package_manager`: npm, pnpm, or Yarn guidance must match lockfiles and
  `package.json#packageManager` evidence;
- `package_script`: documented npm, pnpm, or Yarn scripts must exist in the
  nearest applicable `package.json`;
- `dependency_present`: supported framework and tool claims must match declared
  dependency metadata;
- `command_runs`: documented commands may be executed only when `--execute` is
  explicit and only in a temporary Git worktree;
- `advisory`: non-verifiable guidance is preserved without affecting pass/fail
  totals.

Nested instruction files are resolved from the Git root toward a selected
target. More specific instructions can override broader guidance within their
subtree without becoming false conflicts.

## How it works

1. Resolve the canonical Git root and target directory.
2. Walk root-to-target, selecting at most one non-empty instruction file per
   directory. `AGENTS.override.md` takes precedence over `AGENTS.md` only in the
   same directory.
3. Send the numbered instruction content to Codex non-interactively in a
   read-only sandbox with a strict output schema.
4. Validate the response again with Zod, including claim type, exact source
   file, line range, original text, normalized value, scope, confidence, and
   extraction reason.
5. Run deterministic validators against repository paths, package metadata,
   scopes, overrides, and supported conflicts.
6. When `--execute` is present, classify the documented command and run allowed
   commands in a detached temporary Git worktree with timeout and output
   capture.
7. Aggregate one shared `AgentContractReport` and render it as console, JSON,
   Markdown, or self-contained HTML.
8. In repair mode, ask Codex for a minimal documentation-only diff, verify the
   patch in a temporary worktree, rerun AgentContract, reject new failures, and
   modify the active checkout only when `--apply` is explicit.

## Technical architecture

AgentContract is a Node.js 20+ ESM CLI written in strict TypeScript. Commander
provides the command-line interface, Zod validates external and AI-generated
data, and Vitest covers unit and Git-backed integration behavior. The runtime
dependency set is intentionally limited to Commander and Zod.

```text
Git repository + target
        |
        v
instruction discovery and deterministic scope
        |
        v
Codex read-only extraction -> JSON Schema -> Zod
        |
        v
deterministic validators and conflict handling
        |
        +---- static repository/package evidence
        |
        +---- optional policy -> temporary Git worktree -> command result
        |
        v
one shared AgentContractReport
        |
        +---- console
        +---- JSON
        +---- Markdown
        +---- standalone HTML
```

Discovery, extraction, validation, execution, repair, reporting, and domain
models are kept in separate modules. Report renderers consume the same report
object so totals and overall status do not drift between formats.

## Where Codex accelerated development

Codex was used as the coding and audit assistant for the milestone-scoped
implementation: inspecting the repository, implementing focused TypeScript
modules, creating fixtures and tests, running build/typecheck/test loops,
reviewing security boundaries, and preparing the demo and onboarding
documentation. Live acceptance runs also helped expose narrow schema and prompt
compatibility defects that were then fixed and regression-tested.

Codex did not replace the product's deterministic validation or automated test
suite. No development speedup percentage or comparative benchmark was measured.

## Where GPT-5.6 is used at runtime

GPT-5.6 is used only through the installed Codex CLI at two natural-language
boundaries:

1. **Claim extraction:** turn instruction text into schema-constrained candidate
   claims with exact source locations.
2. **Repair proposal:** propose the smallest truthful unified diff for effective
   `AGENTS.md` or `AGENTS.override.md` files from failed claims and deterministic
   evidence.

GPT-5.6 does not assign pass, fail, warning, blocked, inconclusive, advisory, or
overridden statuses. It does not decide which instruction files apply, execute
documented commands, accept patches, or calculate report totals. The default
model is `gpt-5.6`; users can override it with `--model` or
`AGENTCONTRACT_CODEX_MODEL`, subject to their Codex account's model access.

## Key design decisions made by the team

- **Separate interpretation from truth.** AI identifies candidate meaning;
  deterministic code assigns every verdict.
- **Preserve provenance.** Every extracted claim retains its instruction file,
  line range, and original text.
- **Treat scope as a path problem.** Canonical path ancestry determines
  applicability, nested overrides, and supported conflicts; AI is not a policy
  engine.
- **Make execution opt-in and isolated.** Commands are not run by default and
  never run in the active checkout.
- **Use one report model.** Console, JSON, Markdown, and HTML share totals,
  statuses, evidence, and command results.
- **Restrict repair to documentation.** Repair mode cannot change source, tests,
  package metadata, lockfiles, build configuration, or CI configuration.
- **Prefer a small local tool.** There is no database, server, React UI,
  authentication layer, hosted service, or repository integration in the MVP.

## Safety model

AgentContract reduces risk through layered, fail-closed boundaries:

- AI output is constrained by JSON Schema and validated again with Zod.
- Source paths, exact source text, line ranges, scope, and supported claim types
  are checked after extraction.
- Repository paths are bounded canonically and path validation does not follow
  symlinks.
- Documented commands require `--execute`, pass a deterministic policy first,
  and run in detached temporary Git worktrees with timeouts and captured output.
- Recognized destructive commands, unsafe shell constructs, credential paths,
  traversal, and network-capable command forms without explicit permission are
  blocked and reported.
- Repair previews are the default. Candidate patches are limited to existing
  effective instruction files, checked for structural and binary changes,
  revalidated, and rejected if they introduce new failures.
- AgentContract never commits or pushes.

This is not a universal host sandbox. Network denial is policy- and environment-
based where practical, and an otherwise allowed repository script is not
contained against every possible transitive filesystem behavior.

## Supported platforms and scope

- macOS and Linux;
- local Git repositories;
- Node.js 20 or newer;
- JavaScript and TypeScript package evidence;
- npm, pnpm, and Yarn;
- root and nested `AGENTS.md` and `AGENTS.override.md` files;
- deterministic dependency mappings for Vitest, Jest, TypeScript, ESLint,
  Prettier, Vite, Next.js, React, and Playwright;
- console, JSON, Markdown, and self-contained static HTML reports.

## Repository setup summary

Prerequisites:

- Node.js 20+;
- Git;
- npm;
- macOS or Linux;
- Codex CLI installed, authenticated, and available as `codex` for extraction
  and repair.

Install and verify from a checkout:

```bash
codex --version
codex login status
npm ci
npm run build
node dist/index.js --help
```

Optionally run `npm link` to expose the local `agentcontract` binary. Otherwise,
use `node /path/to/agentcontract/dist/index.js` directly.

Basic usage:

```bash
agentcontract check /path/to/repository
agentcontract check /path/to/repository --target packages/api
agentcontract check /path/to/repository --execute --timeout 120
agentcontract check /path/to/repository \
  --json report.json --markdown report.md --html report.html
agentcontract fix /path/to/repository
agentcontract fix /path/to/repository --apply
```

## Testing instructions

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The normal suite uses mocked Codex subprocesses and harmless temporary Git
fixtures; it does not require a live Codex request. The current verified suite
contains 402 passing tests across 30 test files.

The optional live extraction test is explicitly gated:

```bash
AGENTCONTRACT_RUN_CODEX_INTEGRATION=1 npm run test:codex-integration
```

## Known limitations

- Windows is not supported by the MVP.
- Repository and package validation is limited to local Git repositories and
  JavaScript/TypeScript package evidence.
- Only npm, pnpm, and Yarn are recognized.
- Framework/tool recognition uses the fixed mappings listed above rather than
  arbitrary semantic dependency inference.
- Global instruction discovery and the documented `--include-global` flag are
  not implemented.
- The documented `--verbose` flag is not implemented.
- Report parent directories must already exist.
- Extraction and repair require a working, authenticated Codex CLI and access
  to the selected model. Live natural-language output and service latency can
  vary.
- Network restriction is not a portable packet-level sandbox, and command
  policy cannot guarantee the transitive behavior of an allowed repository
  script.
- Repair mode requires a clean active checkout and updates existing effective
  instruction files only.
- AgentContract does not provide Windows support, hosted UI, React, GitHub or
  GitLab integration, pull-request comments, accounts, dashboards, repository
  indexing, vulnerability scanning, general code review, automatic source-code
  repair, commits, or pushes.

## License

MIT
