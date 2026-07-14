
# Escrow

> Executable tests for the instructions coding agents rely on.

Escrow verifies whether `AGENTS.md` and `AGENTS.override.md` still match
the repository they describe. It uses Codex to extract structured candidate
claims, then assigns every status through deterministic TypeScript validators.
It can optionally execute documented commands in isolated Git worktrees,
produce four evidence-report formats, and preview or apply restricted repairs
to instruction files only.

## Supported claim types

| Claim type | Deterministic check |
| --- | --- |
| `path_exists` | A referenced file or directory exists inside the repository. |
| `package_manager` | npm, pnpm, or Yarn guidance matches lockfiles and `packageManager` metadata. |
| `package_script` | A documented npm, pnpm, or Yarn script exists in the nearest `package.json`. |
| `dependency_present` | A supported framework/tool is declared in a dependency section. |
| `command_runs` | With `--execute`, the documented command passes inside a temporary Git worktree. |
| `advisory` | Non-verifiable guidance is preserved but never counted as passed or failed. |

Nested instruction files are resolved from the Git root toward the selected
target. A non-empty `AGENTS.override.md` wins over `AGENTS.md` only in the same
directory, and valid nested overrides do not become false conflicts.

## Requirements

- Node.js 20 or newer
- Git
- npm for installing and building Escrow
- macOS or Linux
- Codex CLI installed, authenticated, and available as `codex`

Escrow invokes Codex non-interactively with `codex exec`. Verify the
prerequisite with:

```bash
codex --version
codex login status
```

If needed, authenticate interactively with `codex login`, or use the API-key
login described in the official [Codex authentication documentation](https://learn.chatgpt.com/docs/auth).
See the official [Codex CLI documentation](https://learn.chatgpt.com/docs/codex/cli)
and [non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode)
for installation and automation details.

## Install from a checkout

```bash
npm ci
npm run build
node dist/index.js --help
```

Optionally expose the local binary through npm:

```bash
npm link
escrow --help
```

No OpenAI SDK or application API key is read directly by AgentContract. Codex
CLI owns authentication. The CLI may use a saved ChatGPT login or an API-key
login, subject to the account and workspace configuration.

## Judge Quick Test

Supported on macOS or Linux. From the AgentContract checkout, use Node.js 20+,
Git, npm, and an installed/authenticated Codex CLI. The model must be available
to the authenticated account; override `AGENTCONTRACT_DEMO_MODEL` when needed.

Copy and run this block. It creates a committed temporary copy, so the bundled
demo and AgentContract checkout remain unchanged:

```bash
codex --version
codex login status
npm ci
npm run build

DEMO_HOME="$(mktemp -d)"
DEMO_REPO="$DEMO_HOME/sample-monorepo"
HTML_REPORT="$DEMO_HOME/agentcontract-report.html"
MODEL="${AGENTCONTRACT_DEMO_MODEL:-gpt-5.6-sol}"

cp -R demo/sample-monorepo "$DEMO_REPO"
git -C "$DEMO_REPO" init --quiet
git -C "$DEMO_REPO" config user.name "AgentContract Judge"
git -C "$DEMO_REPO" config user.email "judge@example.invalid"
git -C "$DEMO_REPO" add .
git -C "$DEMO_REPO" commit --quiet -m "judge demo baseline"

node dist/index.js check "$DEMO_REPO" --execute --model "$MODEL" \
  --html "$HTML_REPORT"
CHECK_EXIT=$?
test "$CHECK_EXIT" -eq 1

printf 'Open this static report in a browser: %s\n' "$HTML_REPORT"
test -s "$HTML_REPORT"

node dist/index.js fix "$DEMO_REPO" --model "$MODEL"
git -C "$DEMO_REPO" status --short

node dist/index.js fix "$DEMO_REPO" --apply --model "$MODEL"
git -C "$DEMO_REPO" diff --name-only
sed -n '1,8p' "$DEMO_REPO/AGENTS.md"
node dist/index.js check "$DEMO_REPO" --execute --model "$MODEL"
```

Expected output:

- The first check prints `AgentContract: FAIL`, with `1 passed, 4 failed`, and
  exits `1`. The failures cover package manager, deleted path, missing script,
  and absent Jest; the health command passes in an isolated worktree.
- `$HTML_REPORT` is a non-empty, self-contained report with the same totals,
  source locations, evidence, and expandable command output.
- Preview prints `=== Verified instruction diff ===` and an after-report with
  zero failures and one unexecuted command; the passed count can include
  additional valid claims. The following `git status --short` prints nothing
  because preview does not change the active fixture.
- Verified apply prints only `AGENTS.md` from `git diff --name-only`. The file
  now says pnpm and `pnpm test:unit`; the final check prints
  `AgentContract: PASS` with at least `3 passed, 0 failed`.

Codex output can vary. If preview or apply rejects malformed output, confirm
`git status --short` is empty and rerun that same command, or set
`AGENTCONTRACT_DEMO_MODEL` to an available GPT-5.6 variant. AgentContract
rejects an invalid proposal without changing the fixture.

## Check a repository

```bash
escrow check .
escrow check . --target packages/api
escrow check . --execute --timeout 120
escrow check . --json report.json
escrow check . --markdown report.md
escrow check . --html report.html
```

If npm linking was skipped, replace `escrow` with
`node /path/to/escrow/dist/index.js`.

Report formats all consume the same `AgentContractReport` object:

- console for immediate feedback
- JSON for automation
- Markdown for pull requests or submissions
- one self-contained static HTML file that opens without a server

Exit codes are `0` for no deterministic failures, `1` for failed claims, `2`
for invalid arguments/repositories, `3` for Codex extraction/repair failures,
and `4` for unexpected internal errors. Warnings, blocked commands, and
inconclusive claims do not return `1` in the MVP.

## Restricted repair mode

```bash
escrow fix .            # verified preview; active checkout unchanged
escrow fix . --apply    # apply only the verified instruction patch
```

Repair mode requires a clean active repository. Codex proposes a
schema-constrained unified diff from a read-only sandbox. AgentContract applies
it first in a detached temporary worktree, rejects every change outside the
effective `AGENTS.md`/`AGENTS.override.md` allowlist, reruns validation, and
rejects repairs that introduce failures. `--apply` is required before active
instruction files can change. AgentContract never commits or pushes.

## Where Codex and GPT-5.6 are used

Codex is used only at two natural-language boundaries:

1. Claim extraction: GPT-5.6 is the default model for turning instruction text
   into schema-constrained candidate claims with source locations.
2. Repair proposal: GPT-5.6 proposes the smallest documentation-only unified
   diff from failed claims and deterministic evidence.

Override the model with `--model <model>` or `ESCROW_CODEX_MODEL`
(`AGENTCONTRACT_CODEX_MODEL` remains supported for compatibility).
Model availability depends on the authenticated account. The demo script uses
`gpt-5.6-terra` by default and accepts `ESCROW_DEMO_MODEL` when another
available GPT-5.6 variant is required.
Codex never assigns pass/fail/warning/blocked/inconclusive/overridden verdicts,
never determines instruction applicability, and never applies a repair.

## Safety model

- AI output is constrained with JSON Schema and validated again with Zod.
- All verdicts, totals, scopes, overrides, and supported conflicts are
  deterministic.
- Documented commands run only with `--execute` and only in temporary Git
  worktrees, never in the active checkout.
- Recognized dangerous command forms, network-capable commands without
  `--allow-network`, credential paths, traversal, and unsafe shell constructs
  are blocked before execution.
- Repair patches may update only existing effective instruction files. Source,
  tests, packages, lockfiles, build/CI files, symlinks, binary data, creations,
  deletions, renames, and mode changes are rejected.
- Repair preview is the default; `--apply` is explicit, and no commit or push is
  performed.

See [architecture.md](docs/architecture.md) for trust boundaries and lifecycle
details.

## Landing page

The static judge-facing site lives in [`site/`](site). Run `npm run site`, then
open <http://localhost:4173>. Its terminal, report, and documentation links are
backed by the included demo assets.

## Demo

The broken-instructions sample shows all MVP claim categories requested for the
demo, a valid nested override, isolated command execution, restricted repair,
and all report formats:

- [three-minute demo script](docs/demo-script.md)
- [sample monorepo](demo/sample-monorepo)
- [dangerous-command fixture](demo/dangerous-command-fixture)
- [sample reports](demo/sample-reports)

## Known limitations

- Local Git repositories on macOS and Linux only; Windows is not supported by
  the MVP.
- JavaScript/TypeScript package evidence only, with npm, pnpm, and Yarn.
- Dependency recognition is intentionally limited to Vitest, Jest, TypeScript,
  ESLint, Prettier, Vite, Next.js, React, and Playwright.
- Global instruction discovery and the documented `--include-global` flag are
  not implemented in the current MVP.
- The documented `--verbose` flag is not implemented; normal CLI errors still
  include actionable messages and exit codes.
- Report output directories must already exist.
- Network denial is policy- and environment-based where practical, not a
  portable OS-level network namespace on every supported host.
- Command policy evaluates the documented command itself. A repository script
  accepted by that policy is not contained by a portable OS-level filesystem
  sandbox, so its transitive behavior must still be trusted.
- Repair mode requires a clean active checkout and updates existing effective
  instruction files only.
- Extraction and repair require a working Codex CLI session and access to the
  selected model. Automated tests mock Codex; the live integration test is
  explicitly opt-in.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Optional live Codex extraction test:

```bash
AGENTCONTRACT_RUN_CODEX_INTEGRATION=1 npm run test:codex-integration
```

Tests use Vitest and harmless temporary fixture repositories. Unsafe command
cases use deterministic classification or mocked subprocess behavior and are
never executed.

## License

MIT. See [LICENSE](LICENSE).
