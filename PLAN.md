# Escrow Implementation Plan

## Plan rules

- Complete milestones in order.
- Implement only the milestone currently requested.
- Do not start later milestones early.
- Every milestone must be independently testable.
- Update the status and completion notes after each milestone.
- Record detailed work in `IMPLEMENTATION.md`.

Status values:

```text
NOT STARTED
IN PROGRESS
BLOCKED
COMPLETE
```

---

## Milestone 1 — Project foundation


**Status:** NOT STARTED

**Status:** COMPLETE

### Goal

Create a working Node.js and TypeScript CLI foundation with testing and build
support.

### Expected files

```text
package.json
tsconfig.json
vitest.config.ts
src/cli.ts
src/index.ts
src/commands/check.ts
src/utils/errors.ts
test/unit/
IMPLEMENTATION.md
README.md
```

### Requirements

- Node.js 20+
- TypeScript strict mode
- Commander-based CLI
- `escrow check <repository>` command
- optional `--target <directory>`
- consistent error handling
- build script
- test script
- lint or type-check script
- no product logic yet

### Acceptance criteria

- `npm run build` succeeds
- `npm test` succeeds
- CLI help renders
- invalid arguments return exit code `2`
- check command accepts repository path and target
- no discovery, AI integration, validators, worktrees, reports, or repair mode

### Required tests

- CLI parses repository path
- CLI parses `--target`
- missing repository path returns a useful error
- unexpected internal errors return exit code `4`



### Completion notes

- Completed on 2026-07-13.
- Added a Node.js 20+ package with a strict TypeScript build and Vitest unit
  test support.
- Added a Commander CLI with `escrow check <repository>` and optional
  `--target <directory>` parsing.
- Added centralized exit codes and handling for Commander usage errors and
  unexpected internal errors.
- Added all four required tests plus a CLI help test; all five tests pass.
- Verified the build, type checking, CLI help, invalid-argument exit code, and
  repository/target parsing.
- Kept the check handler intentionally empty so no Milestone 2 or later product
  logic is present.


---

## Milestone 2 — Git root and instruction discovery


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Discover the effective instruction chain from Git root to a target directory.

### Expected files

```text
src/discovery/findGitRoot.ts
src/discovery/discoverInstructions.ts
src/discovery/buildInstructionChain.ts
src/models/instructions.ts
test/unit/discovery/
test/fixtures/discovery/
```

### Requirements

- locate Git repository root
- validate target is inside repository
- walk root-to-target
- prefer `AGENTS.override.md`
- otherwise use `AGENTS.md`
- ignore empty files
- use at most one file per directory
- preserve root-to-target order
- exclude global instructions by default

### Acceptance criteria

- root-only repository works
- nested repository works
- override precedence works
- empty files are ignored
- target outside repository is rejected
- active repository is not modified

### Required tests

- root `AGENTS.md`
- root plus nested `AGENTS.md`
- same-directory override precedence
- empty override falls back to `AGENTS.md`
- invalid target outside repository
- no instruction files


### Completion notes

- Completed on 2026-07-13.
- Added canonical Git-root lookup supporting both `.git` directories and
  worktree-style `.git` files.
- Added target existence, directory, repository-boundary, and symlink-escape
  checks.
- Added deterministic local discovery that prefers non-empty overrides, falls
  back to standard files, ignores whitespace-only files, and preserves
  root-to-target order.
- Added fixture-backed tests for all required scenarios, empty files, global
  exclusion, repository non-modification, missing targets, and canonical path
  behavior.
- Verified build, strict type checking, all 20 tests, and CLI exit behavior.
- Added no claim extraction, validation, Codex, execution, conflict, repair, or
  reporting functionality.


---

## Milestone 3 — Claim and report foundations


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Define stable domain models and a shared report structure before adding AI.

### Expected files

```text
src/models/claims.ts
src/models/reports.ts
src/extraction/claimSchema.ts
src/reporting/consoleReporter.ts
src/reporting/jsonReporter.ts
test/unit/models/
test/unit/reporting/
```

### Requirements

- define claim types
- define claim statuses
- define validated-claim model
- define report summary
- define exit-status aggregation
- use Zod for runtime validation
- use manually created claim fixtures
- no Codex integration yet

### Acceptance criteria

- valid claims pass schema validation
- invalid claims fail with useful errors
- report totals are deterministic
- advisory claims are not counted as pass or fail
- failed claims produce overall failure
- warnings without failures produce pass-with-warnings

### Required tests

- each claim type
- each status
- summary aggregation
- overall status
- JSON serialization
- console source locations


### Completion notes

- Completed on 2026-07-13.
- Added explicit claim types, statuses, extracted/validated claim models, command
  result shape, report summary, and shared report model.
- Added strict Zod runtime schemas with source-range, confidence,
  claim-specific-field, advisory-status, and failed-evidence checks.
- Added deterministic status aggregation and overall-status calculation with
  failure precedence and advisory exclusion from pass/fail totals.
- Added pure console and JSON renderers using the shared report model, with no
  AI-generated score.
- Added manually constructed claim fixtures and coverage for every claim type,
  every status, malformed data, totals, overall statuses, JSON serialization,
  and console source locations.
- Verified build, strict type checking, and all 69 tests.
- Added no Codex integration, real validators, command execution, repair mode,
  Markdown reports, or HTML reports.



## Milestone 4 — Path validation

**Status:** NOT STARTED

### Goal

Validate referenced files and directories safely.

### Expected files

```text
src/validation/pathValidator.ts
src/validation/validateClaim.ts
src/utils/paths.ts
test/unit/validation/pathValidator.test.ts
test/fixtures/path-validation/
```

### Requirements

- resolve relative paths from instruction-file directory
- resolve leading `/` from repository root
- support files and directories
- reject paths outside repository
- classify unsupported patterns as inconclusive
- include evidence in every result

### Acceptance criteria

- existing file passes
- existing directory passes
- missing path fails
- repository-root path works
- traversal outside repository is rejected
- validator never reads unrelated home-directory files

### Required tests

- relative file
- relative directory
- root-relative path
- missing path
- `../` escape attempt
- unsupported wildcard



- Completed on 2026-07-13.
- Added a dedicated `path_exists` validator and a narrow claim-validation
  dispatcher that deliberately rejects every later validator type.
- Resolved relative references from the directory containing the source
  instruction file and leading `/` references from the Git repository root.
- Supported regular files and directories, with deterministic evidence for
  passed, failed, and inconclusive results.
- Rejected lexical repository escapes and source instruction files outside the
  repository before inspecting candidate paths.
- Inspected candidate paths one component at a time with `lstat`, never
  following symbolic links; symlink and special-file paths are inconclusive.
- Classified wildcard, home-expansion, environment-variable, URL-style,
  double-slash, empty, whitespace-ambiguous, and Windows-style absolute
  references as inconclusive.
- Added focused fixtures and 16 tests covering all required cases plus
  symlink escapes, external source files, ambiguous syntax, missing path data,
  and narrow dispatcher behavior.
- Verified build, strict type checking, and all 93 tests.
- Added no dependencies, extraction, command execution, Codex integration, or
  other claim validators.



## Milestone 5 — Package-manager validation


**Status:** NOT STARTED

**Status:** COMPLETE

### Goal

Compare instruction claims with lockfiles and `packageManager` metadata.

### Expected files

```text
src/validation/packageManagerValidator.ts
test/unit/validation/packageManagerValidator.test.ts
test/fixtures/package-managers/
```

### Requirements

Detect:

```text
package-lock.json
npm-shrinkwrap.json
pnpm-lock.yaml
yarn.lock
package.json#packageManager
```

### Acceptance criteria

- matching evidence passes
- conflicting evidence fails
- multiple lockfile types warn
- no evidence is inconclusive
- repository inconsistency is reported separately

### Required tests

- npm
- pnpm
- Yarn
- matching `packageManager`
- conflicting lockfile and metadata
- multiple lockfiles
- no lockfile


### Completion notes

- Completed on 2026-07-13.
- Added deterministic detection for `package-lock.json`,
  `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, and supported
  `package.json#packageManager` values.
- Added nearest-scope selection from the instruction directory toward the
  repository root, including broader-scope inheritance when a nested
  `package.json` has no package-manager declaration.
- Added passed, failed, warning, and inconclusive verdicts for consistent,
  conflicting, contradictory, missing, malformed, and unsupported evidence.
- Added structured repository-inconsistency data with Zod validation and
  distinct console/JSON reporting for multiple lockfile types and
  lockfile/metadata conflicts.
- Added 31 focused fixture files and 18 tests covering npm, npm shrinkwrap,
  pnpm, Yarn, metadata-only and consistent signals, instruction conflicts,
  repository inconsistencies, no evidence, malformed and unsupported metadata,
  nested scope selection and inheritance, source boundaries, schema validation,
  and shared dispatcher behavior.
- Verified build, strict type checking, and all 120 tests.
- Added no dependencies, package-script validation, dependency validation,
  command execution, Codex extraction, or repair behavior.


---

## Milestone 6 — Package-script validation


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Validate package scripts referenced by documented commands.

### Expected files

```text
src/validation/packageScriptValidator.ts
src/utils/packageCommands.ts
test/unit/validation/packageScriptValidator.test.ts
test/fixtures/package-scripts/
```

### Requirements

Normalize:

```text
npm test
npm run <script>
pnpm <script>
pnpm run <script>
yarn <script>
yarn run <script>
```

Use the nearest applicable `package.json`.

### Acceptance criteria

- existing script passes
- missing script fails
- similar script is suggested
- suggestion does not change verdict
- missing package file is inconclusive

### Required tests

- npm shortcut
- npm run
- pnpm shortcut
- pnpm run
- Yarn shortcut
- missing script
- nearest nested package
- no package file


### Completion notes

- Completed on 2026-07-13.
- Added deterministic normalization for `npm test`, `npm run <script>`,
  `pnpm <script>`, `pnpm run <script>`, `yarn <script>`, and
  `yarn run <script>` without executing commands.
- Added safe nearest-`package.json` lookup from the claim scope toward the
  canonical repository root, with repository-boundary and symlink protection.
- Added passed, failed, and inconclusive validation for existing, missing,
  unavailable, malformed, unsafe, or ambiguous package-script evidence.
- Added deterministic Levenshtein/prefix similarity suggestions with stable
  tie-breaking; suggestions never change a failed verdict.
- Added 13 fixture files and 32 focused tests covering every required command
  form, unsupported syntax, existing and missing scripts, suggestion behavior,
  nested package precedence, absent and malformed package data, direct
  extracted script metadata, metadata disagreement, source preservation,
  deterministic evidence, and shared dispatcher behavior.
- Verified build, strict type checking, and all 157 tests.
- Added no dependencies, command execution, dependency validation, Codex
  extraction, repair behavior, or Milestone 7 code.



## Milestone 7 — Dependency and framework validation


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Validate explicit framework and tool claims against package dependencies.

### Expected files

```text
src/validation/dependencyValidator.ts
src/validation/dependencyMappings.ts
test/unit/validation/dependencyValidator.test.ts
test/fixtures/dependencies/
```

### Initial mappings

```text
Vitest
Jest
TypeScript
ESLint
Prettier
Vite
Next.js
React
Playwright
Zod
```

### Acceptance criteria

- mapped installed dependency passes
- mapped missing dependency fails
- Playwright equivalents are supported
- unmapped tool is inconclusive
- matching is deterministic

### Required tests

- dependencies
- devDependencies
- peerDependencies
- optionalDependencies
- missing framework
- Playwright variants
- unknown framework


### Completion notes

- Completed on 2026-07-13.
- Added an explicit deterministic mapping table for Vitest, Jest, TypeScript,
  ESLint, Prettier, Vite, Next.js, React, Zod, and the two supported Playwright
  packages.
- Added dependency validation across `dependencies`, `devDependencies`,
  `peerDependencies`, and `optionalDependencies` using the nearest applicable
  regular `package.json` within the canonical repository boundary.
- Added passed, failed, and inconclusive results for present, absent, unknown,
  unavailable, unsafe, and malformed dependency evidence, with deterministic
  evidence for every result.
- Added 19 fixture files and 29 focused tests covering every mapping and
  dependency section, both Playwright alternatives, missing and unknown tools,
  nested package scope, malformed metadata, repository boundaries, source
  preservation, determinism, and shared dispatcher behavior.
- Verified the build, strict type checking, and all 201 tests.
- Added no dependencies, AI extraction, command execution, repair behavior, or
  Milestone 8 functionality.


---

## Milestone 8 — Codex claim extraction


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Use Codex with GPT-5.6 to extract candidate claims into schema-valid JSON.

### Expected files

```text
schemas/claims.schema.json
src/extraction/codexClient.ts
src/extraction/extractionPrompt.ts
src/extraction/extractClaims.ts
test/unit/extraction/
```

### Requirements

- Codex runs non-interactively
- read-only sandbox
- schema-constrained JSON
- output validated with Zod
- preserve source file and line numbers
- supported claim types only
- no AI-generated verdicts
- mocked process in automated tests
- manual integration test disabled by default

### Acceptance criteria

- valid extraction reaches deterministic validators
- malformed output is rejected
- unsupported claim types are rejected
- source locations are required
- Codex failure returns exit code `3`
- extraction prompt explicitly forbids verdicts

### Required tests

- successful mocked extraction
- malformed JSON
- schema mismatch
- missing source location
- unsupported type
- Codex process failure
- timeout


### Completion notes

- Completed on 2026-07-13.
- Added non-interactive `codex exec` extraction using GPT-5.6 by default,
  explicit CLI and environment model overrides, disabled approvals, a
  read-only sandbox, ephemeral sessions, ignored user config, and a zero-byte
  project-instruction budget so inspected instructions are supplied as data
  rather than independently loaded Codex guidance.
- Added a shipped JSON Schema and matching Zod response validation for exactly
  the six supported claim types, required source fields, relevant optional
  fields, and no AI-assigned statuses or verdicts.
- Added deterministic verification that returned source files exactly match
  the supplied instruction chain and inclusive line ranges fit the matched
  instruction content. Scope and original source text are hydrated from that
  matched instruction record rather than accepted from AI output.
- Added extraction failure handling with exit code `3` for process startup,
  nonzero exit, timeout, empty output, malformed JSON, schema failure, and
  source-preservation failure.
- Wired extracted path, package-manager, package-script, and dependency claims
  into the existing deterministic validators while preserving command and
  advisory claims for later processing without assigning AI verdicts.
- Added 31 mocked extraction tests, CLI/error coverage, and a separately
  configured manual integration test that is excluded from normal CI and runs
  Codex only when explicitly enabled and installed.
- Verified the build, strict type checking, all 250 normal tests, and the
  disabled manual-test gate.
- Added no command execution, conflict analysis, repair behavior, Markdown or
  HTML reporting, or Milestone 9 functionality.

### Post-completion source hydration fix — 2026-07-14

- Split AI output (`RawExtractedClaim`) from the hydrated internal
  `ExtractedClaim` model.
- Parse Codex JSON only with `RawExtractedClaimSchema`, then parse every
  deterministically hydrated object with `ExtractedClaimSchema` before it can
  reach validators or reports.
- Removed `originalText` and `scopeDirectory` from the Codex JSON Schema, Zod
  response schema, prompt, and mocked subprocess responses.
- Reconstructed exact inclusive source lines deterministically from the matched
  discovered instruction file, preserving Markdown, indentation, multiline
  formatting, and CRLF separators.
- Added rejection coverage for invalid/beyond-file ranges, non-chain source
  files, and model-authored source text, plus exact source/report coverage.
- Build, strict type checking, all 428 tests, and a live local UI scan passed.

### Post-completion path-intent false-positive fix — 2026-07-14

- Tightened the Codex extraction prompt so `path_exists` is emitted only for
  language that requires or assumes a current repository path.
- Added deterministic post-hydration intent filtering using exact selected
  source text and bounded local list context. Allowed/forbidden lists,
  examples, output destinations, optional files, naming conventions, and
  repair-mode file allowlists cannot become path-existence evidence.
- Kept genuine read/see/use/review path references and the existing
  repository-bounded path validator unchanged.
- Added focused positive, exclusion, list-context, exact-reference, and
  over-filtering regression coverage. Build, strict type checking, and all 447
  tests pass.



## Milestone 9 — Safe command execution


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Execute documented commands safely in temporary Git worktrees.

### Expected files

```text
src/execution/commandPolicy.ts
src/execution/createWorktree.ts
src/execution/executeCommand.ts
src/execution/cleanupWorktree.ts
src/validation/commandValidator.ts
test/unit/execution/
test/integration/command-execution/
```

### Requirements

- execute only with `--execute`
- never use active checkout
- classify commands before execution
- deny dangerous commands
- capture stdout, stderr, exit code, duration, working directory
- enforce timeout
- cleanup by default
- support `--keep-worktree`
- network disabled by default where practical

### Acceptance criteria

- passing command passes
- failing command fails
- timed-out command fails
- dangerous command is blocked and never run
- worktree is cleaned after success and failure
- active checkout remains unchanged

### Required tests

- safe command
- failing command
- timeout
- each major denylist class
- cleanup after exception
- keep-worktree behavior


### Completion notes

- Completed on 2026-07-13.
- Added deterministic command classification that rejects malformed or dynamic
  shell input, privilege escalation, destructive system/filesystem operations,
  remote or destructive Git operations, sensitive credential/browser paths,
  interactive credential commands, outside-worktree paths, and network-capable
  commands unless network access is explicit.
- Added detached temporary Git worktrees, repository-relative scope mapping,
  external-symlink rejection, sanitized execution environments, configurable
  process-group timeouts, complete output capture, cleanup in `finally`, and
  explicit `--keep-worktree` retention.
- Added `--execute`, `--allow-network`, `--timeout`, and `--keep-worktree` CLI
  wiring. Without `--execute`, command claims are deterministically
  inconclusive and no policy or worktree subprocess runs.
- Added command results to console output; the shared JSON report continues to
  serialize the same command-result model, including blocked commands.
- Added harmless fixture-backed unit and real Git integration coverage for
  pass, failure, timeout, policy classes, nested scope, offline/sanitized
  environment, cleanup after success/failure/exception, retained worktrees,
  external symlinks, and active-checkout immutability.
- Verified build, strict type checking, all 298 tests, one registered primary
  worktree only, and no leaked Escrow temporary directories.
- Added no conflict analysis, repair behavior, Markdown/HTML reporting, or
  Milestone 10 functionality.


---

## Milestone 10 — Scope, overrides, and conflicts


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Distinguish valid nested overrides from genuine same-scope conflicts.

### Expected files

```text
src/validation/conflictValidator.ts
src/models/conflicts.ts
test/unit/validation/conflictValidator.test.ts
test/fixtures/nested-overrides/
```

### Requirements

- compute effective scope deterministically
- later nested instructions are more specific
- classify superseded broad claim as overridden
- report mutually exclusive same-scope claims as conflicts
- AI may explain but not determine applicability

### Acceptance criteria

- valid nested override is not a failure
- root instruction remains effective outside nested subtree
- same-scope package-manager conflict is reported
- source locations for both claims are preserved

### Required tests

- root and nested override
- sibling package scopes
- same-file contradiction
- same-scope separate-file contradiction
- advisory statements do not create conflicts


### Completion notes

- Completed on 2026-07-13.
- Added deterministic target applicability from repository root through nested
  subtrees, with repository-boundary checks and explicit specificity data.
- Added target-specific override resolution that marks superseded broad claims
  as `overridden` without treating valid nested guidance as a conflict; broad
  claims remain effective for targets outside the nested subtree.
- Added narrow deterministic conflicts for package-manager guidance, the same
  package script assigned to different explicit package managers, and the
  directly exclusive Jest/Vitest framework pair. Advisory, unrelated,
  unsupported, and semantically uncertain relationships are ignored.
- Added conflict records containing every involved claim id, type, normalized
  value, declared scope, source file, and complete line range. Involved active
  claims receive deterministic failed statuses and evidence.
- Integrated target-scope analysis after deterministic validation, passed the
  discovered target from the check command, added conflicts to the shared
  report model, and rendered conflict source locations in console and JSON
  output without giving Codex any applicability or verdict role.
- Added 15 focused tests covering root/nested overrides, root behavior outside
  a nested subtree, sibling scopes, same-file and separate-file contradictions,
  package-script equivalence, Jest/Vitest conflicts, advisory and unrelated
  claims, repository boundaries, report preservation, and extraction-pipeline
  integration. Pure constructed claims were sufficient, so no unused fixture
  repository was added.
- Verified build, strict type checking, all 359 normal tests, and the explicitly
  gated manual Codex test suite without making a live Codex request.
- Added no general policy engine, AI conflict decisions, Markdown/HTML reports,
  conflict explanations, repair behavior, or Milestone 11 functionality.


---

## Milestone 11 — Markdown and HTML reports


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Generate reusable evidence reports from the shared report object.

### Expected files

```text
src/reporting/markdownReporter.ts
src/reporting/htmlReporter.ts
test/unit/reporting/markdownReporter.test.ts
test/unit/reporting/htmlReporter.test.ts
```

### Requirements

- Markdown suitable for attachment to a PR or submission
- self-contained HTML
- no React
- no server
- summary and result filtering
- expandable command output
- source locations and evidence
- same totals across every format

### Acceptance criteria

- console, JSON, Markdown, and HTML totals agree
- HTML opens directly from disk
- output is escaped safely
- failed claims show evidence
- command output is preserved

### Required tests

- format consistency
- HTML escaping
- Markdown source references
- empty report
- command output rendering


### Completion notes

- Completed on 2026-07-13.
- Added pure Markdown and static HTML renderers that consume the same
  `EscrowReport` used by console and JSON output.
- Added PR/submission-friendly Markdown with summary and instruction-chain
  sections, complete claim details, deterministic evidence, suggestions,
  explicit override/conflict sections, and native expandable command output.
- Added one self-contained semantic HTML document with inline CSS, no scripts,
  no React, no external assets, native `<details>` command output, complete
  report content, and HTML escaping for every repository-derived value.
- Hardened Markdown output with dynamic code fences, escaped prose, dynamic code
  spans, and entity-escaped command metadata/stdout/stderr inside expandable raw
  HTML boundaries.
- Added `--json`, `--markdown`, and `--html` CLI output paths. The check command
  constructs one report, renders console output from it, and passes that same
  object to every requested file renderer. Deferred advisory claims are added
  to the report with deterministic advisory status and evidence.
- Connected deterministic overall failure to the existing check-failed exit
  code `1` after console and requested report files have been produced.
- Extended console output with instruction-chain and normalized-claim details,
  while preserving the shared status totals and conflict output.
- Added 11 tests covering format consistency, HTML escaping and standalone
  structure, Markdown formatting and escaping, empty reports, failures,
  advisories, blocked commands, multiline streams, conflicts, overrides, CLI
  parsing, and shared check-command output generation.
- Verified build, strict type checking, all 373 normal tests, and the gated
  manual Codex test without making a live request.
- Generated and inspected Markdown and HTML sample files from the shared rich
  report fixture under `/private/tmp/escrow-m11-samples`; totals,
  sections, output escaping, standalone structure, filters, conflicts, and
  overrides were present as expected.
- Added no hosted UI, React, server, repair mode, GitHub integration, or
  Milestone 12 functionality.


---

## Milestone 12 — Restricted repair mode


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Generate and verify minimal documentation repairs without changing source code.

### Expected files

```text
src/commands/fix.ts
src/repair/repairPrompt.ts
src/repair/generateRepair.ts
src/repair/verifyRepair.ts
test/unit/repair/
test/integration/repair/
```

### Requirements

- repair in temporary worktree
- allow only instruction-file modifications
- reject all other file changes
- rerun Escrow after repair
- reject new failures
- show patch and before/after report
- active repository changes only with `--apply`
- no commits or pushes

### Acceptance criteria

- preview mode leaves repository unchanged
- allowed repair is revalidated
- source-code modification is rejected
- repair introducing new failure is rejected
- `--apply` applies only verified instruction-file changes

### Required tests

- valid repair preview
- invalid source-code modification
- new-failure rejection
- apply mode
- cleanup after rejected repair
- mocked Codex failure


### Completion notes

- Completed on 2026-07-13.
- Added `escrow fix <repository>` with optional `--target`, `--apply`,
  `--model`, `--execute`, `--allow-network`, `--timeout`, and
  `--keep-worktree` support. Execution-related flags retain the existing
  documented-command safety behavior.
- Reused the shared repository-evaluation path so repair mode produces the same
  deterministic `EscrowReport` before and after the proposed change.
- Added a schema-constrained, Zod-validated Codex repair response containing
  only a unified diff. Codex runs non-interactively in a read-only sandbox with
  shell, hooks, apps, network search, repository rules, and user config
  disabled; it never edits either checkout directly.
- Supplied Codex with the effective instruction chain, failed claims,
  deterministic evidence, exact allowed files, and an explicit all-other-files
  prohibition while requesting the smallest truthful documentation update.
- Applied candidate patches only inside a detached temporary Git worktree.
  Deterministic checks reject malformed patches, unsafe paths, untracked or
  staged additions, deletions, renames, mode changes, symlinks, and every path
  outside the exact effective-instruction allowlist.
- Re-ran extraction, deterministic validators, scope/conflict analysis, and
  requested command checks in the repair worktree. Repairs are rejected when
  they add any new failed-claim signature or do not reduce the failure count.
- Added before-report, verified diff, and after-report console output. Preview
  mode cleans the worktree without changing the active repository; `--apply`
  rechecks active-repository cleanliness and applies only the already verified
  patch. Repair mode never commits or pushes.
- Added 17 focused tests covering prompt boundaries, schema/runner failures,
  CLI options, valid preview, active-repository preservation, real command
  re-execution, source and package metadata rejection, new-failure rejection,
  verified apply, malformed patches, Codex failure, and cleanup after success
  and rejection.
- Verified build, strict type checking, all 392 normal tests, a targeted
  Git-backed preview demonstration, the gated manual Codex suite without a live
  request, CLI help, and absence of unexpected temporary worktree directories.
- Added no source repair, automatic commit/push, GitHub integration, demo
  repository, or Milestone 13 functionality.


---

## Milestone 13 — Demo repository and final polish


**Status:** NOT STARTED

**Status:** COMPLETE


### Goal

Create a polished end-to-end demo and complete project documentation.

### Expected files

```text
demo/sample-monorepo/
README.md
LICENSE
docs/architecture.md
docs/demo-script.md
```

### Demo repository must include

- wrong root package-manager instruction
- deleted documentation reference
- missing package script
- Jest claim when Vitest is installed
- one valid nested override
- one safe passing command
- one dangerous command in a separate fixture

### Acceptance criteria

The demo shows:

1. stale instructions
2. deterministic failures
3. correct nested-scope handling
4. Codex-generated minimal repair
5. successful revalidation
6. JSON, Markdown, and HTML reports

The full demo must fit within three minutes.

### Required final checks

```bash
npm run build
npm test
npm run typecheck
```

Also verify README instructions on a clean checkout.


### Completion notes

- Completed on 2026-07-13.
- Added the broken sample pnpm monorepo, its valid nested override, a separate
  blocked `git push` fixture, and focused integration coverage for every demo
  asset without adding a live-Codex CI dependency.
- Added the MIT license, complete README, architecture guide, timed demo script,
  and checked-in console, JSON, Markdown, and self-contained HTML reports.
- A live schema-constrained GPT-5.6 run produced four intended deterministic
  failures plus one isolated passing command; the nested run correctly
  overrode only the root package-manager claim, and the dangerous command was
  blocked without execution.
- Live repair preview preserved the active repository, verified apply changed
  only `AGENTS.md`, and the final `--execute` recheck passed all three remaining
  claims. No temporary command or repair worktrees remained.
- The measured end-to-end sequence was 158.57 seconds, below the three-minute
  acceptance limit.
- Verified a dependency-free temporary checkout with `npm ci`, build, and CLI
  help. Final build and strict type checking passed; all 402 tests in 30 files
  passed.
- The live acceptance run exposed and fixed only narrow compatibility/prompt
  defects: strict response-schema keywords, dependency `normalizedValue`
  wording, and replacement text that could repeat a stale value. No product
  feature or dependency was added.
- Every Definition of Done item in `SPEC.md` is satisfied; detailed evidence and
  known limitations are recorded in `IMPLEMENTATION.md`.
- Potential-impact evidence was strengthened on 2026-07-16 without changing
  product behavior or inventing metrics. Demo integration coverage now proves
  the exact four stale claim types, the isolated passing command, the valid
  nested override, a real instruction-only preview in a temporary worktree,
  successful PASS revalidation, an unchanged active fixture, and identical
  console/JSON/Markdown/HTML/UI totals. `docs/case-study.md` records the
  realistic failure modes, deterministic evidence, repair boundary, and exact
  observed fixture counts.
- The OpenAI Build Week submission draft and canonical spoken demo were
  reconciled on 2026-07-16. The draft now reflects the deterministic source
  hydration architecture, current verified fixture and test evidence, actual
  repository history, judge setup, explicit human design decisions, and
  clearly marked submission placeholders. The canonical voiceover follows the
  requested 2:50 timeline without changing product behavior.
- A final submission audit on 2026-07-16 verified the public repository,
  license, timing evidence, technology boundaries, secret-free regular CI,
  package isolation, demo outcomes, report consistency, and repair
  restrictions. The only repository defect found was a missing `--execute` in
  the demo fixture README and reset-script startup hint; both now match the
  canonical judge command and are regression-tested. Submission remains
  operationally pending until the owner publishes the reviewed changes,
  creates the release asset, and fills the entrant, video, and `/feedback`
  fields.
- Publication preparation on 2026-07-16 updated every active submission URL
  to the renamed canonical repository, `PlutonicSauce/escrow`, including the
  CI badge, Devpost clone command, judge release/source links, package metadata,
  generated Action reference, and local origin. Historical regression strings
  remain only in tests. Personal absolute filesystem paths were removed from
  documentation, package metadata and workflow syntax were revalidated, and
  the full 478-test suite plus isolated package smoke test passed. No commit,
  push, tag, or release was performed.


---

## Milestone 14 — Local Web Interface

**Status:** COMPLETE

### Goal

Add a polished, loopback-only browser interface as a thin adapter over the
existing Escrow application services and report models.

### Expected files

```text
src/version.ts
src/commands/ui.ts
src/web/assets.ts
src/web/openBrowser.ts
src/web/server.ts
test/unit/commands/ui.test.ts
test/unit/web/assets.test.ts
test/unit/web/server.test.ts
test/integration/web/uiWorkflow.test.ts
README.md
SPEC.md
PLAN.md
IMPLEMENTATION.md
```

### Acceptance criteria

- `escrow ui <repository>` supports target, port, model, browser-open,
  command-execution, network, and timeout options.
- The server selects an available port by default and binds only to
  `127.0.0.1`.
- The SPA exposes the effective instruction chain, shared report totals,
  expandable evidence, status filters, repair preview/apply controls, and all
  three downloadable file report formats.
- Check, report, command-safety, and repair behavior reuse the existing
  TypeScript application services rather than spawning or duplicating the CLI.
- API requests cannot choose a different repository or supply arbitrary
  commands; JSON request bodies are strict and size-limited.
- Repair apply accepts only a matching verified in-memory preview and requires
  explicit confirmation.
- Automated tests cover parsing, startup/shutdown, loopback binding, API
  boundaries, escaping, reports, repair confirmation/rejection, shared totals,
  and a mocked-Codex fixture workflow.
- Build, strict type checking, all tests, and the documented manual demo flow
  pass.

### Completion notes

- Completed on 2026-07-14.
- Added a dependency-free responsive SPA served by Node's built-in HTTP server,
  with no React, remote binding, CORS, persistence, telemetry, or new product
  integration.
- Reused `createRepositoryReport`, `fixRepository`, the shared report
  renderers, `applyVerifiedPatch`, existing command policy, and existing
  temporary-worktree lifecycle as the only check and repair implementations.
- Added strict JSON schemas, a 16 KiB request limit, security headers,
  repository/target boundaries, in-memory report/preview state, and explicit
  matching-preview confirmation for apply.
- Added focused UI, reporting, path-display, dependency-mapping, and demo
  workflow coverage. The final suite passes with 38 files and 463 tests.
- A live synthetic demo produced the expected 1 pass and 4 failures, downloaded
  consistent JSON/Markdown/HTML reports, verified an `AGENTS.md`-only repair,
  applied that exact confirmed preview, and rechecked successfully with 3
  passed claims and no failures. Ctrl+C closed the server and no temporary
  worktrees remained.

### Final hackathon demo polish — 2026-07-14

- Standardized every public product surface on **Escrow**, including the npm
  package/bin, browser title and interface, CLI help and errors, reports,
  sample artifacts, README, and project documentation. Existing internal
  TypeScript report/error interface names remain implementation details.
- Added the deterministic `Zod -> zod` dependency mapping and coverage for
  installed, missing, development dependency, and nested package scopes.
- Made scan results issue-first: failed, warning, blocked, and inconclusive
  claims are shown initially; a clean scan falls back to passed claims;
  advisory claims remain counted and are available through **Advisory** and
  **Show all** filters.
- Added one repository-boundary-aware display-path helper shared by console,
  Markdown, HTML, and browser rendering. Trusted in-repository paths are
  repository-relative, while outside paths are explicitly marked rather than
  presented as repository-relative evidence. JSON retains canonical paths for
  machine consumers.
- Replaced plain report links with keyboard-focusable **Download JSON**,
  **Download Markdown**, and **Download HTML** controls backed by the existing
  endpoints and shared report object.
- Added a resettable ignored demo checkout generated from
  `demo/sample-monorepo`. Its broken state deterministically yields one passing
  safe command and exactly four failures; its nested override remains valid;
  the verified instruction-only repair revalidates to PASS.
- Final live workflow completed in 66.48 seconds: scan `1 passed / 4 failed`,
  verified preview changed only `AGENTS.md`, preview revalidation was
  `3 passed / 0 failed`, explicit apply succeeded, final scan was
  `3 passed / 0 failed`, and all three downloads returned HTTP 200.

### Judge-ready package distribution — 2026-07-16

- `npm pack` now runs the strict TypeScript build automatically through
  `prepack` and includes the compiled CLI, both runtime schemas, package
  metadata, README, and license.
- Added an isolated package smoke test that packs Escrow, installs the tarball
  under a temporary directory, verifies package contents, runs installed
  `escrow --help` and `escrow --version`, proves the binary resolves inside the
  installed package rather than the source checkout, and cleans up in
  `finally`.
- Added a version-tag-only GitHub Release workflow. Its verification job has
  read-only contents permission; only the release-creation job receives
  `contents: write`. It performs clean install, type checking, tests, build,
  smoke installation, and a final pack before attaching the `.tgz`.
- The workflow requires no model or OpenAI credential and never publishes to
  npm or creates a tag.
- Added a judge installation guide covering release-tarball installation,
  prerequisites, compiled-package testing, the live prepared demo, model
  availability, and exact uninstall commands without claiming a release
  already exists.

### Deterministic continuous integration — 2026-07-16

- Added `.github/workflows/ci.yml` for pull requests and pushes to `main`.
- The workflow uses only `contents: read`, GitHub-hosted Ubuntu, Node.js 20,
  npm caching through `actions/setup-node`, concurrency cancellation, clean
  install, type checking, the mocked deterministic suite, build, and the packed
  artifact smoke test.
- It contains no OpenAI credential, Codex invocation, Ollama dependency,
  self-hosted runner, artifact write, or repository write permission.
- The live Codex test remains isolated behind its separate manual Vitest config
  and explicit environment gate; it is not part of `npm test`.
- Added an accurate `main` branch badge for the `ci.yml` workflow near the top
  of README.

---

## Current milestone


**Milestone 14 — Local Web Interface**

**Milestone 1 — Project foundation is complete.**

**Milestone 2 — Git root and instruction discovery is complete.**

**Milestone 3 — Claim and report foundations is complete.**

**Milestone 4 — Path validation is complete.**

**Milestone 5 — Package-manager validation is complete.**

**Milestone 6 — Package-script validation is complete.**

**Milestone 7 — Dependency and framework validation is complete.**

**Milestone 8 — Codex claim extraction is complete.**

**Milestone 9 — Safe command execution is complete.**

**Milestone 10 — Scope, overrides, and conflicts is complete.**

**Milestone 11 — Markdown and HTML reports is complete.**

**Milestone 12 — Restricted repair mode is complete.**

**Milestone 13 — Demo repository and final polish is complete.**

**Milestone 14 — Local Web Interface is complete.**

### Final local-UI visual polish — 2026-07-16

- Reworked the dependency-free browser surface into a compact dark
  developer-tool interface using the specified page, panel, border, text, and
  verdict color tokens.
- Preserved the existing loopback server, API routes, control IDs, report
  downloads, issue-first filters, repair confirmation, deterministic verdicts,
  and responsive behavior. No validator, extraction, report, or repair logic
  changed.
- Added a compact repository/status header, collapsible advanced scan settings,
  CI-style scan stages, issue-prioritized metrics, diagnostic claim rows, and a
  code-review-style verified repair diff.
- Added focused asset-contract coverage for the dark palette, system font
  stack, local-only assets, safety labeling, advanced controls, and repair
  review surface. The complete deterministic suite passes with 40 files and
  479 tests.

### Restrained utility-design revision — 2026-07-16

- Reduced the local UI to a single compact application bar, a plain
  `Escrow / repository` breadcrumb, one utility title, and flat 1px-bordered
  surfaces. Removed the repeated identity, marketing hero, glowing tile,
  gradients, shadows, eyebrow labels, numbered sections, decorative pipeline
  boxes, and non-semantic pills.
- Consolidated repository, target, model, command execution, and network
  controls under a normal Configuration disclosure. Execution copy now says
  either that execution is disabled or that commands run in isolated
  worktrees.
- Converted stages and summary totals to compact inline lists, claims to
  diagnostic rows, and repair preview to a conventional unified-diff review
  with explicit preview and checkout-safety labels.
- Added deterministic browser display helpers so repository configuration and
  target fields use only a basename or repository-relative value. Canonical
  absolute paths remain server-side; in-repository evidence remains relative,
  and outside home paths are abbreviated.
- Preserved all 33 pre-existing DOM IDs and added only the execution-safety
  copy target. The final deterministic suite passes with 40 files and 480
  tests.

### Honest indeterminate loading states — 2026-07-16

- Added guarded scan and repair-preview loading controllers with stable-width
  button spinners, elapsed time, a shared indeterminate progress track, and
  accurate RUNNING/success/error status restoration.
- Kept backend progress honest: stages remain queued while a request is in
  flight and become complete only after a successful response. Failed requests
  mark the pipeline interrupted without inventing completed work or numeric
  percentages.
- Kept previous reports visible during refresh with an updating treatment and
  `aria-busy`; a failed refresh retains and explicitly labels the prior report.
- Added reduced-motion behavior and focused browser-harness tests for timers,
  duplicate suppression, stale results, success/failure cleanup, repair
  protection, and non-numeric progress. No server or validation behavior
  changed.
