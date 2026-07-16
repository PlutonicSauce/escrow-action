# Escrow — OpenAI Build Week submission draft

## Submission details

- **Project name:** Escrow
- **Tagline:** Executable tests for the instructions coding agents rely on.
- **Selected track:** Developer Tools
- **Repository:** <https://github.com/PlutonicSauce/escrow>
- **License:** MIT
- **Public YouTube URL:** **TODO — add public YouTube URL**
- **Codex `/feedback` Session ID:** **TODO — add the submitted Codex Session ID**
- **GitHub Release URL:** **TODO — add after creating and verifying a tagged release**
- **Entrant/team information:** **TODO — add entrant name, team name if
  applicable, and required profile details**

## The problem

Coding agents depend on repository instructions such as `AGENTS.md` and
`AGENTS.override.md`. Those files can tell an agent which package manager to
use, which tests to run, which framework is installed, and which documents to
read before changing code. Repositories evolve, but instruction files are not
normally part of the build. A stale sentence can remain plausible and
authoritative long after the repository evidence has changed.

Most instruction-enforcement tools ask whether an agent followed its
instructions. Escrow asks a different question: do the instructions themselves
still match repository reality?

## What Escrow does

Escrow is a local CLI and loopback-only web interface that discovers effective
coding-agent instructions, extracts verifiable claims, and checks those claims
against deterministic repository evidence. It supports:

- referenced files and directories;
- npm, pnpm, and Yarn package-manager guidance;
- documented package scripts;
- a fixed, deterministic set of framework and tool dependencies;
- opt-in execution of documented commands in temporary Git worktrees; and
- advisory guidance that remains visible without affecting pass/fail totals.

Every result includes its instruction source and deterministic evidence.
Console, JSON, Markdown, standalone HTML, and the browser interface consume the
same report model. Escrow can also ask Codex for a minimal instruction-only
repair, verify it away from the active checkout, and show the result as a
preview before any active file may change.

The bundled synthetic monorepo demonstrates four realistic stale claims: it
says npm while using pnpm, requires a deleted document, names a missing test
script, and says Jest is installed while declaring Vitest. The verified fixture
result is exactly one passing isolated health command and four deterministic
failures. Its nested pnpm override is valid and is not reported as a conflict.

## How it works

1. Escrow resolves the canonical Git root and validates the selected target.
2. It walks from the root to that target. In each directory it selects at most
   one non-empty file, preferring `AGENTS.override.md` over `AGENTS.md` only in
   that directory.
3. It sends numbered instruction contents to Codex non-interactively in a
   read-only extraction environment with schema-constrained JSON output.
4. Zod validates the raw claims. Raw model output contains source locations,
   normalized claim fields, confidence, and an extraction reason; it does not
   supply trusted repository evidence.
5. Escrow exactly matches each source file to the discovered instruction
   chain, validates the inclusive line range, derives scope from discovery
   metadata, and reconstructs `originalText` from the repository file itself.
   There is no fuzzy matching and AI-generated text cannot become evidence.
6. Deterministic TypeScript validators assign every verdict using canonical
   paths, lockfiles, `package.json` metadata, nested scope, overrides, and the
   narrow supported conflict rules.
7. With `--execute`, a deterministic command policy runs before an allowed
   command is launched in a detached temporary Git worktree. Escrow captures
   stdout, stderr, exit code, duration, and working directory.
8. Repair mode gives Codex the effective instruction chain, failures,
   deterministic evidence, and an exact file allowlist. Escrow applies the
   proposed patch in another temporary worktree, rejects forbidden changes or
   new failures, and requires explicit `--apply` before changing an active
   instruction file.

## Technical architecture

Escrow is a Node.js 20+ ESM application written in strict TypeScript. Its main
boundaries are deliberately separate:

```text
Git repository and target
          |
          v
deterministic discovery and scope
          |
          v
Codex raw extraction -> JSON Schema -> Zod
          |
          v
deterministic source hydration and validators
          |
          +---- repository and package evidence
          |
          +---- opt-in policy -> temporary worktree -> command result
          |
          v
one shared report object
          |
          +---- console / JSON / Markdown / static HTML / local UI
```

Discovery, extraction, validation, execution, repair, reporting, and web
adapter code live in separate modules. The local UI uses Node's HTTP server and
plain HTML, CSS, and JavaScript; it binds only to `127.0.0.1` and does not add a
database, hosted service, telemetry, authentication system, or React runtime.

## How Codex accelerated development

The tracked implementation history begins on July 13, 2026, during the July
13–21 OpenAI Build Week submission period. The history and dated
`IMPLEMENTATION.md` record Codex-assisted work across architecture planning,
milestone-scoped TypeScript implementation, fixture and test generation,
security reviews, debugging, documentation, packaging, demo preparation, and
local UI integration.

Concrete examples include iterating on the raw-claim/source-hydration boundary,
testing path traversal and command-policy bypasses, resolving incomplete rebase
conflicts without discarding newer architecture, generating focused Git-backed
fixtures, and repeatedly running build/typecheck/test acceptance loops. Live
acceptance work exposed narrow schema, prompt, and model-output compatibility
problems that were fixed and covered by regression tests.

Codex accelerated those engineering loops; it was not the acceptance
authority. The builder retained the product boundaries, reviewed changes, and
used deterministic code and tests to decide whether the work was correct. No
speedup percentage, benchmark, or share-of-code metric was measured.

## How GPT-5.6 is integrated at runtime

This is separate from using Codex to build Escrow. At runtime Escrow invokes
the installed Codex CLI at two natural-language boundaries:

1. **Claim extraction.** GPT-5.6 converts numbered instruction text into typed,
   schema-constrained raw claims with exact source locations and normalized
   fields.
2. **Restricted repair proposal.** GPT-5.6 proposes the smallest truthful
   unified diff for the effective instruction files, based on deterministic
   failures and evidence.

GPT-5.6 does not assign verdicts, decide which instruction files apply, provide
trusted `originalText`, execute commands, accept repairs, or calculate totals.
Those responsibilities stay in deterministic TypeScript.

The generic CLI default remains `gpt-5.6-terra`. The OpenAI Build Week judge
demo and composite GitHub Action select `gpt-5.6-luna` because their primary
model task is structured, repeatable claim extraction and classification.
Model selection can be overridden with `--model` or `ESCROW_CODEX_MODEL`, and
availability depends on the authenticated Codex account.

## Key product and engineering decisions made by the builder

- **Interpretation is not truth.** AI can identify meaning and propose words;
  deterministic validators assign all statuses.
- **Repository text is hydrated, not copied from AI.** Source files and line
  ranges must exactly match discovery metadata before Escrow reconstructs the
  evidence from disk.
- **Scope is a path problem.** Canonical ancestry controls applicability,
  nested overrides, and supported conflicts; GPT-5.6 is not the policy engine.
- **Execution is explicit and isolated.** Documented commands do not run by
  default and never use the active checkout as their working directory.
- **Repair is narrower than validation.** Codex may propose changes only to
  existing effective `AGENTS.md` and `AGENTS.override.md` files. Source, tests,
  package metadata, lockfiles, build files, and CI files are forbidden.
- **Preview comes first.** Repairs are revalidated in a worktree and active
  changes require explicit confirmation; Escrow never commits or pushes.
- **One report is the source of truth.** Every output surface uses the same
  claims, evidence, totals, conflicts, overrides, and command results.
- **Keep the MVP local and inspectable.** The runtime dependency set is
  Commander and Zod, and the interface remains a small local tool.

## Technical challenges

### Preserving exact evidence across an AI boundary

Early extraction relied too heavily on model-copied source text. The current
two-stage design validates only raw model fields first, then derives scope and
reconstructs exact source lines from the discovered instruction file before
the final claim schema is accepted. This preserves Markdown, indentation, and
multiline text without fuzzy matching.

### Separating a reference from a filename mention

Instruction files mention filenames for many reasons. An allowed repair-file
list is not a claim that every listed file exists. Escrow combines a stricter
extraction prompt with deterministic intent filtering so genuine requirements
such as “Read `SPEC.md`” remain checkable while examples, optional files,
output destinations, naming conventions, and repair allowlists do not become
false path failures.

### Executing instructions without trusting them

Shell syntax, traversal, credential paths, network clients, Git aliases,
timeouts, and subprocess descendants create a broad safety surface. Escrow
uses deterministic classification, argument-array subprocesses, temporary Git
worktrees, timeout handling, process-group termination, output capture, and
cleanup. The documentation still states the boundary honestly: this is not a
portable packet-level or universal host sandbox.

### Repairing documentation without repairing the product

A generated patch can rename, delete, create, symlink, or modify unrelated
files even when its prose says otherwise. Escrow inspects the actual Git diff,
allows only existing effective instruction files, rejects structural and
binary changes, reruns validation, and rejects repairs that introduce new
failures.

### Keeping every surface consistent

The CLI, four report formats, and local UI could easily drift. Escrow uses one
report object and integration tests that compare all seven summary totals and
the exact UI download payloads.

## Accomplishments

- Built the full discovery, extraction, hydration, deterministic validation,
  nested scope, conflict, report, command-isolation, repair, CLI, and local UI
  workflow described above.
- Created a resettable judge fixture that deterministically shows exactly four
  stale claims, one safe passing command, a valid nested override, an
  instruction-only repair preview, and PASS revalidation.
- Verified the repaired demo at `3 passed / 0 failed` while preview left the
  active fixture unchanged.
- Kept console, JSON, Markdown, standalone HTML, and UI totals identical.
- Added a composite GitHub Action plus deterministic pull-request/push CI. The
  normal automated suite does not require a live Codex request or credential.
- Added a judge-ready `npm pack` flow and an isolated tarball smoke test. A
  tagged release workflow exists, but no GitHub Release is claimed here.
- Reached a current verified local result of 40 test files and 478 passing
  tests, with strict type checking and production build passing.
- Completed the demonstrated scan-to-repair workflow within the existing
  three-minute presentation target. No user, adoption, customer, or time-saved
  metric is claimed.

## What was learned

- Schema-constrained AI output is still untrusted input; repository evidence
  should be reconstructed and checked after parsing.
- Natural-language applicability and deterministic truth are different
  problems. The model is useful for the first, while the second benefits from
  small explicit validators.
- Nested instructions need lexical discovery and canonical filesystem scope,
  not a generic semantic conflict engine.
- Safe execution and safe repair require lifecycle guarantees—working
  directory, timeout, cleanup, changed-file inspection, and revalidation—not
  only a prompt asking the model to behave.
- A demo becomes more credible when its claims, fixture evidence, reset path,
  offline reports, and automated tests all tell the same story.

## What is next

The immediate release work is operational rather than a new product claim:
confirm the release version, run the documented package checks, create a
version tag, and let the tag-only workflow produce the first GitHub Release
tarball. Until that happens, the release URL remains a placeholder.

Possible future work, not implemented in this submission, includes broader
repository ecosystems, Windows support, global instruction discovery,
stronger platform-specific command containment, and more deterministic claim
mappings. Any expansion should preserve the central boundary: AI interprets
language, deterministic repository evidence decides truth.

## Technologies used

- TypeScript 5.9 in strict mode
- Node.js 20+ and ESM
- Codex CLI and GPT-5.6
- JSON Schema and Zod
- Commander
- Vitest
- Git and temporary Git worktrees
- npm packaging
- GitHub Actions
- HTML, CSS, and browser JavaScript for the local UI

## Judge installation and testing

Supported platforms are macOS and Linux. Judges need Node.js 20+, Git, npm,
and an installed, authenticated Codex CLI with access to the selected model for
live extraction and repair. Package installation, `--help`, `--version`, and
the deterministic automated suite do not require a live model call.

### Test from the checkout

```bash
git clone https://github.com/PlutonicSauce/escrow.git escrow
cd escrow
npm ci
npm run typecheck
npm test
npm run build
npm link
```

### Run the prepared judge demo

```bash
codex --version
codex login status
npm run demo:reset
escrow ui .escrow-demo/sample-monorepo \
  --model "${ESCROW_DEMO_MODEL:-gpt-5.6-luna}" --execute
```

Open the printed loopback URL, scan the instructions, inspect the four
failures and passing health command, preview the `AGENTS.md`-only repair, and
revalidate the verified PASS report. Preview does not modify the disposable
demo checkout. Stop the server with Ctrl+C and run `npm run demo:reset` to
restore the broken state.

The canonical spoken walkthrough is
[`docs/demo-script.md`](demo-script.md). Detailed fixture evidence is in
[`docs/case-study.md`](case-study.md), architecture and trust boundaries are in
[`docs/architecture.md`](architecture.md), and release-tarball instructions
are in [`docs/judge-installation.md`](judge-installation.md).

### GitHub Release installation

**TODO — after a release exists:** add the verified GitHub Release URL above
and confirm the exact tarball filename in the judge installation guide. Do not
claim a published release before that step is complete.

## Known limitations

- Windows is not supported by the MVP.
- Repository/package validation targets local JavaScript and TypeScript Git
  repositories and recognizes npm, pnpm, and Yarn.
- Framework/tool validation uses a fixed mapping rather than arbitrary
  semantic dependency inference.
- Global instruction discovery and the documented `--include-global` option
  are not implemented.
- The documented `--verbose` option is not implemented.
- Report parent directories must already exist.
- Live extraction and repair require Codex authentication and model access;
  model output and service latency can vary.
- Network restriction is policy- and environment-based where practical, not a
  portable packet-level sandbox. An allowed repository script's transitive
  behavior must still be trusted.
- Repair requires a clean active checkout and can update only existing
  effective instruction files.
- Escrow does not claim a hosted demo, npm publication, GitHub Marketplace
  listing, external adoption, or a GitHub Release.

## Submission checklist placeholders

- [ ] **TODO — public YouTube URL**
- [ ] **TODO — Codex `/feedback` Session ID**
- [ ] **TODO — GitHub Release URL after it actually exists**
- [ ] **TODO — entrant/team information**
- [ ] **TODO — confirm whether any prototype, design, or code existed before
      the first tracked commit on July 13, 2026**
- [ ] **TODO — optionally add a personal, first-person example of the most
      valuable Codex-assisted development moment**
