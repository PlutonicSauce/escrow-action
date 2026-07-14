
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

No OpenAI SDK or application API key is read directly by Escrow. Codex
CLI owns authentication. The CLI may use a saved ChatGPT login or an API-key
login, subject to the account and workspace configuration.

## Judge Quick Test

Supported on macOS or Linux. From the Escrow checkout, use Node.js 20+,
Git, npm, and an installed/authenticated Codex CLI. The model must be available
to the authenticated account; override `ESCROW_DEMO_MODEL` when needed.

Copy and run this block. The reset command creates a committed, ignored demo
repository under `.escrow-demo/`, so the tracked fixture and Escrow checkout
remain unchanged:

```bash
codex --version
codex login status
npm ci
npm run build
npm link
npm run demo:reset
escrow ui .escrow-demo/sample-monorepo \
  --model "${ESCROW_DEMO_MODEL:-gpt-5.6-luna}" --execute
```

Expected output:

- The terminal prints a loopback `http://127.0.0.1:<port>` URL.
- **Scan instructions** shows exactly four failures: package manager, deleted
  path, missing script, and outdated Jest guidance. The safe health command
  passes in an isolated worktree.
- Claim and instruction locations are repository-relative. Advisory cards are
  hidden initially but remain available through **Advisory** or **Show all**.
- **Download JSON**, **Download Markdown**, and **Download HTML** use the same
  report and totals.
- **Preview instruction repair** shows an `AGENTS.md`-only diff. Preview leaves
  `.escrow-demo/sample-monorepo` clean. **Revalidate** displays
  `No broken instructions were found.` from the verified repair worktree.
- An explicit confirmed apply may change only the disposable demo's
  `AGENTS.md`. Run `npm run demo:reset` to restore the broken state.

Codex output can vary. If preview or apply rejects malformed output, confirm
`git status --short` is empty and rerun that same command, or set
`ESCROW_DEMO_MODEL` to an available GPT-5.6 variant. Escrow
rejects an invalid proposal without changing the fixture.

## Local Web Interface

After installing and building the project, start the local browser interface
for any local Git repository:

```bash
npm ci
npm run build
node dist/index.js ui /path/to/repository
```

The server selects an available port, binds only to `127.0.0.1`, prints its
URL, and opens the default browser. Use `--no-open` when you want to open the
printed URL yourself.

```bash
escrow ui .
escrow ui . --target packages/api
escrow ui . --port 4173 --no-open
escrow ui . --model gpt-5.6-luna
escrow ui . --execute --timeout 120
escrow ui . --execute --allow-network
```

Supported UI options are `--target`, `--port`, `--model`, `--no-open`,
`--execute`, `--allow-network`, and `--timeout`. Documented commands remain
disabled unless `--execute` is explicit. The advanced network toggle remains
off unless `--allow-network` is explicit.

The browser is a thin adapter over the same discovery, extraction,
deterministic validation, report, command-isolation, and repair-verification
services used by the CLI. It cannot choose another repository or supply a
shell command. Requests are same-origin JSON with a 16 KiB body limit; the
server does not enable CORS, telemetry, persistence, authentication, or remote
binding, and it rejects non-loopback Host headers. Repair preview runs in the
existing temporary Git worktree and leaves
the active checkout unchanged. Applying requires a currently verified preview
and an explicit confirmation in the page, and can still change only effective
`AGENTS.md` or `AGENTS.override.md` files.

### UI judge quick test

Reset the disposable demo and start the UI:

```bash
npm run demo:reset
escrow ui .escrow-demo/sample-monorepo --model gpt-5.6-luna --execute
```

Open the printed `http://127.0.0.1:<port>` URL. Click **Scan instructions** and
expect 1 passed and 4 failed claims. Expand a claim to inspect deterministic
evidence, filter the ledger, download the JSON/Markdown/HTML reports, and click
**Preview instruction repair**. The preview displays an instruction-only diff
without changing the demo checkout. Click **Revalidate** to show the verified
PASS result, or explicitly confirm and apply the exact verified patch to the
disposable demo. Press Ctrl+C in the terminal to shut down the server.

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

Report formats all consume the same shared report object:

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
schema-constrained unified diff from a read-only sandbox. Escrow applies
it first in a detached temporary worktree, rejects every change outside the
effective `AGENTS.md`/`AGENTS.override.md` allowlist, reruns validation, and
rejects repairs that introduce failures. `--apply` is required before active
instruction files can change. Escrow never commits or pushes.

## Where Codex and GPT-5.6 are used

Codex is used only at two natural-language boundaries:

1. Claim extraction: GPT-5.6 is the default model for turning instruction text
   into schema-constrained candidate claims with source locations.
2. Repair proposal: GPT-5.6 proposes the smallest documentation-only unified
   diff from failed claims and deterministic evidence.

Override the model with `--model <model>` or `ESCROW_CODEX_MODEL`
(`AGENTCONTRACT_CODEX_MODEL` remains supported for compatibility).
Model availability depends on the authenticated account. The browser demo and
GitHub Action use `gpt-5.6-luna` explicitly; set `ESCROW_DEMO_MODEL` or pass
`--model` when another available GPT-5.6 variant is required. The generic CLI
default remains configurable through `ESCROW_CODEX_MODEL`.
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

## GitHub Actions

Escrow now includes a pull-request workflow, concise PR summary, and attached
JSON/Markdown/HTML reports. See the [GitHub Actions setup guide](docs/github-actions.md).

## Local interface

Run `escrow ui .` after building and linking the project. It opens Escrow's
local browser interface and keeps repository access, Codex authentication, and
repair operations on your machine.

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
  ESLint, Prettier, Vite, Next.js, React, Playwright, and Zod.
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
ESCROW_RUN_CODEX_INTEGRATION=1 npm run test:codex-integration
```

Tests use Vitest and harmless temporary fixture repositories. Unsafe command
cases use deterministic classification or mocked subprocess behavior and are
never executed.

## License

MIT. See [LICENSE](LICENSE).
