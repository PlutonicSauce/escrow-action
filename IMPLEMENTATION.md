# Escrow Implementation Log

Use this file to record completed work after each milestone.

## Current state

Milestones 1 through 14 are complete. Escrow discovers effective local
instructions, extracts schema-constrained claims with Codex, assigns verdicts
with deterministic validators, optionally runs documented commands in isolated
Git worktrees, resolves supported scopes and conflicts, emits console/JSON/
Markdown/HTML reports, and can preview or apply restricted instruction-only
repairs. It also provides a loopback-only local browser interface over those
same application services and report models.

## Log format

For each completed milestone, add:


```md
````md
## Milestone N — Name

**Status:** COMPLETE
**Date:** YYYY-MM-DD

### Completed

- ...

### Files created or changed

- ...

### Commands run

```text
...
```

### Test results

```text
...
```

### Known limitations

- ...

### Next milestone

- ...

```

````

## Milestone 1 — Project foundation

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Created a Node.js package requiring Node.js 20 or newer.
- Configured strict TypeScript compilation to ESM output in `dist/`.
- Configured Vitest to run focused unit tests from `test/unit/`.
- Added the Commander-based `escrow` CLI entry point.
- Added `escrow check <repository>` with optional
  `--target <directory>` argument parsing.
- Added explicit shared exit codes and consistent handling for CLI usage errors
  and unexpected internal errors.
- Added a Milestone 1 check-command boundary with no repository or product
  logic.
- Added setup, CLI, and development instructions to the README.
- Ignored generated build output, installed dependencies, and TypeScript build
  metadata.
- Added tests for every Milestone 1 required case and CLI help output.

### Files created or changed

- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `README.md`
- `src/index.ts`
- `src/cli.ts`
- `src/commands/check.ts`
- `src/utils/errors.ts`
- `test/unit/cli.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
node --version
npm --version
npm install
npm run typecheck
npm run build
npm test
node dist/index.js --help
node dist/index.js check
node dist/index.js check . --target packages/api
npm ls --depth=0
```

### Test results

```text
Environment:
  Node.js v24.16.0 (satisfies Node.js 20+ requirement)
  npm 11.13.0

npm install:
  48 packages added
  0 vulnerabilities

npm run typecheck:
  PASS (exit code 0)

npm run build:
  PASS (exit code 0)

npm test:
  PASS (exit code 0)
  Test files: 1 passed
  Tests: 5 passed
  Duration: 302ms

CLI smoke checks:
  --help: exit code 0; usage and check command rendered
  check with missing repository: exit code 2; useful missing-argument error rendered
  check . --target packages/api: exit code 0; arguments accepted

Relevant integration tests:
  None are defined or required for the Milestone 1 parsing-only foundation.
```

### Known limitations

- The `check` command currently parses arguments and then returns successfully;
  it does not inspect or validate a repository.
- Instruction discovery, claim models, AI extraction, deterministic validators,
  isolated command execution, reports, and repair mode are intentionally
  deferred to later milestones.

### Next milestone

- Milestone 2 — Git root and instruction discovery remains NOT STARTED and must
  be explicitly requested before implementation.

## Milestone 2 — Git root and instruction discovery

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Added canonical resolution for repository and target directories.
- Added upward Git-root discovery using `.git` directory or file markers.
- Added deterministic repository-boundary checks before and after target
  canonicalization to reject traversal and symlink escapes.
- Added root-to-target directory enumeration.
- Added per-directory instruction discovery that prefers non-empty
  `AGENTS.override.md`, otherwise selects non-empty `AGENTS.md`, and never
  selects more than one file from a directory.
- Preserved absolute source path, scope directory, filename, and content for
  each discovered instruction file.
- Kept global instructions excluded; discovery does not read `CODEX_HOME` or
  home-directory instruction files.
- Wired the `check` command to run discovery and return exit code `2` with an
  actionable error for invalid repository or target input.
- Added fixture templates and focused tests for Git-root lookup, root-only and
  nested chains, override precedence, empty override fallback, empty files, no
  instructions, outside and missing targets, symlink escapes, global exclusion,
  and repository non-modification.
- Corrected test expectations to use canonical paths on macOS after the initial
  suite exposed the `/var` to `/private/var` real-path mapping.
- Narrowed the early lexical boundary check to relative targets so valid
  absolute filesystem aliases are evaluated after canonicalization.

### Files created or changed

- `src/models/instructions.ts`
- `src/discovery/findGitRoot.ts`
- `src/discovery/buildInstructionChain.ts`
- `src/discovery/discoverInstructions.ts`
- `src/commands/check.ts`
- `src/cli.ts`
- `src/utils/errors.ts`
- `test/unit/cli.test.ts`
- `test/unit/discovery/fixtureRepository.ts`
- `test/unit/discovery/findGitRoot.test.ts`
- `test/unit/discovery/discoverInstructions.test.ts`
- `test/fixtures/discovery/root-only/AGENTS.md`
- `test/fixtures/discovery/root-and-nested/AGENTS.md`
- `test/fixtures/discovery/root-and-nested/packages/api/AGENTS.md`
- `test/fixtures/discovery/override-precedence/AGENTS.md`
- `test/fixtures/discovery/override-precedence/AGENTS.override.md`
- `test/fixtures/discovery/empty-override-fallback/AGENTS.md`
- `test/fixtures/discovery/empty-override-fallback/AGENTS.override.md`
- `test/fixtures/discovery/empty-instructions/AGENTS.md`
- `test/fixtures/discovery/empty-instructions/AGENTS.override.md`
- `test/fixtures/discovery/empty-instructions/packages/api/AGENTS.md`
- `test/fixtures/discovery/no-instructions/README.md`
- `test/fixtures/discovery/no-instructions/packages/api/README.md`
- `README.md`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
npm run typecheck
npm run build
npm test
npm test
npm run typecheck
npm run build
npm test
node dist/index.js check .
node dist/index.js check . --target src
node dist/index.js check . --target ..
npm run typecheck
npm run build
npm test
node dist/index.js check .
node dist/index.js check . --target src
node dist/index.js check . --target ..
```

### Test results

```text
Initial verification:
  npm run typecheck: PASS
  npm run build: PASS
  npm test: 4 failures caused by non-canonical macOS fixture expectations

After canonical-path fixture correction:
  npm test: PASS
  Test files: 3 passed
  Tests: 18 passed

Final verification after boundary, global-exclusion, and non-modification tests:
  npm run typecheck: PASS (exit code 0)
  npm run build: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 3 passed
  Tests: 20 passed
  Duration: 465ms

CLI smoke checks:
  check .: exit code 0
  check . --target src: exit code 0
  check . --target ..: exit code 2 with an outside-repository error

Relevant integration tests:
  Milestone 2 uses isolated temporary copies of focused repository fixtures.
  No documented commands are executed and the inspected repositories are not modified.
```

### Known limitations

- Discovery is local-only; global instruction discovery is intentionally not
  implemented.
- Only regular instruction files are read. Symlinked instruction files are
  ignored to avoid reading outside the repository.
- The `check` command discovers instructions and reports input errors but does
  not yet extract claims, validate instructions, or generate reports.
- Claim models, AI extraction, validators, command execution, conflicts,
  reports, and repair mode remain deferred to later milestones.

### Next milestone

- Milestone 3 — Claim and report foundations remains NOT STARTED and must be
  explicitly requested before implementation.

## Milestone 2 audit

**Status:** PASSED
**Date:** 2026-07-13

### Audit outcome

- Found no Milestone 2 production-code defects; no source modules were changed.
- Verified that Git-root lookup returns the nearest repository root and supports
  both `.git` directories and worktree-style `.git` files.
- Verified absolute outside targets, relative parent traversal, and symlink
  escapes are rejected.
- Verified an absolute symlink alias that canonicalizes inside the repository is
  accepted, avoiding lexical-path false positives.
- Verified a nested `AGENTS.override.md` replaces only the `AGENTS.md` in its
  own directory and does not suppress the broader root instruction.
- Verified root-to-target ordering and at most one selected instruction file per
  directory.
- Verified empty override fallback remains correct.
- Verified symlinked instruction files are ignored, so an outside override is
  neither read nor allowed to suppress a regular repository `AGENTS.md`.
- Replaced the earlier shallow non-modification assertion with a recursive
  snapshot comparison covering paths, entry types, sizes, modification times,
  file contents, and symlink destinations throughout the fixture repository.
- Confirmed path operations use Node's platform path APIs and canonical
  `realpath` results; no hard-coded path separators are present.
- Added no claim extraction, validation, reporting, or other Milestone 3 work.

### Files created or changed

- `test/unit/discovery/findGitRoot.test.ts`
- `test/unit/discovery/discoverInstructions.test.ts`
- `test/fixtures/discovery/nested-override/AGENTS.md`
- `test/fixtures/discovery/nested-override/packages/api/AGENTS.md`
- `test/fixtures/discovery/nested-override/packages/api/AGENTS.override.md`
- `IMPLEMENTATION.md`

### Commands run

```text
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
```

### Test results

```text
First audit verification:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 3 passed
  Tests: 24 passed

Final verification after the instruction-symlink boundary test:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 3 passed
  Tests: 25 passed
  Duration: 509ms
```

### Remaining limitations

- Global instruction discovery remains intentionally unimplemented.
- The `check` command discovers instructions but does not extract claims,
  validate them, or generate reports.
- Milestone 3 remains NOT STARTED.

## Milestone 3 — Claim and report foundations

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Added the six supported claim types and all seven claim statuses as stable
  TypeScript literal unions.
- Added `ExtractedClaim`, `ValidatedClaim`, and `BranchCommandResult` models
  matching the product specification.
- Added strict Zod schemas for claim types, statuses, package managers,
  extracted claims, validated claims, and optional command-result data.
- Added runtime validation for positive ordered line ranges, confidence bounds,
  required source data, type-specific claim fields, unknown properties, and
  failed-claim evidence.
- Added advisory type/status consistency checks and defensive deterministic
  aggregation that never counts advisory claim types as passed or failed.
- Added `ReportSummary`, `OverallStatus`, and `EscrowReport` models.
- Kept the conflicts collection structurally empty because conflict modeling
  and analysis belong to Milestone 10.
- Added pure summary aggregation, overall-status calculation, and report
  construction functions so callers cannot supply inconsistent totals.
- Added a console renderer with source file and single/range line locations,
  evidence, suggestions, totals, and overall status.
- Added a JSON renderer that serializes the same shared report object.
- Added manually constructed claim fixtures and focused model/reporting tests
  covering every claim type and status, malformed inputs, source preservation,
  aggregation, advisory handling, overall status, JSON serialization, console
  locations, and absence of an AI-generated score.
- Added Zod as the only new runtime dependency; installation reported zero
  vulnerabilities.

### Files created or changed

- `package.json`
- `package-lock.json`
- `src/models/claims.ts`
- `src/models/reports.ts`
- `src/extraction/claimSchema.ts`
- `src/reporting/consoleReporter.ts`
- `src/reporting/jsonReporter.ts`
- `test/unit/models/claimFixtures.ts`
- `test/unit/models/claimSchema.test.ts`
- `test/unit/models/reports.test.ts`
- `test/unit/reporting/consoleReporter.test.ts`
- `test/unit/reporting/jsonReporter.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
npm install zod
npm run typecheck
npm run build
npm test
npm run typecheck
npm run build
npm test
npm ls --depth=0
```

### Test results

```text
npm install zod:
  zod 4.4.3 installed
  0 vulnerabilities

Initial verification:
  npm run typecheck: PASS (exit code 0)
  npm run build: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 7 passed
  Tests: 62 passed

Final verification after advisory and claim-specific schema hardening:
  npm run typecheck: PASS (exit code 0)
  npm run build: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 7 passed
  Tests: 69 passed
  Duration: 663ms

Relevant integration tests:
  None are required for the pure Milestone 3 model, schema, aggregation, and
  rendering foundation. All existing discovery and CLI tests also pass.
```

### Known limitations

- Claims in tests are manually constructed; there is no Codex or other AI
  extraction integration.
- No real claim validators or command execution are implemented.
- Console and JSON renderers are pure functions and are not yet wired to CLI
  report flags or filesystem output.
- Conflict entries remain empty until conflict models are introduced in
  Milestone 10.
- Markdown, HTML, and repair functionality remain unimplemented.

### Next milestone

- Milestone 4 — Path validation remains NOT STARTED and must be explicitly
  requested before implementation.

## Milestone 3 review

**Status:** PASSED WITH FIXES
**Date:** 2026-07-13

### Review findings and fixes

- Found and fixed a TypeScript/Zod disagreement under
  `exactOptionalPropertyTypes`: Zod optional fields accept explicit `undefined`,
  while the TypeScript claim models previously did not.
- Added compile-time mutual-assignability assertions for `ExtractedClaim`,
  `ValidatedClaim`, and `BranchCommandResult` against their Zod output types.
- Removed claim-type-specific field requirements from the foundation schema
  because those requirements were absent from the published TypeScript model
  and belong with later extraction/validation semantics.
- Removed advisory type/status pairing from the schema so runtime structure and
  the published `ValidatedClaim` model agree.
- Replaced the duplicated command-result status literals with one
  `COMMAND_RESULT_STATUSES` constant shared by the TypeScript type and Zod
  schema.
- Centralized advisory pass/fail handling in `getEffectiveClaimStatus`.
- Updated report construction to normalize advisory pass/fail inputs to
  `advisory` before calculating totals or storing report claims. This keeps the
  claim rows, summary, overall status, console output, and JSON output
  consistent even when callers supply malformed status combinations.
- Preserved warning, blocked, inconclusive, advisory, and overridden statuses
  without reclassification; only pass/fail statuses on advisory claim types are
  normalized.
- Confirmed source file and single/range line locations remain required,
  preserved in report construction, rendered in the console, and serialized to
  JSON.
- Added console coverage for all three overall statuses and JSON round-trip
  coverage for optional suggestions, command results, multiline output, and
  Unicode content.
- Added no validators, Codex integration, command execution, or later report
  formats.

### Files created or changed

- `src/models/claims.ts`
- `src/extraction/claimSchema.ts`
- `src/models/reports.ts`
- `test/unit/models/claimSchema.test.ts`
- `test/unit/models/reports.test.ts`
- `test/unit/reporting/consoleReporter.test.ts`
- `test/unit/reporting/jsonReporter.test.ts`
- `IMPLEMENTATION.md`

### Commands run

```text
npm test
npm run typecheck
npm run build
npm test
npm run typecheck
npm run build
npm test
npm run typecheck
npm run build
npm test
```

### Test results

```text
Baseline review:
  npm test: PASS
  Test files: 7 passed
  Tests: 69 passed

Compile-time assertion run:
  npm run typecheck: expected FAIL, exposed optional-field type mismatch
  npm run build: expected FAIL, exposed the same mismatch
  npm test: FAIL, exposed one test-edit syntax error

After type/schema alignment and syntax correction:
  npm run typecheck: PASS
  npm run build: PASS
  npm test: PASS
  Test files: 7 passed
  Tests: 74 passed

Final verification after shared-report advisory normalization:
  npm run typecheck: PASS (exit code 0)
  npm run build: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 7 passed
  Tests: 77 passed
  Duration: 647ms
```

### Remaining limitations

- Claims are still manually constructed; no extraction or real validation is
  implemented.
- Console and JSON renderers remain pure functions not wired to CLI output
  flags.
- Conflict entries remain empty until Milestone 10.
- Milestone 4 is complete; Milestone 5 remains NOT STARTED.

## Milestone 4 — Path validation

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Added deterministic validation for `path_exists` claims only.
- Resolved ordinary relative paths from the directory containing the claim's
  source instruction file.
- Interpreted a leading `/` as repository-root-relative, as required by the
  specification; host-absolute paths are never inspected as host paths.
- Supported existing regular files and directories and failed missing paths.
- Rejected source instruction locations and resolved references that escape
  the canonical repository root.
- Added one-component-at-a-time `lstat` inspection so validation does not
  follow symbolic links into unrelated filesystem locations.
- Returned inconclusive results for symlinks, special filesystem entries,
  unreadable paths, missing path data, and unsupported or ambiguous syntax.
- Produced stable resolution and outcome evidence for every returned result
  while preserving the original claim and source line range.
- Moved the repository-boundary predicate into a shared path utility and kept
  Milestone 2 discovery behavior using that same predicate.
- Added a deliberately narrow dispatcher that routes `path_exists` and throws
  an actionable error for every unimplemented validator type.
- Added no dependencies and did not add extraction, Codex integration, command
  execution, or any Milestone 5 validator.

### Files created or changed

- `src/utils/paths.ts`
- `src/discovery/buildInstructionChain.ts`
- `src/discovery/discoverInstructions.ts`
- `src/validation/pathValidator.ts`
- `src/validation/validateClaim.ts`
- `test/unit/validation/pathValidator.test.ts`
- `test/fixtures/path-validation/repository/AGENTS.md`
- `test/fixtures/path-validation/repository/docs/guide.md`
- `test/fixtures/path-validation/repository/docs/reference/README.md`
- `test/fixtures/path-validation/repository/packages/api/AGENTS.md`
- `test/fixtures/path-validation/repository/packages/api/local.txt`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
```

The three commands in each group were run concurrently.

### Test results

```text
Initial verification:
  npm run build: FAIL (exit code 2)
  npm run typecheck: FAIL (exit code 2)
  TypeScript identified one possibly undefined Node filesystem error code at
  src/validation/pathValidator.ts:71 (TS2322).
  npm test: PASS (exit code 0)
  Test files: 8 passed
  Tests: 93 passed
  Duration: 848ms

Final verification after adding the deterministic filesystem-error fallback:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 8 passed
  Tests: 93 passed
  Duration: 963ms

Final verification after PLAN.md and IMPLEMENTATION.md updates:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 8 passed
  Tests: 93 passed
  Duration: 680ms
```

### Known limitations

- Claims are still manually constructed; path validation is not connected to
  extraction or the CLI.
- Only `path_exists` is implemented. The dispatcher intentionally rejects all
  other claim types.
- Symlink-containing paths are reported as inconclusive instead of being
  followed, including symlinks whose target might remain inside the repository.
- Wildcards and other expansion syntax are not interpreted and are reported as
  inconclusive.
- A leading `/` always means repository-root-relative, not host-absolute.

### Next milestone

- Milestone 5 — Package-manager validation remains NOT STARTED and must be
  explicitly requested before implementation.

## Milestone 4 security review

**Status:** PASSED
**Date:** 2026-07-13

### Review findings

- Confirmed ordinary `../` traversal, traversal hidden by repeated separators,
  and repository-root traversal normalize outside the repository and fail
  before the resolved candidate is inspected.
- Confirmed repeated separators on an in-repository path normalize safely and
  do not change the verdict.
- Confirmed a leading `/` remains repository-root-relative, `/` resolves to the
  repository root, and an existing host-absolute path is not validated at its
  host location.
- Confirmed nested instruction files resolve paths from their own directory and
  may use `..` to reach another in-repository location without being
  misclassified as an escape.
- Confirmed paths with nonexistent parent directories fail as missing instead
  of throwing or inspecting outside the repository.
- Confirmed final and intermediate symbolic links are reported as inconclusive
  and are not followed.
- Added `lstat` call instrumentation proving traversal attempts, absolute host
  paths, and external symlink targets never cause metadata inspection outside
  the canonical repository root.
- Confirmed evidence does not include external file contents or symlink-target
  paths. The validator imports no file-content read operation.
- Confirmed UNC-like double-slash references and Windows drive-absolute syntax
  are inconclusive on the supported macOS/Linux implementation.
- Found no production path-validation defect. No source implementation was
  changed, and Milestone 5 was not started.

### Files changed

- `test/unit/validation/pathValidator.test.ts`
- `IMPLEMENTATION.md`

### Test coverage added

- repeated separators on an existing path
- traversal hidden among repeated separators
- traversal in a repository-root reference
- nested `..` resolution that remains inside the repository
- nonexistent parent directories
- the repository-root directory itself
- an intermediate symlink to an external directory
- UNC-like double-slash syntax
- Windows drive-absolute syntax
- direct instrumentation of every `lstat` path for escape, absolute-path, and
  symlink attacks

### Commands run

```text
npm test
npm test -- test/unit/validation/pathValidator.test.ts
npm run typecheck
npm test -- test/unit/validation/pathValidator.test.ts
npm test -- test/unit/validation/pathValidator.test.ts
npm run build
npm run typecheck
npm test
npm test -- test/unit/validation/pathValidator.test.ts
npm run build
npm run typecheck
npm test
```

The paired type-check/focused-test commands and the build/type-check/full-test
commands were run concurrently.

### Test results

```text
Baseline:
  npm test: PASS (exit code 0)
  Test files: 8 passed
  Tests: 93 passed
  Duration: 504ms

Initial adversarial coverage:
  Focused path tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 25 passed
  Duration: 307ms

First filesystem-call instrumentation run:
  npm run typecheck: PASS (exit code 0)
  Focused path tests: FAIL (exit code 1)
  Tests: 24 passed, 1 failed
  Duration: 362ms
  Cause: the test expected macOS `/var` paths while `realpath` correctly
  canonicalized them to `/private/var`; observed calls were still confined to
  the repository.

After canonicalizing the test expectation:
  Focused path tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 25 passed
  Duration: 328ms

First full verification:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 8 passed
  Tests: 102 passed
  Duration: 707ms

After adding explicit in-repository inspection assertions:
  Focused path tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 25 passed
  Duration: 345ms

Final verification after updating IMPLEMENTATION.md:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 8 passed
  Tests: 102 passed
  Duration: 733ms
```

### Remaining limitations

- Filesystem paths can be changed concurrently by another process after a
  metadata check. Node.js does not expose a portable descriptor-relative path
  walk for completely eliminating such filesystem races on both macOS and
  Linux; normal static repository validation remains bounded as tested.
- Symlink-containing paths remain conservatively inconclusive, even when the
  symlink target would stay inside the repository.
- A leading `/` intentionally means repository-root-relative rather than
  host-absolute, as specified.

### Next milestone

- Milestone 5 remains NOT STARTED and must be explicitly requested before
  implementation.

## Milestone 5 — Package-manager validation

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Added deterministic validation for `package_manager` claims supporting only
  npm, pnpm, and Yarn.
- Detected npm from `package-lock.json` and `npm-shrinkwrap.json`, pnpm from
  `pnpm-lock.yaml`, and Yarn from `yarn.lock`.
- Parsed supported bare and versioned `package.json#packageManager` values
  without adding a package-manager parsing dependency.
- Selected the nearest applicable package-manager scope by walking from the
  source instruction directory to the canonical repository root.
- Allowed nested packages without explicit manager evidence to inherit a
  broader repository signal while preferring a closer nested lockfile or
  explicit metadata declaration.
- Returned `passed` for consistent matching evidence, `failed` for an
  instruction conflicting with consistent reliable evidence, `warning` for
  contradictory repository signals, and `inconclusive` for absent, malformed,
  unsupported, unreadable, or unsafe evidence.
- Added a typed `RepositoryInconsistency` model and matching strict Zod schema.
  Contradictory lockfile types and lockfile/metadata disagreement are attached
  separately from ordinary claim evidence and rendered with a distinct console
  label; JSON serialization preserves the structured data.
- Kept package-manager filesystem inspection inside the repository boundary,
  rejected external source files, and refused to follow instruction-directory,
  lockfile, or package-file symlinks.
- Extended the shared validator dispatcher only for `package_manager`; package
  scripts and every later validator still produce the existing unsupported
  validator error.
- Added no dependencies and did not implement package scripts, dependency
  checks, command execution, Codex extraction, or repair mode.

### Files created or changed

- `src/validation/packageManagerValidator.ts`
- `src/validation/validateClaim.ts`
- `src/models/claims.ts`
- `src/extraction/claimSchema.ts`
- `src/reporting/consoleReporter.ts`
- `test/unit/validation/packageManagerValidator.test.ts`
- `test/unit/validation/pathValidator.test.ts`
- `test/unit/models/claimSchema.test.ts`
- `test/fixtures/package-managers/` (31 fixture files across npm, shrinkwrap,
  pnpm, Yarn, metadata, conflicts, malformed input, no-evidence, and nested
  scope scenarios)
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
npm run typecheck
npm test -- test/unit/validation/packageManagerValidator.test.ts
npm test -- test/unit/validation/packageManagerValidator.test.ts
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
```

The first type-check/focused-test pair and each build/type-check/full-test group
were run concurrently.

### Test results

```text
Initial focused verification:
  npm run typecheck: PASS (exit code 0)
  Focused package-manager tests: FAIL (exit code 1)
  Tests: 16 passed, 1 failed
  Duration: 406ms
  Cause: the claim fixture helper interpreted an explicit `undefined` as its
  default npm value; production validation behaved correctly.

After correcting the test fixture helper:
  Focused package-manager tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 17 passed
  Duration: 370ms

First full verification:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 9 passed
  Tests: 119 passed
  Duration: 771ms

Final verification after schema-negative coverage and parser hardening:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 9 passed
  Tests: 120 passed
  Duration: 771ms

Final verification after PLAN.md and IMPLEMENTATION.md updates:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 9 passed
  Tests: 120 passed
  Duration: 815ms
```

### Known limitations

- Claims remain manually constructed; package-manager validation is not yet
  connected to extraction or CLI report flags.
- Repository inconsistencies are attached to the validated claim that found
  them and may repeat if several claims validate the same inconsistent scope.
- A malformed or unsupported explicit `packageManager` declaration makes its
  scope inconclusive instead of falling back to broader evidence.
- Symlinked or unreadable package-manager evidence is conservatively
  inconclusive.
- Package-script validation remains unimplemented.

### Next milestone

- Milestone 6 — Package-script validation remains NOT STARTED and must be
  explicitly requested before implementation.

## Milestone 5 audit

**Status:** PASSED WITH FIX
**Date:** 2026-07-13

### Audit findings and fix

- Found one production defect: `package-lock.json` and
  `npm-shrinkwrap.json` were collapsed to the same npm manager before deciding
  whether multiple lockfile types existed. A repository containing both was
  incorrectly reported as `passed`.
- Changed the inconsistency predicate to count recognized lockfile formats,
  not only distinct package-manager names. Any two lockfile formats now produce
  `warning` plus a separate deterministic repository inconsistency, including
  the two npm formats.
- Confirmed a lockfile plus matching `packageManager` metadata is not treated
  as duplicate lockfile evidence and still passes.
- Confirmed conflicting lockfile and metadata signals remain a warning with
  structured inconsistency evidence rather than an AI-selected verdict.
- Confirmed malformed `package.json` remains inconclusive, including when a
  lockfile is present, because unreadable metadata could conceal contradictory
  repository evidence.
- Confirmed versioned metadata such as `pnpm@10.0.0` is parsed as pnpm and its
  original value is preserved in deterministic evidence.
- Confirmed nested explicit metadata takes precedence over a broader root
  lockfile, while the existing broader-scope inheritance behavior remains
  unchanged when no nested manager declaration exists.
- Confirmed repeated validation produces identical status, evidence order, and
  repository-inconsistency data.
- Confirmed the validator contains no model calls, prompts, probabilistic
  scoring, or AI-assigned status logic. All verdicts derive from filesystem and
  JSON evidence in deterministic TypeScript.
- Added no package-script, dependency, command-execution, extraction, or repair
  behavior.

### Files created or changed

- `src/validation/packageManagerValidator.ts`
- `test/unit/validation/packageManagerValidator.test.ts`
- `test/fixtures/package-managers/duplicate-npm-lockfiles/AGENTS.md`
- `test/fixtures/package-managers/duplicate-npm-lockfiles/package-lock.json`
- `test/fixtures/package-managers/duplicate-npm-lockfiles/npm-shrinkwrap.json`
- `test/fixtures/package-managers/metadata-version-10/AGENTS.md`
- `test/fixtures/package-managers/metadata-version-10/package.json`
- `test/fixtures/package-managers/nested-metadata/yarn.lock`
- `test/fixtures/package-managers/nested-metadata/packages/api/AGENTS.md`
- `test/fixtures/package-managers/nested-metadata/packages/api/package.json`
- `test/fixtures/package-managers/malformed-with-lockfile/AGENTS.md`
- `test/fixtures/package-managers/malformed-with-lockfile/package-lock.json`
- `test/fixtures/package-managers/malformed-with-lockfile/package.json`
- `IMPLEMENTATION.md`

### Commands run

```text
npm test -- test/unit/validation/packageManagerValidator.test.ts
npm test -- test/unit/validation/packageManagerValidator.test.ts
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
```

The final build, type-check, and full-test commands were run concurrently.

### Test results

```text
Adversarial focused run before the fix:
  Focused package-manager tests: FAIL (exit code 1)
  Tests: 21 passed, 1 failed
  Duration: 391ms
  Proven defect: duplicate npm lockfile formats returned passed instead of
  warning.

Focused verification after the fix:
  Focused package-manager tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 22 passed
  Duration: 377ms

Full verification:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 9 passed
  Tests: 125 passed
  Duration: 803ms

Final verification after updating IMPLEMENTATION.md:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 9 passed
  Tests: 125 passed
  Duration: 819ms
```

### Remaining limitations

- Malformed or unreadable package metadata remains conservatively
  inconclusive even when another signal exists in the same scope.
- Repository inconsistencies remain attached to each validated claim and may
  repeat when multiple claims inspect the same scope.
- Claims remain manually constructed; extraction and CLI report wiring are not
  implemented.
- Package-script validation remains NOT STARTED.

### Next milestone

- Milestone 6 remains NOT STARTED and must be explicitly requested before
  implementation.

## Milestone 6 — Package-script validation

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Added pure command normalization for all six required npm, pnpm, and Yarn
  package-script forms.
- Kept parsing syntax-only: commands are never spawned, evaluated by a shell,
  or otherwise executed.
- Rejected incomplete commands, unsupported package managers, quoted
  arguments, shell operators, options in script position, and command metadata
  that disagrees with extracted package-manager or script fields.
- Used `scopeDirectory` as the claim scope and walked upward only to the
  canonical repository root to select the nearest regular `package.json`.
- Rejected source files and claim scopes outside the repository and returned
  inconclusive results for missing, unreadable, symlinked, or malformed scope
  and package data.
- Parsed the nearest package file deterministically and treated a missing
  `scripts` field as an empty script map while treating non-object or
  non-string script data as inconclusive.
- Returned `passed` when the referenced script exists, `failed` with evidence
  when it is missing, and `inconclusive` when no reliable determination is
  possible.
- Added deterministic similarity selection using edit distance, colon-prefix
  relationships, and bytewise lexical tie-breaking. A suggestion is optional
  metadata on the same failed claim and cannot change its verdict.
- Preserved all source fields and emitted stable normalization, selected-file,
  and outcome evidence.
- Extended the shared dispatcher only for `package_script`; dependency and all
  later validators remain unsupported.
- Added no dependencies and no command execution, dependency validation, Codex
  extraction, or repair behavior.

### Files created or changed

- `src/utils/packageCommands.ts`
- `src/validation/packageScriptValidator.ts`
- `src/validation/validateClaim.ts`
- `test/unit/validation/packageScriptValidator.test.ts`
- `test/unit/validation/pathValidator.test.ts`
- `test/fixtures/package-scripts/basic/AGENTS.md`
- `test/fixtures/package-scripts/basic/package.json`
- `test/fixtures/package-scripts/nested/AGENTS.md`
- `test/fixtures/package-scripts/nested/package.json`
- `test/fixtures/package-scripts/nested/packages/api/AGENTS.md`
- `test/fixtures/package-scripts/nested/packages/api/package.json`
- `test/fixtures/package-scripts/no-package/packages/api/AGENTS.md`
- `test/fixtures/package-scripts/malformed-scripts/AGENTS.md`
- `test/fixtures/package-scripts/malformed-scripts/package.json`
- `test/fixtures/package-scripts/malformed-package-json/AGENTS.md`
- `test/fixtures/package-scripts/malformed-package-json/package.json`
- `test/fixtures/package-scripts/no-scripts/AGENTS.md`
- `test/fixtures/package-scripts/no-scripts/package.json`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
npm run typecheck
npm test -- test/unit/validation/packageScriptValidator.test.ts
npm test -- test/unit/validation/packageScriptValidator.test.ts
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
```

The initial type-check/focused-test pair and final build/type-check/full-test
group were run concurrently.

### Test results

```text
Initial focused verification:
  npm run typecheck: PASS (exit code 0)
  Focused package-script tests: FAIL (exit code 1)
  Tests: 30 passed, 1 failed
  Duration: 428ms
  Cause: prefix similarity ranked the parent script `test` ahead of the much
  closer typo correction `test:unit` for `test:unti`.

After deterministic similarity ranking correction:
  Focused package-script tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 31 passed
  Duration: 355ms

Full verification after permissive script-token and shell-syntax coverage:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 10 passed
  Tests: 157 passed
  Duration: 838ms

Final verification after PLAN.md and IMPLEMENTATION.md updates:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 10 passed
  Tests: 157 passed
  Duration: 899ms
```

### Known limitations

- Only the six simple command forms required by Milestone 6 are normalized;
  quoted script names, shell syntax, and trailing command arguments are
  inconclusive.
- Similarity suggestions are deliberately conservative and return at most one
  deterministic candidate.
- A malformed nearest package file is inconclusive and does not fall back to a
  broader package file.
- Symlinked package files and symlinked claim-scope components are not followed.
- Claims remain manually constructed; extraction and CLI report wiring are not
  implemented.

### Next milestone

- Milestone 7 — Dependency and framework validation remains NOT STARTED and
  must be explicitly requested before implementation.

## Milestone 6 review

**Status:** PASSED WITH FIXES
**Date:** 2026-07-13

### Review findings and fixes

- Found that every otherwise-supported command with trailing script arguments
  was incorrectly inconclusive. Updated normalization to identify the script at
  its manager-specific position and ignore later arguments for existence
  validation.
- Found that simply quoted script tokens were rejected wholesale. Replaced
  whitespace splitting with a small deterministic quote-aware tokenizer that
  supports single- and double-quoted script names, including names containing
  spaces.
- Kept shell safety boundaries intact: shell operators, expansions, escape
  syntax, null/newline content, and unmatched quotes remain unsupported and
  inconclusive; no command is executed.
- Confirmed flags before the script position are not misidentified as script
  names for npm, pnpm, or Yarn.
- Confirmed all six required manager forms identify the same script when safe
  trailing arguments are present.
- Added a deeper nested-scope fixture and confirmed package lookup walks upward
  to the nearest package file without falling through to a broader package
  after one is selected.
- Added the specification's prefix-suggestion scenario: a missing `test` with
  available `test:unit` remains failed and receives only an optional
  suggestion.
- Confirmed malformed JSON, non-object `scripts`, and non-string script values
  are inconclusive with deterministic evidence.
- Confirmed similarity suggestions never change a failed verdict.
- Added no command execution, dependency validation, Codex extraction, repair
  behavior, or Milestone 7 code.

### Files created or changed

- `src/utils/packageCommands.ts`
- `test/unit/validation/packageScriptValidator.test.ts`
- `test/fixtures/package-scripts/basic/package.json`
- `test/fixtures/package-scripts/nested/packages/api/src/AGENTS.md`
- `test/fixtures/package-scripts/suggestion-prefix/AGENTS.md`
- `test/fixtures/package-scripts/suggestion-prefix/package.json`
- `test/fixtures/package-scripts/malformed-script-value/AGENTS.md`
- `test/fixtures/package-scripts/malformed-script-value/package.json`
- `IMPLEMENTATION.md`

### Commands run

```text
npm test -- test/unit/validation/packageScriptValidator.test.ts
npm test -- test/unit/validation/packageScriptValidator.test.ts
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
```

The final build, type-check, and full-test commands were run concurrently.

### Test results

```text
Adversarial focused run before fixes:
  Focused package-script tests: FAIL (exit code 1)
  Tests: 39 passed, 8 failed
  Duration: 357ms
  Proven defects: six trailing-argument normalization cases and two quoted
  script validation cases were incorrectly rejected.

Focused verification after quote/trailing-argument fixes:
  Focused package-script tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 47 passed
  Duration: 321ms

Full verification:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 10 passed
  Tests: 172 passed
  Duration: 770ms

Final verification after updating IMPLEMENTATION.md:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 10 passed
  Tests: 172 passed
  Duration: 1.03s
```

### Remaining limitations

- Normalization identifies scripts but does not interpret or validate trailing
  script arguments.
- Package-manager options placed before the script position are intentionally
  inconclusive rather than reordered or inferred.
- Quoted tokens are supported without escape processing; commands requiring
  backslash escapes or shell expansion remain inconclusive.
- A malformed nearest package file is inconclusive and does not fall back to a
  broader package file.
- Claims remain manually constructed; extraction and CLI report wiring are not
  implemented.

### Next milestone

- Milestone 7 remains NOT STARTED and must be explicitly requested before
  implementation.

## Milestone 7 — Dependency and framework validation

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Added a fixed deterministic mapping table containing only Vitest to
  `vitest`, Jest to `jest`, TypeScript to `typescript`, ESLint to `eslint`,
  Prettier to `prettier`, Vite to `vite`, Next.js to `next`, React to `react`,
  and Playwright to `@playwright/test` or `playwright`.
- Matched the supported display names case-insensitively while deliberately
  declining to infer unlisted aliases or unknown tools.
- Validated `dependency_present` claims against `dependencies`,
  `devDependencies`, `peerDependencies`, and `optionalDependencies` without
  model judgment or command execution.
- Selected the nearest regular `package.json` by walking from the claim scope
  to the canonical repository root, without falling back after a nearer package
  file was selected.
- Rejected source files and claim scopes outside the repository and refused to
  follow symbolic links in the scope path or for the selected package file.
- Returned `passed` when any mapped dependency was declared, including either
  supported Playwright package; returned `failed` with repository evidence when
  mapped dependencies were absent; and returned `inconclusive` for unknown
  tools, missing package files, malformed or unreadable metadata, unsafe
  filesystem entries, and extracted dependency metadata that disagreed with
  the deterministic mapping.
- Parsed all four dependency sections as JSON objects with string values and
  treated malformed JSON, section shapes, or dependency values as
  inconclusive structured evidence.
- Preserved the original claim and source range and emitted evidence in a
  stable mapping, package-selection, outcome order.
- Extended the shared validator dispatcher only for `dependency_present`;
  `command_runs` and all later behavior remain unimplemented.
- Added 19 fixture files and 29 focused tests covering every required mapping,
  every dependency section, both Playwright alternatives, missing and unknown
  tools, nearest nested package scope, malformed metadata, no package file,
  metadata disagreement, repository boundaries, source preservation,
  deterministic results, type rejection, and dispatcher behavior.
- Added no dependencies and no Codex extraction, command execution, conflict
  analysis, report format, or repair functionality.

### Files created or changed

- `src/validation/dependencyMappings.ts`
- `src/validation/dependencyValidator.ts`
- `src/validation/validateClaim.ts`
- `test/unit/validation/dependencyValidator.test.ts`
- `test/unit/validation/pathValidator.test.ts`
- `test/fixtures/dependencies/` (19 fixture files across supported mappings,
  dependency sections, Playwright equivalence, missing evidence, nested scope,
  malformed metadata, and no-package scenarios)
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
npm run typecheck
npm test -- test/unit/validation/dependencyValidator.test.ts
npm run build
npm run typecheck
npm test
npm run build
npm run typecheck
npm test
```

The initial type-check/focused-test pair and the build/type-check/full-test
groups were run concurrently.

### Test results

```text
Initial focused verification:
  npm run typecheck: PASS (exit code 0)
  Focused dependency-validator tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 27 passed
  Duration: 476ms

Full verification after repository-boundary coverage:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 11 passed
  Tests: 201 passed
  Duration: 1.10s

Final verification after updating PLAN.md and IMPLEMENTATION.md:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 11 passed
  Tests: 201 passed
  Duration: 1.14s
```

### Known limitations

- Claims remain manually constructed; dependency validation is not connected
  to extraction or CLI report flags.
- Only the ten explicitly listed framework/tool names are mapped. Unlisted
  aliases and other frameworks remain inconclusive.
- A malformed nearest package file is inconclusive and does not fall back to a
  broader package file.
- Symlinked package files and symlinked claim-scope components are not followed.
- Dependency versions and compatibility ranges are not interpreted; this
  milestone verifies declaration presence only.

### Next milestone

- Milestone 8 — Codex claim extraction remains NOT STARTED and must be
  explicitly requested before implementation.

## Milestone 7 audit

**Status:** PASSED WITH FIX
**Date:** 2026-07-13

### Audit findings and fix

- Confirmed the deterministic mapping table still contains exactly the ten
  SPEC mappings and no additional framework aliases.
- Confirmed every supported display name is matched case-insensitively and
  produces the same canonical mapping and evidence regardless of input case.
- Confirmed dependency detection covers `dependencies`, `devDependencies`,
  `peerDependencies`, and `optionalDependencies` in a fixed order.
- Confirmed nearest-package selection uses the nested package scope and does
  not fall back to a broader root package after selecting a nearer package
  file.
- Found one production defect affecting both Playwright alternatives: when an
  extracted claim supplied only one valid Playwright dependency name, the
  validator required it to redundantly list both `@playwright/test` and
  `playwright` and returned `inconclusive` before inspecting the repository.
- Changed extracted dependency-metadata validation to accept a non-empty,
  duplicate-free subset of the deterministic mapping. This permits either
  Playwright package name while still rejecting unknown names and duplicate
  metadata.
- Kept repository detection independent from the compatible metadata subset:
  the validator always checks both deterministic Playwright alternatives and
  passes when either supported package is present.
- Confirmed unknown frameworks remain `inconclusive` before any repository
  access, even if extracted metadata names an installed package.
- Confirmed passed and failed evidence remains deterministic, canonically
  named, and ordered as mapping, selected package file, then repository
  outcome.
- The initial adversarial run also contained one incorrect test expectation:
  lowercase `playwright` is the case-normalized form of the supported
  Playwright display name, not an additional alias. The expectation was
  corrected without changing the mapping table.
- Added no mappings, dependencies, AI judgment, command execution, extraction,
  or Milestone 8 behavior.

### Files created or changed

- `src/validation/dependencyValidator.ts`
- `test/unit/validation/dependencyValidator.test.ts`
- `IMPLEMENTATION.md`

### Commands run

```text
npm test -- test/unit/validation/dependencyValidator.test.ts
npm test
npm test -- test/unit/validation/dependencyValidator.test.ts
npm test -- test/unit/validation/dependencyValidator.test.ts
npm run build
npm run typecheck
npm test -- test/unit/validation/dependencyValidator.test.ts
npm test
npm run build
npm run typecheck
npm test
```

The baseline focused/full-test pair and the final build/type-check/focused/full
group and post-documentation build/type-check/full-test group were run
concurrently.

### Test results

```text
Baseline audit verification:
  Focused dependency-validator tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 29 passed
  Duration: 646ms
  Full suite: PASS (exit code 0)
  Test files: 11 passed
  Tests: 201 passed
  Duration: 879ms

Adversarial focused run before the fix:
  Focused dependency-validator tests: FAIL (exit code 1)
  Tests: 42 passed, 3 failed
  Duration: 487ms
  Proven defects: both single-name Playwright metadata cases returned
  inconclusive instead of passed.
  Test correction: one failure incorrectly treated lowercase `playwright` as
  an unlisted alias despite required case-insensitive matching.

Focused verification after the fix and test correction:
  Focused dependency-validator tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 44 passed
  Duration: 460ms

Full verification after cross-equivalent Playwright coverage:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  Focused dependency-validator tests: PASS (exit code 0)
  Test files: 1 passed
  Tests: 45 passed
  Duration: 844ms
  npm test: PASS (exit code 0)
  Test files: 11 passed
  Tests: 217 passed
  Duration: 1.21s

Final verification after updating IMPLEMENTATION.md:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 11 passed
  Tests: 217 passed
  Duration: 2.55s
```

### Remaining limitations

- Claims remain manually constructed; dependency validation is not connected
  to extraction or CLI report flags.
- Only the ten explicitly listed framework/tool names are mapped. Unlisted
  aliases and other frameworks remain inconclusive.
- A malformed nearest package file remains inconclusive and does not fall back
  to a broader package file.
- Dependency versions and compatibility ranges remain outside Milestone 7;
  validation checks declaration presence only.

### Next milestone

- Milestone 8 remains NOT STARTED and must be explicitly requested before
  implementation.

## Milestone 8 — Codex claim extraction

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Verified the current official Codex non-interactive interface and installed
  CLI support for `codex exec`, explicit model selection, read-only sandboxing,
  ephemeral sessions, and schema-constrained final output before implementing
  the subprocess boundary.
- Added a shipped `schemas/claims.schema.json` response schema containing only
  `path_exists`, `package_manager`, `package_script`, `dependency_present`,
  `command_runs`, and `advisory` branches. Every branch requires all common
  source fields, allows only relevant claim metadata, and rejects additional
  verdict, status, evidence, or report properties.
- Added a matching strict Zod response schema with claim-type-specific required
  and allowed fields, duplicate dependency-name rejection, existing source
  range validation, and useful issue paths.
- Added a small Node subprocess interface around `codex exec`; no shell is
  involved, prompt input is sent over stdin, stdout/stderr are captured, and a
  timeout first terminates and then force-kills an unresponsive Codex process.
- Invoked Codex with GPT-5.6 by default, with precedence of `--model` over
  `ESCROW_CODEX_MODEL` over the default.
- Used disabled approval prompts, `--sandbox read-only`, `--ephemeral`,
  `--ignore-user-config`, and `project_doc_max_bytes=0`. The last setting keeps
  repository instruction files from being independently loaded at a higher
  prompt priority because their exact contents are already supplied as
  untrusted extraction data.
- Added an extraction prompt that enumerates the six supported types, defines
  relevant fields, requires exact inclusive one-based source locations and
  original text, forbids repository validation and command execution, and
  explicitly forbids passed, failed, warning, blocked, inconclusive,
  advisory-status, and overridden verdict assignment.
- Added deterministic post-Zod source verification requiring every source file
  and scope directory to match the supplied instruction chain, line ranges to
  fit the supplied content, and `originalText` to equal the selected source
  lines exactly.
- Added `CodexExtractionError` mapped to exit code `3` for process startup
  errors, nonzero exit, timeout, empty output, malformed JSON, schema mismatch,
  unsupported claim type, missing source data, forbidden status fields, and
  source-preservation failures.
- Extended `escrow check` with `--model`, instruction discovery followed
  by extraction, and handoff of path, package-manager, package-script, and
  dependency claims to the existing deterministic validators. `command_runs`
  and advisory claims are preserved as deferred claims without AI or premature
  deterministic status assignment.
- Added a separately configured manual integration test and
  `test:codex-integration` script. Normal `npm test` continues to select only
  unit tests; the manual test runs Codex only when
  `ESCROW_RUN_CODEX_INTEGRATION=1` and the Codex executable is installed.
- Added no runtime dependencies and no documented-command execution, conflict
  analysis, repair mode, Markdown reporting, HTML reporting, or Milestone 9
  behavior.

### Files created or changed

- `schemas/claims.schema.json`
- `src/extraction/codexClient.ts`
- `src/extraction/extractionPrompt.ts`
- `src/extraction/extractClaims.ts`
- `src/extraction/claimSchema.ts`
- `src/commands/check.ts`
- `src/cli.ts`
- `src/utils/errors.ts`
- `package.json`
- `vitest.manual.config.ts`
- `test/unit/extraction/extractionPrompt.test.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/unit/cli.test.ts`
- `test/integration/extraction/codex.manual.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run

```text
node <codex-home>/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs
node <codex-home>/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs
codex exec --help
npm run typecheck
npm run typecheck
npm test -- test/unit/extraction test/unit/cli.test.ts test/unit/models/claimSchema.test.ts
npm test -- test/unit/extraction test/unit/cli.test.ts test/unit/models/claimSchema.test.ts
npm run build
npm run typecheck
npm test
./node_modules/.bin/vitest run test/integration/extraction/codex.manual.test.ts
npm run test:codex-integration
npm run build
npm run typecheck
npm test -- test/unit/extraction
npm test
npm run build
npm run typecheck
npm test
npm run test:codex-integration
```

The first documentation fetch was sandboxed and failed on DNS; the approved
read-only retry succeeded. Verification groups were run concurrently where
shown by overlapping focused and full-suite runs.

### Test results

```text
Official interface verification:
  Codex manual fetch in sandbox: FAIL (DNS unavailable)
  Approved read-only Codex manual fetch: PASS
  codex exec --help: PASS; required flags present

Initial implementation verification:
  npm run typecheck: PASS (exit code 0)

First focused mocked run:
  npm run typecheck: PASS (exit code 0)
  Focused extraction/CLI/schema tests: FAIL (exit code 1)
  Tests: 63 passed, 1 failed
  Duration: 703ms
  Cause: one prompt assertion expected wrapped prose on one physical line;
  prompt behavior was already correct.

Focused verification after correcting the assertion:
  Focused extraction/CLI/schema tests: PASS (exit code 0)
  Test files: 4 passed
  Tests: 64 passed
  Duration: 614ms

First full verification:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 13 passed
  Tests: 248 passed
  Duration: 1.21s

Initial direct manual-test selection:
  FAIL (exit code 1): main Vitest configuration intentionally selected only
  unit tests, so the integration file was not discoverable.

Manual-test gate after adding the dedicated configuration:
  npm run test:codex-integration: PASS (exit code 0)
  Test files: 1 skipped
  Tests: 1 skipped
  Duration: 506ms
  Codex was not invoked because explicit integration enablement was absent.

Full verification after source-location coverage:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  Focused mocked extraction tests: PASS (exit code 0)
  Test files: 2 passed
  Tests: 31 passed
  Duration: 1.14s
  npm test: PASS (exit code 0)
  Test files: 13 passed
  Tests: 250 passed
  Duration: 1.34s

Final verification after updating PLAN.md and IMPLEMENTATION.md:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (exit code 0)
  Test files: 13 passed
  Tests: 250 passed
  Duration: 1.30s
  npm run test:codex-integration: PASS (exit code 0)
  Test files: 1 skipped
  Tests: 1 skipped
  Duration: 971ms
  Codex was not invoked because explicit integration enablement was absent.
```

### Known limitations

- The real Codex integration test was not enabled during automated
  verification; it remains optional because it requires an installed,
  authenticated Codex CLI and model access.
- Claims with existing validators are validated, while `command_runs` remains
  deferred until Milestone 9. Advisory claims are preserved for later report
  wiring without accepting an AI-assigned status.
- Extraction currently consumes the complete discovered instruction contents
  in one Codex request; batching and token-budget strategies are not part of
  Milestone 8.
- The check command performs extraction and deterministic validation but does
  not yet emit the later Markdown/HTML reports or execute commands.

### Milestone 8 boundary review — 2026-07-13

#### Defect found and fixed

- The original invocation used a read-only sandbox, but the Codex shell tool
  remained available for read operations. It also used the inspected
  repository as Codex's working directory, which allowed trusted project-local
  Codex configuration and hooks to be discovered. That was too broad for an
  extraction-only subprocess receiving untrusted instruction text.
- Extraction now runs from a fresh temporary directory outside the inspected
  repository, uses `--skip-git-repo-check`, and removes that directory after
  every subprocess result or startup failure. Codex therefore does not discover
  project-local configuration from the inspected repository.
- The invocation now explicitly disables the Codex shell tool,
  shell-environment snapshots, lifecycle hooks, app connectors, configured MCP
  servers, and web search, and uses strict config parsing so unsupported
  hardening settings fail closed.
  It continues to use disabled approval prompts, a read-only sandbox, ephemeral
  mode, ignored user configuration, a zero-byte project-instruction budget, and
  now ignored execution-policy rules.
- Instruction contents remain JSON-encoded prompt data delivered only through
  stdin. The subprocess still uses an argument array with `shell: false`; no
  instruction text is interpolated into a command or command-line argument.

#### Boundary evidence

- The shipped JSON Schema constrains output to the six Milestone 8 claim types
  and rejects additional properties. The independently implemented strict Zod
  schema validates the parsed output again before source verification or
  deterministic validation.
- `sourceFile`, `lineStart`, and `lineEnd` remain mandatory. Deterministic source
  verification also rejects unknown files, mismatched scope directories,
  out-of-range lines, and altered source text.
- Unsupported claim types and every AI-generated status/verdict spelling under
  test are rejected by Zod, so no AI verdict can enter deterministic validation
  or reporting.
- Malformed JSON and schema mismatches now have explicit assertions for
  `CodexExtractionError` exit code `3`, in addition to the existing nonzero
  process, timeout, empty-output, startup, and CLI exit-code coverage.
- Added a subprocess-boundary test with shell metacharacters, command
  substitutions, and a fake verdict in instruction text. It verifies literal
  stdin delivery and `shell: false`. Added an extraction-level hostile-prompt
  test that verifies read-only mode and disabled shell, shell snapshots, hooks,
  apps, MCP servers, and web search.
- Normal Vitest configuration continues to select unit tests only. All Codex
  process behavior in automated tests is mocked; the separately configured live
  integration test remains disabled unless explicitly enabled and Codex is
  installed.

#### Files changed during the review

- `src/extraction/extractClaims.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/unit/extraction/codexClient.test.ts` (new)
- `IMPLEMENTATION.md`

#### Commands and results

```text
npm test -- test/unit/extraction
  PASS: 2 test files, 31 tests (baseline)

npm run typecheck
  PASS: exit code 0

npm test -- test/unit/extraction
  PASS: 3 test files, 33 tests

codex --disable shell_tool --config 'web_search="disabled"' exec --help
  PASS: exit code 0; installed CLI accepts the hardening flags

npm run build
  PASS: exit code 0

npm run typecheck
  PASS: exit code 0

npm test
  PASS: 14 test files, 252 tests, duration 1.04s

npm run test:codex-integration
  PASS: 1 test file and 1 test skipped, duration 503ms
  Codex was not invoked because explicit integration enablement was absent.

Final verification after updating IMPLEMENTATION.md:
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (14 test files, 252 tests, duration 998ms)
  npm run test:codex-integration: PASS
  Manual test files: 1 skipped
  Manual tests: 1 skipped
  Manual gate duration: 503ms
  Codex was not invoked because explicit integration enablement was absent.

Final verification after fail-closed config and shell-snapshot hardening:
  Installed Codex hardening-flag help check: PASS (exit code 0)
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (14 test files, 252 tests, duration 1.16s)
  npm run test:codex-integration: PASS
  Manual test files: 1 skipped
  Manual tests: 1 skipped
  Manual gate duration: 532ms
  Codex was not invoked because explicit integration enablement was absent.

Final verification after disabling configured MCP servers:
  Installed Codex hardening-flag help check: PASS (exit code 0)
  npm run build: PASS (exit code 0)
  npm run typecheck: PASS (exit code 0)
  npm test: PASS (14 test files, 252 tests, duration 1.11s)
  npm run test:codex-integration: PASS
  Manual test files: 1 skipped
  Manual tests: 1 skipped
  Manual gate duration: 505ms
  Codex was not invoked because explicit integration enablement was absent.
```

#### Review limitations

- The live Codex integration test was intentionally not enabled. This review
  validates the subprocess contract and failure paths with mocks and verifies
  the installed CLI flag surface without making a model request.
- `command_runs` remains deferred. No documented command execution, conflict
  analysis, repair mode, Markdown/HTML reporting, or Milestone 9 behavior was
  added.

### Next milestone

- Milestone 9 — Safe command execution remains NOT STARTED and must be
  explicitly requested before implementation.

## Milestone 9 — Safe command execution

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed work

- Added a deterministic command policy evaluated before any worktree or command
  subprocess is created. The policy blocks empty/multiline/dynamic shell input,
  `sudo`/`su`, shutdown and disk-formatting commands, `git push`,
  `git reset --hard`, destructive `git clean`, recursive forced removal,
  recursive ownership/permission changes, download-to-shell pipelines,
  credential directories, browser profiles, interactive credential commands,
  absolute/home/parent paths, and network-capable commands by default.
- Because linked worktrees share Git object and reference storage, the policy
  also blocks Git commands that mutate configuration, refs, branches, commits,
  indexes, remotes, stashes, or worktree registration. Read-oriented commands
  such as `git status`, `git diff`, and `git rev-parse` remain eligible.
- Added explicit `--allow-network` policy handling. Without it, common network
  commands and package installation/publishing commands are blocked. Allowed
  commands also receive loopback-failing proxy settings plus offline npm/Yarn
  settings where practical. Direct network isolation remains platform-limited.
- Added a small no-shell process runner for Git and `/bin/sh -c` command
  subprocesses. It captures stdout, stderr, exit code, rounded duration, and
  timeout state. Command shells run as isolated process groups so timeout
  termination reaches child processes.
- Added detached worktree creation at `HEAD` under a private temporary parent.
  Partial creation failures attempt worktree removal and pruning before removing
  temporary files.
- Added deterministic mapping from a claim's repository-relative scope into the
  worktree. Canonical-path checks reject scopes outside the repository or
  worktree, missing scopes, non-directory scopes, and committed symlinks that
  point outside the temporary worktree.
- Added execution-environment isolation: credential-like environment variables
  are removed; `HOME`, temporary, and XDG directories are relocated inside the
  disposable worktree; stdin is closed; Git prompting is disabled; and commands
  always run in the mapped worktree scope rather than the active checkout.
- Added cleanup in `finally` after command success, nonzero exit, timeout, and
  execution exceptions. Cleanup force-removes only the newly created temporary
  worktree, removes its private parent, and prunes stale metadata. Explicit
  `--keep-worktree` skips cleanup and includes the retained path in evidence.
- Added deterministic `command_runs` validation. Commands are inconclusive and
  create no subprocess without `--execute`; prohibited commands are blocked
  before worktree creation; zero exits pass; nonzero exits and timeouts fail;
  lifecycle failures are inconclusive. Every result preserves command output
  and deterministic evidence.
- Added CLI parsing and command-handler wiring for `--execute`,
  `--allow-network`, positive millisecond-precision `--timeout <seconds>`, and
  `--keep-worktree`.
- Extended the console reporter to display command, working directory, status,
  exit code, duration, stdout, and stderr. Blocked commands already round-trip
  through the shared JSON report model and now have console coverage as well.
- Added no conflict analysis, application repair, Markdown/HTML reporting, or
  Milestone 10 behavior.

### Files created

- `src/execution/processRunner.ts`
- `src/execution/commandPolicy.ts`
- `src/execution/createWorktree.ts`
- `src/execution/executeCommand.ts`
- `src/execution/cleanupWorktree.ts`
- `src/validation/commandValidator.ts`
- `test/fixtures/command-execution/repository/AGENTS.md`
- `test/fixtures/command-execution/repository/tracked.txt`
- `test/fixtures/command-execution/repository/packages/api/AGENTS.md`
- `test/fixtures/command-execution/repository/packages/api/scope.txt`
- `test/unit/execution/commandPolicy.test.ts`
- `test/unit/execution/commandValidator.test.ts`
- `test/unit/commands/check.test.ts`
- `test/integration/command-execution/worktreeExecution.test.ts`

### Files changed

- `src/cli.ts`
- `src/commands/check.ts`
- `src/extraction/extractClaims.ts`
- `src/reporting/consoleReporter.ts`
- `src/validation/validateClaim.ts`
- `test/unit/cli.test.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/unit/reporting/consoleReporter.test.ts`
- `test/unit/validation/pathValidator.test.ts`
- `vitest.config.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run and test results

```text
npm test
  Baseline PASS: 14 test files, 252 tests, duration 983ms

npm run typecheck
  PASS during initial implementation

npm run typecheck
npm test -- test/unit/execution test/integration/command-execution \
  test/unit/cli.test.ts test/unit/reporting/consoleReporter.test.ts \
  test/unit/extraction/extractClaims.test.ts
  Type check: PASS
  Focused tests: FAIL, 71 passed and 7 failed
  Cause: one git-clean policy pattern missed combined flags; six integration
  assertions compared macOS alias and canonical temporary paths.

npm test -- test/unit/execution test/integration/command-execution
  PASS: 3 test files, 31 tests

npm run typecheck
npm test -- test/unit/execution test/integration/command-execution \
  test/unit/cli.test.ts test/unit/reporting \
  test/unit/extraction/extractClaims.test.ts
  Type check: PASS
  PASS: 7 test files, 86 tests

npm run build
npm run typecheck
npm test
  Build: PASS
  Type check: PASS
  First full suite: FAIL, 293 passed and 1 failed
  Cause: a historical dispatcher test still asserted that command validation
  was unavailable after Milestone 7.

npm run build
npm run typecheck
npm test
  Build: PASS
  Type check: PASS
  Full suite: PASS, 18 test files, 296 tests, duration 3.88s

git worktree list --porcelain
  PASS: only the active Escrow worktree is registered

Temporary-directory leak check
  PASS: no escrow-worktree-* or escrow-command-test-* entries

Final verification after PLAN.md and IMPLEMENTATION.md updates:
  npm run build: PASS
  npm run typecheck: PASS
  npm test: PASS, 18 test files, 296 tests, duration 3.87s
  npm run test:codex-integration: PASS, 1 test skipped by its explicit gate,
  duration 544ms; no live Codex request was made
  git worktree list --porcelain: PASS, one primary worktree only
  Temporary-directory leak check: PASS, no matching entries

Final verification after blocking shared Git-metadata mutations:
  npm run build: PASS
  npm run typecheck: PASS
  npm test: PASS, 18 test files, 298 tests, duration 3.80s
  npm run test:codex-integration: PASS, 1 test skipped by its explicit gate,
  duration 542ms; no live Codex request was made
  git worktree list --porcelain: PASS, one primary worktree only
  Temporary-directory leak check: PASS, no matching entries
```

### Milestone 9 security review — 2026-07-13

#### Defects found and fixed

- Hardened command normalization so quoting and backslash escaping cannot hide
  dangerous commands, Git mutations, absolute paths, home-directory paths, or
  repository traversal from the policy scanner.
- Closed dynamic-execution bypasses involving shell substitution, environment
  expansion, process substitution, nested shells, `eval`, `source`, `xargs`,
  `find -exec`, background execution, `nohup`, and execution-control environment
  assignments. Download commands may no longer be chained or piped into a later
  interpreter, even when network access is explicitly allowed.
- Replaced permissive Git subcommand detection with a small read-only allowlist.
  Git aliases, per-command configuration, unknown subcommands, and Git
  environment redirects are rejected before worktree creation.
- Expanded sensitive-path detection to quoted/escaped absolute paths, repeated
  leading separators, `~user` paths, normalized parent traversal, and common
  browser profile directories.
- Fixed a timeout race where the shell leader could close after `SIGTERM` and
  cancel the scheduled `SIGKILL` for surviving grandchildren. Process groups
  now receive the forced kill after the grace period, and normal leader exit
  also attempts to reap lingering group members. Git lifecycle subprocesses use
  the same process-group cleanup behavior.
- Sanitized command and Git lifecycle environments to remove shell/runtime
  injection variables, loader variables, Git repository/config redirects, and
  package-manager configuration redirects. Git lifecycle calls now use private
  configuration paths, disable hooks, prompting, fsmonitor, global attributes,
  and global excludes.
- Added a fail-closed preflight for committed and local Git attribute files.
  Repositories requesting checkout filters are rejected before `git worktree
  add`, preventing smudge/filter processes from running before the documented
  command policy is applied.
- Unsafe examples were exercised only through pure policy tests or mocked
  subprocesses. No dangerous command was executed.

#### Files created

- `src/execution/gitEnvironment.ts`
- `src/execution/gitAttributes.ts`
- `test/unit/execution/processRunner.test.ts`
- `test/unit/execution/gitEnvironment.test.ts`
- `test/unit/execution/gitAttributes.test.ts`

#### Files changed

- `src/execution/commandPolicy.ts`
- `src/execution/processRunner.ts`
- `src/execution/createWorktree.ts`
- `src/execution/cleanupWorktree.ts`
- `src/execution/executeCommand.ts`
- `test/unit/execution/commandPolicy.test.ts`
- `test/integration/command-execution/worktreeExecution.test.ts`
- `IMPLEMENTATION.md`

#### Commands run and test results

```text
npm test
  Review baseline: PASS, 18 test files, 298 tests, duration 3.83s

npm test -- test/unit/execution/commandPolicy.test.ts \
  test/unit/execution/processRunner.test.ts
  Initial adversarial suite: FAIL, 29 passed and 16 failed
  Cause: the new tests reproduced quote/escape, nested execution, Git alias,
  environment expansion, traversal, backgrounding, and timeout cleanup bypasses.

npm test -- test/unit/execution/commandPolicy.test.ts \
  test/unit/execution/processRunner.test.ts
  PASS after policy and process-group fixes: 45 tests

npm test -- test/unit/execution test/integration/command-execution
  Intermediate run: FAIL, 64 passed and 1 failed
  Cause: Git worktree creation inherited a hostile GIT_DIR value from the test
  environment; lifecycle environment isolation was then added.

npm test -- test/unit/execution test/integration/command-execution
  PASS after Git lifecycle isolation: 5 test files, 67 tests

npm test -- test/unit/execution/commandPolicy.test.ts \
  test/unit/execution/processRunner.test.ts \
  test/unit/execution/gitEnvironment.test.ts
  PASS: 3 test files, 59 tests

npm test -- test/unit/execution test/integration/command-execution
  PASS after expanded adversarial coverage: 5 test files, 76 tests,
  duration 4.61s

npm run build
npm run typecheck
npm test
  Pre-checkout-filter verification: build PASS; type check PASS; full suite
  PASS, 20 test files, 334 tests, duration 5.28s

npm run typecheck
npm test -- test/unit/execution test/integration/command-execution
  Checkout-filter implementation: type check PASS; focused suite PASS,
  6 test files and 85 tests, duration 4.63s

npm test -- test/unit/execution test/integration/command-execution
  Integration assertion run: FAIL, 85 passed and 1 failed
  Cause: the guard correctly rejected the repository, but the test expected a
  different evidence phrase. The assertion was corrected without product-code
  changes.

npm run build
npm run typecheck
npm test
npm run test:codex-integration
  Final build: PASS
  Final type check: PASS
  Final full suite: PASS, 21 test files, 344 tests, duration 5.54s
  Optional live-Codex suite: PASS, 1 test skipped by its explicit gate,
  duration 561ms; no live Codex request was made

git worktree list --porcelain
  PASS: only the active Escrow worktree is registered

Temporary-directory leak check
  PASS: no escrow-worktree-* or escrow-command-test-* entries
```

#### Review limitations

- The policy remains deliberately conservative: arbitrary shell expansion,
  nested interpreters, unknown Git operations, and checkout-filter repositories
  are blocked rather than interpreted. Repositories using Git LFS or another
  checkout filter therefore receive an inconclusive command result.
- Network restriction still combines deterministic policy with offline/proxy
  environment settings; it is not a portable operating-system firewall.
- No conflict analysis, repair mode, or later-milestone behavior was added.

### Known limitations

- Network blocking combines deterministic policy with offline/proxy environment
  settings. A portable operating-system network sandbox is not available on
  every supported macOS/Linux host, so `--allow-network` controls recognized
  network-capable command forms rather than providing a universal packet-level
  firewall.
- Command policy is intentionally conservative: dynamic shell evaluation,
  nested shell commands, multiline commands, external paths, and external
  symlinks are blocked rather than interpreted heuristically.
- Worktrees are created from committed `HEAD`; uncommitted or untracked active
  checkout changes are intentionally absent. Repositories without a valid
  `HEAD` produce an inconclusive command result.
- Retained worktrees are intentionally left registered and on disk when
  `--keep-worktree` is explicit; the report evidence contains their location.
- The CLI validation flow now produces command results, but later Markdown/HTML
  report formats and conflict analysis remain outside Milestone 9.

### Next milestone

- Milestone 10 — Scope, overrides, and conflicts remains NOT STARTED and must be
  explicitly requested before implementation.

## Milestone 10 — Scope, overrides, and conflicts

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed work

- Added pure deterministic scope resolution for every validated claim. Relative
  scopes and targets resolve from the repository root; absolute scopes remain
  supported; targets and claims outside the repository boundary are rejected.
  Each resolution records the canonical declared scope, canonical target,
  applicability, and directory-depth specificity.
- Defined applicability as ancestor-or-equal containment: root claims apply to
  every repository target, while nested claims apply only to their own subtree.
  Claims from sibling or unrelated subtrees are omitted from the effective
  result for the selected target.
- Grouped only narrowly comparable claims and selected the deepest applicable
  scope for each relationship. Broader applicable claims in that relationship
  are marked `overridden` with deterministic evidence naming the selected
  target and more-specific claim ids. The same broad claim remains effective
  when a target is outside the nested subtree.
- Added same-effective-scope conflict detection for exactly three deterministic
  relationships: differing package-manager claims, the same package script
  assigned to different explicit package managers, and Jest-versus-Vitest
  dependency/framework guidance. Equivalent package-command forms such as
  `npm test` and `npm run test` do not conflict.
- Kept advisory claims, unrelated claim types, different package scripts,
  unknown frameworks, and relationships requiring semantic judgment out of
  conflict analysis. No GPT-5.6 or Codex call participates in scope,
  applicability, override, conflict, or status decisions.
- Added a structured conflict model containing a stable id, narrow conflict
  type, effective scope, deterministic message, and every involved claim's id,
  type, source file, complete line range, declared scope, and normalized value.
  Active conflicting claims are marked failed and receive conflict evidence;
  source data is copied without modification.
- Integrated analysis after the existing deterministic validators. The check
  command now passes the discovery-selected target into extraction/validation,
  and extraction results expose conflict records and per-claim scope
  resolutions alongside effective validated claims.
- Extended the shared report model to accept conflict records. Console output
  lists each conflict and every source location; JSON serialization naturally
  round-trips the same shared data. Summary and overall status continue to be
  derived from the conflict-adjusted claim statuses. Report construction also
  verifies that every conflict source matches a report claim and deterministically
  fails those claims, preventing an inconsistent passing report with conflicts.
- Used manually constructed claims because the analyzer is pure and does not
  inspect repository contents. No unused fixture repository or new dependency
  was added.
- Added no general policy engine, AI conflict explanation, Markdown/HTML
  reporting, repair mode, or Milestone 11 behavior.

### Files created

- `src/models/conflicts.ts`
- `src/validation/conflictValidator.ts`
- `test/unit/validation/conflictValidator.test.ts`

### Files changed

- `src/models/reports.ts`
- `src/extraction/extractClaims.ts`
- `src/commands/check.ts`
- `src/reporting/consoleReporter.ts`
- `test/unit/models/claimFixtures.ts`
- `test/unit/models/reports.test.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/unit/commands/check.test.ts`
- `test/unit/reporting/consoleReporter.test.ts`
- `test/unit/reporting/jsonReporter.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Tests added

- Root package-manager guidance overridden inside a nested package without a
  conflict or failure.
- Root guidance remains effective for a target outside that nested subtree.
- Sibling package scopes are isolated for their respective targets.
- Same-file package-manager contradictions fail both active claims and preserve
  both source ranges.
- Same-scope package-script contradictions across instruction sources are
  reported when the same script names different explicit package managers.
- Equivalent npm package-script command forms do not conflict.
- Jest-versus-Vitest guidance is reported as the one initially supported
  deterministic framework conflict.
- Advisory text resembling package-manager guidance and unrelated claims do not
  conflict.
- Repository-boundary rejection covers both external targets and external claim
  scopes.
- Shared report, console, JSON, check-command, and extraction-pipeline tests
  cover conflict/source preservation and target wiring.
- Report construction rejects conflict references whose exact claim/source data
  is absent and derives failure even if a caller supplies a stale pre-conflict
  claim status.

### Commands run and test results

```text
npm test
  Baseline PASS: 21 test files, 344 tests, duration 5.54s

npm run typecheck
  PASS after the initial scope and conflict implementation

npm test -- test/unit/validation/conflictValidator.test.ts \
  test/unit/models/reports.test.ts test/unit/reporting \
  test/unit/commands/check.test.ts
  PASS: 5 test files, 42 tests, duration 438ms

npm run build
npm run typecheck
npm test
  Initial full build: PASS
  Initial full type check: PASS
  Initial full suite: PASS, 22 test files, 357 tests, duration 5.60s

npm run typecheck
npm test -- test/unit/validation/conflictValidator.test.ts \
  test/unit/extraction/extractClaims.test.ts \
  test/unit/models/reports.test.ts test/unit/reporting \
  test/unit/commands/check.test.ts
  Focused type check: PASS
  Expanded focused suite: PASS, 6 test files, 72 tests, duration 752ms

npm run build
npm run typecheck
npm test
npm run test:codex-integration
  Pre-report-invariant build: PASS
  Pre-report-invariant type check: PASS
  Pre-report-invariant normal suite: PASS, 22 test files, 358 tests,
  duration 5.59s
  Optional live-Codex suite: PASS, 1 test skipped by its explicit gate,
  duration 623ms; no live Codex request was made

npm run typecheck
npm test -- test/unit/models/reports.test.ts test/unit/reporting \
  test/unit/validation/conflictValidator.test.ts \
  test/unit/extraction/extractClaims.test.ts
  Report-invariant type check: PASS
  Report-invariant focused suite: PASS, 5 test files, 71 tests,
  duration 706ms

npm run build
npm run typecheck
npm test
npm run test:codex-integration
  Final build: PASS
  Final type check: PASS
  Final normal suite: PASS, 22 test files, 359 tests, duration 5.54s
  Optional live-Codex suite: PASS, 1 test skipped by its explicit gate,
  duration 578ms; no live Codex request was made
```

### Known limitations

- Conflict support is intentionally narrow. It does not infer arbitrary
  negation, intent, compatibility, or semantic equivalence from natural
  language.
- Framework conflict detection initially recognizes only the deterministic
  Jest/Vitest pair. Other supported dependency mappings may coexist and are not
  treated as mutually exclusive.
- Package-script conflicts require the same normalized script and different
  explicit package managers. Different scripts and claims without a safely
  identifiable manager are left unrelated.
- Scope resolution is target-specific. A report for one target does not claim
  that sibling-subtree instructions were analyzed for another target.
- Markdown/HTML conflict presentation and optional AI-written explanations
  remain deferred.

### Milestone 10 review — 2026-07-13

#### Audit findings

- Confirmed that broad claims remain applicable when the selected target is
  outside a nested override subtree. Nested claims are excluded from sibling
  targets, including similarly prefixed directory names such as `api` and
  `api-v2`.
- Confirmed that same-effective-scope contradictions fail all active involved
  claims and preserve each source file plus complete line range in the conflict
  record and reporters.
- Confirmed that advisory claims never enter deterministic comparison groups
  and therefore cannot create false conflicts.
- Confirmed that Codex is instructed to copy supplied scope metadata and that
  extraction rejects an AI-returned scope differing from the deterministic
  instruction-file directory before applicability analysis.
- Confirmed with an analyzer-to-report test that a valid root/nested override
  produces one passed claim, one overridden claim, no failed claims, and overall
  status `pass`.
- Found one pipeline defect: `validateExtractedClaims` applied target scope only
  after dispatching claims to validators. Normal discovery already supplies a
  target-specific instruction chain, but direct or future callers could pass a
  sibling claim and cause it to be validated—or a command claim to be
  executed—before the analyzer removed it. An out-of-scope advisory claim also
  remained in deferred output.

#### Fix completed

- Scope is now resolved for every extracted claim before validator dispatch.
  Only claims whose declared scope contains the selected target reach a
  deterministic validator or deferred advisory output.
- `claimScopes` now records applicability for every extracted claim, including
  excluded and advisory claims, so exclusion remains observable without running
  the claim.
- Added a mocked-validator regression test proving that a sibling command claim
  never reaches validation even when command execution is enabled and that a
  sibling advisory claim is not deferred. No command subprocess is used by this
  test.
- Added focused tests for path-component boundaries, analyzer-to-report
  overridden totals, and rejection of an AI-selected scope.
- No conflict category, semantic policy, AI decision, report format, repair
  behavior, or Milestone 11 functionality was added.

#### Files created

- `test/unit/extraction/scopeValidationPipeline.test.ts`

#### Files changed

- `src/extraction/extractClaims.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/unit/validation/conflictValidator.test.ts`
- `IMPLEMENTATION.md`

#### Commands run and test results

```text
npm test
  Review baseline: PASS, 22 test files, 359 tests, duration 5.68s

npm test -- test/unit/extraction/scopeValidationPipeline.test.ts \
  test/unit/validation/conflictValidator.test.ts \
  test/unit/models/reports.test.ts
  Initial adversarial suite: FAIL, 28 passed and 1 failed
  Cause: the new regression test proved that sibling command claim
  "web-command" reached the validator for target "packages/api".

npm run typecheck
npm test -- test/unit/extraction/scopeValidationPipeline.test.ts \
  test/unit/extraction/extractClaims.test.ts \
  test/unit/validation/conflictValidator.test.ts \
  test/unit/models/reports.test.ts
  Type check: PASS
  Intermediate focused suite: FAIL, 58 passed and 1 failed
  Cause: a historical assertion expected scope metadata only for five validated
  claims; the strengthened contract correctly returned metadata for all six
  extracted claims, including the advisory claim.

npm run typecheck
npm test -- test/unit/extraction/scopeValidationPipeline.test.ts \
  test/unit/extraction/extractClaims.test.ts \
  test/unit/validation/conflictValidator.test.ts \
  test/unit/models/reports.test.ts
  Type check: PASS
  Focused suite: PASS, 4 test files, 59 tests, duration 699ms

npm run build
npm run typecheck
npm test
npm run test:codex-integration
  Final build: PASS
  Final type check: PASS
  Final normal suite: PASS, 23 test files, 362 tests, duration 6.36s
  Optional live-Codex suite: PASS, 1 test skipped by its explicit gate,
  duration 621ms; no live Codex request was made
```

### Next milestone

- Milestone 11 — Markdown and HTML reports remains NOT STARTED and must be
  explicitly requested before implementation.

## Milestone 11 — Markdown and static HTML reports

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed work

- Added a pure Markdown renderer that accepts only `EscrowReport` and
  emits an attachment-ready report with product name, repository, target,
  generation metadata, all seven summary totals, overall status, instruction
  chain, complete claims, overrides, and conflicts.
- Markdown claims include status, type, source range, scope, original
  instruction text, normalized value, deterministic evidence, repository
  inconsistencies, optional suggestions, and command details. Command output is
  expandable through native `<details>` markup.
- Hardened Markdown boundaries with dynamically sized fenced blocks and inline
  code delimiters. Prose is Markdown/HTML escaped, while command metadata,
  stdout, and stderr inside expandable raw HTML are entity-escaped in
  `<code>/<pre>` elements so hostile closing tags cannot escape the container.
- Added a pure self-contained HTML renderer with semantic sections, accessible
  headings, inline responsive CSS, status styling, native expandable command
  output, and no JavaScript, React, server dependency, external stylesheet,
  font, image, or other asset.
- Escaped every dynamic HTML interpolation, including repository and target
  paths, instruction-chain paths, original/normalized claim text, source
  locations, evidence, inconsistencies, suggestions, commands, working
  directories, stdout/stderr, conflict messages, and conflict sources.
- Added a CSS-only claim-status filter using native radio controls. Unsupported
  selector engines fall back safely to showing every claim; report data never
  depends on filtering.
- Centralized fixed status labels, summary field order, type labels, and source
  location formatting in a small shared reporting helper used by console,
  Markdown, HTML, and cross-format tests.
- Extended console output to include the instruction chain and normalized claim
  values while preserving existing evidence, suggestion, conflict, and command
  output behavior.
- Added CLI parsing for `--json <path>`, `--markdown <path>`, and
  `--html <path>`. The check command constructs exactly one shared report,
  renders console output from it, and passes the same object to every requested
  file renderer.
- Converted applicable deferred advisory claims to deterministic advisory
  report entries with advisory evidence. They remain excluded from pass/fail
  totals by the shared report constructor.
- Connected a failing overall report to the existing check-failed exit code `1`
  only after console output and all requested files have been produced. Invalid
  input, extraction failure, and internal-error behavior remains unchanged.
- Added no hosted UI, React, server, repair mode, GitHub integration, or
  Milestone 12 functionality.

### Files created

- `src/reporting/reportFormatting.ts`
- `src/reporting/markdownReporter.ts`
- `src/reporting/htmlReporter.ts`
- `test/unit/reporting/reportFixture.ts`
- `test/unit/reporting/markdownReporter.test.ts`
- `test/unit/reporting/htmlReporter.test.ts`
- `test/unit/reporting/reportConsistency.test.ts`

### Files changed

- `src/reporting/consoleReporter.ts`
- `src/commands/check.ts`
- `src/cli.ts`
- `src/utils/errors.ts`
- `test/unit/reporting/consoleReporter.test.ts`
- `test/unit/commands/check.test.ts`
- `test/unit/cli.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Test coverage added

- Console, JSON, Markdown, and HTML overall-status and seven-total consistency
  from one rich shared report fixture.
- Standalone HTML structure, inline CSS, absence of scripts/external assets,
  CSS-only result controls, and safe entity escaping across repository content
  and multiline command streams.
- Markdown report structure, source locations, dynamic fence handling, escaped
  evidence, suggestions, expandable command output, and safe multiline
  stdout/stderr preservation.
- Empty instruction chains, empty claims, empty conflicts, and zero totals in
  both new formats.
- Failed, advisory, overridden, blocked-command, conflict, and source-range
  display.
- CLI parsing for all three report-file options, one-report command rendering,
  deterministic advisory inclusion, file totals, and check-failed exit code `1`.

### Commands run and test results

```text
npm run typecheck
  Initial renderer type check: PASS

npm run typecheck
npm test -- test/unit/reporting
  Type check: PASS
  Initial reporter suite: PASS, 5 test files, 22 tests, duration 412ms

npm test -- test/unit/commands/check.test.ts test/unit/cli.test.ts
  Existing command/CLI suite: PASS, 2 test files, 12 tests, duration 677ms

npm run typecheck
npm test -- test/unit/reporting test/unit/commands/check.test.ts \
  test/unit/cli.test.ts
  Type check: PASS
  Focused suite: PASS, 7 test files, 36 tests, duration 769ms

npm run build
npm run typecheck
npm test
npm run test:codex-integration
  First full build: PASS
  First full type check: PASS
  First full normal suite: PASS, 26 test files, 372 tests, duration 5.64s
  Optional live-Codex suite: PASS, 1 test skipped by its explicit gate,
  duration 572ms; no live Codex request was made

Shared reportFixture.ts sample generation through Vite's in-process TypeScript
loader and the final built renderers
  PASS: wrote sample-report.md and sample-report.html under
  /private/tmp/escrow-m11-samples from the same rich fixture used by
  cross-format tests

wc, sed, rg, and file inspection of generated samples
  PASS: Markdown preserved multiline streams and contained a dynamically fenced
  hostile instruction example; HTML was recognized as a standalone UTF-8 HTML
  document with inline styles, status filters, and escaped command content
  PASS: regenerated samples contained 3 failed, 1 blocked, 1 advisory, and 1
  overridden claim plus the expected conflict section
  PASS: HTML contained no unescaped script element, external stylesheet, or
  external URL; hostile Markdown command output was entity-escaped inside its
  expandable HTML boundary

npm run typecheck
npm test -- test/unit/reporting test/unit/commands/check.test.ts \
  test/unit/cli.test.ts
  Check-failed integration type check: PASS
  Focused suite: PASS, 7 test files, 37 tests, duration 775ms

npm run build
npm run typecheck
npm test
npm run test:codex-integration
  Final build: PASS
  Final type check: PASS
  Final normal suite: PASS, 26 test files, 373 tests, duration 5.90s
  Optional live-Codex suite: PASS, 1 test skipped by its explicit gate,
  duration 569ms; no live Codex request was made
```

### Known limitations

- Report output parent directories must already exist; Escrow does not
  create arbitrary directory trees for requested file paths.
- Expandable Markdown command output relies on renderers that permit standard
  `<details>` HTML, including GitHub. In renderers that disable raw HTML, the
  escaped output remains present in the Markdown source.
- CSS-only HTML filtering uses the modern `:has()` selector. Older browsers
  simply show every claim, which is the safe and complete fallback.
- Reports are local artifacts only. Hosting, PR attachment, and GitHub
  integration remain outside the MVP milestone.

### Next milestone

- Milestone 12 — Restricted repair mode was not started as part of Milestone 11
  and required a separate explicit request.

## Milestone 11A — Report generation review

**Status:** COMPLETE
**Date:** 2026-07-13

### Review result

- Audited only console, JSON, Markdown, and static HTML report generation and
  the check-command data flow that invokes those renderers.
- Confirmed `checkRepository` constructs one `EscrowReport` and passes
  that same object to every requested renderer. Each renderer accepts only the
  shared report model and remains a pure, non-mutating formatter.
- Confirmed all formats use the shared deterministic overall status, summary
  totals, status labels, and source-location formatting. The JSON renderer
  round-trips the complete source object.
- Confirmed advisory and overridden claims remain visible with their own
  statuses and totals and are not counted as passed or failed.
- Confirmed source files and single-line/ranged locations are visible, while
  multiline command stdout and stderr remain readable in console, Markdown,
  and HTML output.
- Confirmed the HTML report is one locally openable document with inline CSS,
  no JavaScript, event handlers, external URLs/assets, embedded browsing
  contexts, React, or server dependency. All repository-derived values and
  command streams remain HTML entity-escaped.
- Found no production report defect, so no production source was changed and
  no product feature was added.

### Files changed

- `test/unit/reporting/reportConsistency.test.ts`
- `test/unit/reporting/htmlReporter.test.ts`
- `IMPLEMENTATION.md`

### Test coverage added

- Cross-format assertions for exact failed, blocked, advisory, and overridden
  totals from one shared report.
- Cross-format assertions that advisory and overridden claims retain their
  correct labels and source locations.
- Renderer-purity coverage proving console, JSON, Markdown, and HTML rendering
  does not mutate the shared report object.
- Cross-format multiline command-output preservation and context-appropriate
  escaping checks.
- Additional static-HTML safety checks excluding base URLs, embedded contexts,
  plugin objects, and inline event handlers.

### Commands run and test results

```text
npm test -- test/unit/reporting
  Baseline focused suite: PASS, 5 test files, 22 tests, duration 418ms

npm test -- test/unit/reporting
  Expanded focused suite: PASS, 5 test files, 24 tests, duration 427ms

npm run build
  PASS

npm run typecheck
  PASS

npm test
  PASS, 26 test files, 375 tests, duration 6.35s

npm run test:codex-integration
  PASS, 1 test skipped by its explicit opt-in gate, duration 580ms;
  no live Codex request was made
```

### Known limitations

- Existing Milestone 11 limitations are unchanged: output parent directories
  must already exist, expandable Markdown output depends on raw-HTML support,
  and older browsers without `:has()` show all claims instead of filtering.
- Milestone 12 was not started during the report-generation review.

## Milestone 12 — Restricted repair mode

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed work

- Added `escrow fix <repository>` with `--target`, `--apply`, `--model`,
  `--execute`, `--allow-network`, `--timeout`, and `--keep-worktree`. The
  execution-related options are passed through to the existing isolated command
  validator for both before and after evaluation.
- Extracted the existing discovery/extraction/validation/report construction
  into `createRepositoryReport`. The check command still renders and exits as
  before, while repair mode reuses the identical report-building path.
- Added a strict repair response contract: Codex must return
  `{"patch":"<git unified diff>"}` matching both a JSON Schema supplied to the
  subprocess and a strict Zod schema checked after parsing. Empty, oversized,
  malformed, schema-invalid, timed-out, nonzero, and startup failures are
  rejected with the Codex failure exit code.
- Runs repair generation non-interactively with GPT-5.6 by default, preserving
  `--model` and `ESCROW_CODEX_MODEL` precedence. Codex uses a read-only
  sandbox with approval prompts, shell tools, shell snapshots, hooks, apps,
  search, MCP servers, user configuration, and repository rules disabled.
- Added a prompt that treats all supplied repository content as untrusted data,
  includes the effective instruction chain, failed claims, deterministic
  evidence, exact allowed paths, and the all-other-paths prohibition, and asks
  for the smallest truthful documentation patch without code changes.
- Creates one detached temporary repair worktree. Codex cannot write to it;
  Escrow writes the returned patch outside the checkout, runs
  `git apply --check`, and applies it only to that worktree for deterministic
  inspection and revalidation.
- Restricts changes to existing effective-chain files named exactly
  `AGENTS.md` or `AGENTS.override.md`. NUL/absolute/traversal/non-normal paths,
  source files, tests, package metadata, lockfiles, build/CI files, untracked or
  staged additions, deletions, renames, copies, mode changes, and symlinks are
  rejected before revalidation.
- Re-runs Escrow on the patched worktree using the original target and
  options. When `--execute` was supplied, documented commands are executed
  again through the existing command policy and temporary-command-worktree
  isolation.
- Compares failed claims using repository-relative source/scope, claim type,
  normalized value, and multiplicity. Any new failure is rejected, and a patch
  must reduce the total failed-claim count to qualify as a repair.
- Outputs the complete before report, verified Git diff, complete after report,
  and an explicit preview/applied message. Preview always cleans the repair
  worktree without changing active files. `--apply` rechecks that the active
  repository is clean and applies only the same verified patch; it never
  commits or pushes.
- Preserves the original typed error when cleanup succeeds and reports cleanup
  failures rather than silently leaking a repair worktree.
- Added no application-code repair, arbitrary documentation editing, commits,
  pushes, hosted integration, demo repository, or Milestone 13 behavior.

### Files created

- `schemas/repair.schema.json`
- `src/commands/fix.ts`
- `src/repair/repairPrompt.ts`
- `src/repair/generateRepair.ts`
- `src/repair/verifyRepair.ts`
- `test/unit/repair/repairPrompt.test.ts`
- `test/unit/repair/generateRepair.test.ts`
- `test/integration/repair/repairWorkflow.test.ts`
- `test/fixtures/repair/repository/AGENTS.md`
- `test/fixtures/repair/repository/pnpm-lock.yaml`
- `test/fixtures/repair/repository/package.json`
- `test/fixtures/repair/repository/src/app.ts`

### Files changed

- `src/commands/check.ts`
- `src/cli.ts`
- `src/utils/errors.ts`
- `test/unit/cli.test.ts`
- `vitest.config.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Test coverage added

- Repair prompt includes the effective chain, failed claims, evidence, exact
  allowlist, all-other-files prohibition, untrusted-data boundary, unified-diff
  requirement, minimality request, and application-code prohibition.
- Codex repair generation default/explicit models, read-only sandbox, schema
  constraint, shell/rule disabling, nonzero exit, timeout, empty output,
  malformed JSON, and schema mismatch.
- CLI parsing for preview/apply and every compatible extraction/execution flag.
- Git-backed preview with before/after reports and diff, exact active-file
  equality, clean Git status, removed temporary directory, and no leftover
  registered worktree.
- Real before-and-after execution of a harmless documented command when
  `--execute` is supplied.
- Deterministic rejection of a source-code patch, package.json patch, new failed
  instruction, and malformed unified diff, with active repository preservation
  and cleanup after rejection.
- Verified `--apply` changes only `AGENTS.md`, leaves source code untouched,
  shows applied output, and leaves the change uncommitted.
- Codex nonzero failure propagation and repair-worktree cleanup.

### Commands run and test results

```text
npm run typecheck
  Initial implementation type check: FAIL
  Cause: the fix handler's public return type omitted RepairCommandResult.
  Fixed by aligning the handler type with the orchestration result.

npm test -- test/unit/repair test/unit/cli.test.ts \
  test/unit/commands/check.test.ts
  Initial focused suite: FAIL, 1 of 24 tests
  Cause: one prompt assertion did not account for intentional line wrapping.
  Fixed with a whitespace-aware boundary assertion.

npm test -- test/integration/repair/repairWorkflow.test.ts
  Initial integration selection: FAIL, no test files found
  Cause: the normal Vitest include list did not yet include repair integration
  tests. Added the narrow repair integration directory.

npm test -- test/integration/repair/repairWorkflow.test.ts
  First Git-backed suite: PASS, 1 file, 7 tests, duration 3.09s

npm test -- test/integration/repair/repairWorkflow.test.ts
  Command-rerun expansion: FAIL, 4 of 8 tests
  Cause: the mocked unified diff lacked context after the fixture gained a
  documented command line. Added the unchanged instruction line as patch
  context; no production code change was needed.

npm run typecheck
npm test -- test/unit/repair test/unit/cli.test.ts \
  test/unit/commands/check.test.ts \
  test/integration/repair/repairWorkflow.test.ts
  Type check: PASS
  Focused suite: PASS, 5 files, 32 tests, duration 4.02s

npm run build
  PASS

npm run typecheck
  PASS

npm test
  PASS, 29 test files, 392 tests, duration 6.19s

npm test -- test/integration/repair/repairWorkflow.test.ts -t preview
  Preview demonstration: PASS, 1 test passed and 7 skipped by filter,
  duration 1.12s
  The test verified byte-identical active AGENTS.md content, clean active Git
  status, a removed temporary worktree directory, one remaining registered
  active worktree, a failing before report, verified diff, improved after
  report, and explicit preview output.

npm run test:codex-integration
  PASS, 1 test skipped by its explicit opt-in gate, duration 578ms;
  no live Codex request was made

node dist/index.js fix --help
  PASS; displayed repository, target, model, apply, execute, network, timeout,
  and command-worktree retention options

find /private/tmp /private/var/folders/5f/fsdf_7l96y58k9vj77yty4b00000gp/T \
  -maxdepth 1 -type d -name 'escrow-worktree-*' -print
  PASS; no unexpected temporary Escrow worktree directory remained
```

### Known limitations

- Repair mode requires a clean active repository. This prevents verification
  against `HEAD` from diverging from dirty package, lockfile, source, or
  instruction evidence and prevents overwriting user changes during `--apply`.
- Repairs update only existing files in the effective instruction chain. They
  do not create, delete, rename, or copy instruction files.
- `--keep-worktree` retains only command-execution worktrees, matching its
  existing meaning. The repair worktree itself is always removed because the
  verified diff and reports are already shown.
- Repair output is console-only in this milestone. The pre-existing check
  command remains responsible for JSON, Markdown, and HTML report files.
- The normal test suite uses mocked Codex subprocesses. A live Codex repair is
  not required in CI.

### Next milestone at the time of Milestone 12

- Milestone 13 was not started during Milestone 12. Its completed work is
  recorded in the Milestone 13 section below.

## Milestone 12A — Repair-mode security and correctness review

**Status:** COMPLETE
**Date:** 2026-07-13

### Audit findings and fix

- Audited only repair prompt generation, temporary-worktree orchestration,
  patch inspection/application, before-and-after revalidation, active-checkout
  application, and cleanup.
- Found one repair-mode defect: a Git binary patch targeting an otherwise
  allowed regular `AGENTS.md` file was not explicitly forbidden. A safe test
  demonstrated that a binary delta could introduce NUL content, survive the
  path/file-type checks, and appear to resolve the original failed claim.
- Added deterministic pre-application rejection for NUL-containing patch text,
  `GIT binary patch`, and standard `Binary files ... differ` markers.
- Added post-application defense in depth for allowed instruction files: every
  result must remain a regular, non-symlink, NUL-free, strictly valid UTF-8 text
  file before Escrow revalidation can begin.
- Updated the Codex repair prompt to explicitly forbid binary patches. This is
  advisory defense only; the verdict remains entirely deterministic.
- Added no new repair capability, product feature, dependency, or Milestone 13
  behavior.

### Security and correctness evidence

- Preview: the integration fixture verifies byte-identical active instruction
  content, clean Git status, unchanged `HEAD`, removed temporary directory, and
  exactly one remaining registered worktree.
- Explicit apply: preview leaves no active change; only `--apply` changes the
  active instruction file. The apply test verifies source content is unchanged,
  Git status contains only `AGENTS.md`, and `HEAD` remains unchanged, proving no
  commit occurred.
- Exact allowlist: existing source and package.json rejection tests remain, and
  new tests reject a newly created source file, deleted source file, and rename
  from an allowed instruction file to a forbidden path.
- Symlinks: a safe patch that converts `AGENTS.md` into a symlink targeting a
  nonexistent path outside the repository is rejected as a non-regular or
  structural change without following or accessing the target.
- Binary data: a real `git diff --binary` fixture patch against `AGENTS.md` now
  fails before patch application. Resulting instruction files are also checked
  for NUL bytes and strict UTF-8.
- Revalidation: preview and new-failure tests assert exactly two extraction
  calls, covering the active before report and repaired-worktree after report.
- New failures: the existing npm-to-yarn repair remains rejected after
  deterministic revalidation identifies the new failed claim.
- Commit/push: production repair/worktree source contains no Git commit or push
  invocation. Both preview and apply integration tests verify unchanged `HEAD`;
  the verified apply remains an uncommitted working-tree modification.
- Cleanup: success, apply, Codex failure, malformed patch, forbidden file,
  symlink, rename, creation, deletion, binary, and new-failure paths all leave
  only the active registered worktree. Focused tests also verify removal of the
  captured temporary container directory.

### Files changed

- `src/repair/verifyRepair.ts`
- `src/repair/repairPrompt.ts`
- `test/unit/repair/repairPrompt.test.ts`
- `test/integration/repair/repairWorkflow.test.ts`
- `IMPLEMENTATION.md`

### Test coverage added

- External-target symlink conversion on an allowed instruction path.
- Rename from an allowed instruction path to a forbidden path.
- Newly created forbidden source file.
- Deleted tracked source file.
- Real Git binary delta against an allowed instruction file.
- Strict prompt prohibition for binary patches.
- Unchanged `HEAD` in both preview and verified apply modes.
- Explicit before/after extraction-call counts proving revalidation.
- Clean active Git status and worktree cleanup across the new rejection cases.

### Commands run and test results

```text
npm test -- test/unit/repair test/integration/repair/repairWorkflow.test.ts
  Baseline repair suite: PASS, 3 test files, 16 tests, duration 3.91s

npm test -- test/unit/repair/repairPrompt.test.ts \
  test/integration/repair/repairWorkflow.test.ts
  Adversarial pre-fix run: FAIL, 2 of 14 tests
  Confirmed defects: the prompt omitted an explicit binary prohibition, and a
  real Git binary patch was accepted and produced NUL-containing AGENTS.md
  content that appeared to resolve the failed claim.

npm run typecheck
npm test -- test/unit/repair test/integration/repair/repairWorkflow.test.ts
  Type check after fix: PASS
  Focused repair suite after fix: PASS, 3 test files, 21 tests,
  duration 5.86s

npm run build
  PASS

npm run typecheck
  PASS

npm test
  PASS, 29 test files, 397 tests, duration 6.84s

npm run test:codex-integration
  PASS, 1 test skipped by its explicit opt-in gate, duration 626ms;
  no live Codex request was made

rg inspection of repair/worktree production Git operations
  PASS; no commit or push invocation exists

find /private/tmp /private/var/folders/5f/fsdf_7l96y58k9vj77yty4b00000gp/T \
  -maxdepth 1 -type d -name 'escrow-worktree-*' -print
  PASS; no unexpected temporary Escrow worktree directory remained
```

### Known limitations

- Milestone 12 limitations are unchanged: the active repository must be clean,
  repairs update only existing effective-chain instruction files, repair
  worktrees are always removed, output is console-only, and normal CI uses
  mocked Codex subprocesses.
- Milestone 13 was outside this review and is documented separately below.

## Milestone 13 — Demo repository and final polish

**Status:** COMPLETE
**Date:** 2026-07-13

### Completed

- Added `demo/sample-monorepo`, a small pnpm workspace whose root instruction
  file intentionally declares npm, references deleted
  `docs/DELETED_SETUP.md`, names the missing `pnpm test` script, requires the
  absent Jest dependency while Vitest is installed, and documents one harmless
  passing Node health-check command.
- Added `packages/api/AGENTS.override.md` as a valid nested pnpm override. The
  live nested-target report marks only the broader npm claim as overridden and
  passes the nested pnpm claim; unrelated broad failures remain effective.
- Added `demo/dangerous-command-fixture` with `git push origin main` isolated
  from the main sample. The live `--execute` report classified it as
  `git_destructive`, returned `pass_with_warnings`, and never started the
  documented command.
- Added checked-in console, JSON, Markdown, and self-contained static HTML
  samples generated from one live broken-demo report. Machine-specific
  temporary paths were replaced with stable demo paths, and an integration test
  proves all four files round-trip through their production reporters with the
  same totals.
- Replaced the placeholder README with installation, Codex authentication and
  model prerequisites, CLI usage, report and repair examples, exit codes,
  supported platforms and claim types, safety model, known limitations,
  Codex/GPT-5.6 boundaries, development commands, test commands, and demo
  navigation. Current Codex CLI documentation informed the authentication,
  non-interactive, and model-override guidance.
- Added the MIT `LICENSE`, `docs/architecture.md`, and a reproducible
  `docs/demo-script.md`. The demo script works from committed temporary copies,
  keeps the project checkout unchanged, supports
  `ESCROW_DEMO_MODEL`, and defaults to the available GPT-5.6 Sol variant.
- Added four focused demo integration tests for fixture truth, intentional
  failures, nested override content, dangerous-command blocking, report-format
  consistency, documentation coverage, and the license. Normal CI remains
  fully mocked and never requires Codex.
- Added no new dependency, report type, validator category, hosted component,
  GitHub integration, or other product feature.

### Final-polish defects found by the live acceptance run

- The strict Codex response format rejected extraction discriminators that had
  a JSON Schema `const` without an explicit string `type`. Added `type:
  "string"` to all nine schema variants and a regression assertion.
- The response-format implementation does not permit `uniqueItems`. Removed
  that output-schema keyword while retaining duplicate rejection in the
  existing Zod validation boundary, and extended the schema regression test.
- Codex could emit a dependency `normalizedValue` as a sentence, causing the
  deliberately narrow deterministic mapping to return inconclusive. Tightened
  the extraction prompt to require only the concise framework/tool name and
  added a prompt assertion; Codex still supplies claims only and never verdicts.
- A repair could repeat a stale framework name in replacement prose, causing it
  to be extracted as a new requirement. Tightened the existing repair prompt to
  state only a proven replacement or remove the stale line when no replacement
  is evidenced. New-failure rejection remains deterministic and unchanged.

### Files created

- `LICENSE`
- `docs/architecture.md`
- `docs/demo-script.md`
- `demo/sample-monorepo/AGENTS.md`
- `demo/sample-monorepo/package.json`
- `demo/sample-monorepo/pnpm-lock.yaml`
- `demo/sample-monorepo/pnpm-workspace.yaml`
- `demo/sample-monorepo/docs/architecture.md`
- `demo/sample-monorepo/scripts/healthcheck.mjs`
- `demo/sample-monorepo/scripts/unit-test.mjs`
- `demo/sample-monorepo/packages/api/AGENTS.override.md`
- `demo/sample-monorepo/packages/api/package.json`
- `demo/sample-monorepo/packages/api/src/index.mjs`
- `demo/dangerous-command-fixture/AGENTS.md`
- `demo/dangerous-command-fixture/README.md`
- `demo/sample-reports/broken-console.txt`
- `demo/sample-reports/broken-report.json`
- `demo/sample-reports/broken-report.md`
- `demo/sample-reports/broken-report.html`
- `test/integration/demo/demoAssets.test.ts`

### Files modified

- `README.md`
- `schemas/claims.schema.json`
- `src/extraction/extractionPrompt.ts`
- `src/repair/repairPrompt.ts`
- `test/unit/extraction/extractionPrompt.test.ts`
- `test/unit/models/claimSchema.test.ts`
- `test/unit/repair/repairPrompt.test.ts`
- `vitest.config.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Live demo and repair evidence

```text
Broken root check with --execute and JSON/Markdown/HTML output
  Model: gpt-5.6-luna
  Expected exit: 1
  Result: FAIL; 1 passed, 4 failed; 20.35s
  Failures: npm vs pnpm, deleted path, missing test script, absent Jest
  Passing command: node scripts/healthcheck.mjs, isolated worktree, 103ms

Nested packages/api target
  Model: gpt-5.6-luna
  Expected exit: 1 because unrelated stale root guidance remains
  Result: 1 nested pnpm claim passed; root npm claim overridden; 21.53s

Separate dangerous-command fixture with --execute
  Model: gpt-5.6-luna
  Exit: 0
  Result: PASS WITH WARNINGS; git push blocked as git_destructive; 9.94s

Repair preview
  Model: gpt-5.6-sol
  Exit: 0
  Result: verified instruction-only diff, zero after-report failures,
  active demo copy unchanged; 41.17s

Verified repair with --apply
  Model: gpt-5.6-sol
  Exit: 0
  Result: only AGENTS.md changed; npm became pnpm, pnpm test became
  pnpm test:unit, and the two unsupported stale instructions were removed;
  after report had 2 passed, 0 failed, 1 unexecuted command; 51.78s

Final check with --execute
  Model: gpt-5.6-luna
  Exit: 0
  Result: PASS; 3 passed, 0 failed/warning/blocked/inconclusive; 13.80s

Measured successful demo sequence
  Total: 158.57s, below the 180s acceptance limit

Temporary worktree verification
  git worktree list: only the active temporary demo checkout
  find escrow-worktree-*: no unexpected directories
```

The initial generic `gpt-5.6` attempt was rejected by the authenticated ChatGPT
account because that generic model id was unavailable. This exercised the
documented model override; the available GPT-5.6 Luna and Sol variants completed
the live checks. Before the prompt refinements, one preview stopped at the exact
`originalText` integrity guard and one proposed repair was rejected for a new
Jest failure. Both left the active repository unchanged and demonstrated the
intended fail-closed boundaries.

### Build, test, and clean-checkout results

```text
npm run typecheck && npx vitest run test/unit/models/claimSchema.test.ts
  PASS; strict type check and 1 file / 28 tests

npx vitest run test/unit/extraction/extractionPrompt.test.ts \
  test/unit/repair/repairPrompt.test.ts
  PASS; 2 files / 4 tests

npx vitest run test/integration/demo/demoAssets.test.ts
  First run: 3 passed, 1 failed because README used the equivalent heading
  "What it checks" instead of explicitly saying "Supported claim types"
  Final run after documentation correction: PASS; 1 file / 4 tests

Dependency-free temporary checkout
  npm ci: PASS; 50 packages installed in 1s
  npm run build: PASS
  node dist/index.js --help: PASS
  The first harness copy attempt used relative source paths after changing to
  the empty destination directory and failed before installation; rerunning
  with absolute source paths validated the documented commands successfully.

npm run build
  PASS

npm run typecheck
  PASS

npm test
  PASS; 30 test files, 402 tests, final duration 6.44s

npm run test:codex-integration
  PASS; 1 file / 1 test skipped by its explicit opt-in gate, duration 571ms;
  no additional live request was made

npm ls --depth=0
  PASS; only Commander and Zod runtime dependencies plus TypeScript, Vitest,
  and Node type development dependencies; no dependency was added
```

### Definition of Done audit

1. Root/nested discovery is covered by the existing suites and the live nested
   demo.
2. Live Codex produced schema-valid, Zod-validated candidate claims with source
   locations after the strict-schema compatibility fix.
3. Existing deterministic validators cover all six supported claim types; the
   broken and repaired live reports exercised five verifiable types while
   advisory behavior remains covered by tests.
4. The nested pnpm override is not reported as a conflict.
5. The health command ran only in a temporary Git worktree; the active checkout
   remained unchanged.
6. The separate `git push` instruction was blocked before execution.
7. Console, JSON, Markdown, and HTML samples use one report object and agree on
   totals in the demo integration test.
8. Preview changed nothing; verified apply changed only `AGENTS.md`.
9. Both preview and apply reran Escrow, and the final live check passed.
10. All 402 normal tests pass.
11. The measured successful demo sequence completed in 158.57 seconds.
12. `npm ci`, build, and CLI help passed in a dependency-free temporary copy.

All twelve Definition of Done items in `SPEC.md` are satisfied.

### Known limitations

- The selected GPT-5.6 model must be available to the authenticated Codex
  account. The generic id was unavailable in this environment, so the demo uses
  an overridable GPT-5.6 Sol default.
- Live natural-language extraction can vary, while exact source checks, Zod,
  deterministic validation, and new-failure rejection remain fail-closed.
- The documented MVP limitations remain: macOS/Linux local Git repositories,
  JavaScript/TypeScript package evidence, fixed dependency mappings, no global
  instruction discovery, and policy-based network restriction where practical.

## Final implementation audit — 2026-07-13

**Status:** COMPLETE WITH DOCUMENTED LIMITATIONS AND SUBMISSION RISKS

### Completed requirements and audit findings

1. Product scope remains limited to the local CLI in `SPEC.md`; the audit added
   no product features or dependencies.
2. All twelve Definition of Done checks remain satisfied. The normal automated
   suite covers discovery, schemas, validators, command isolation and cleanup,
   scopes, reports, repair restrictions, and demo assets; the live demo covered
   extraction, report generation, preview, apply, and final recheck.
3. CLI help, version, required arguments, repository/target errors, output
   options, execution flags, repair flags, and the documented exit-code mapping
   were inspected and exercised. Usage/input errors return 2, validation
   failures return 1, extraction failures return 3, command-policy/runtime
   failures return 4, repair failures return 5, and successful or warning-only
   reports return 0.
4. Git-root resolution, repository-boundary checks, root-to-target discovery,
   same-directory override precedence, empty-file fallback, and non-mutating
   discovery are deterministic and covered by tests.
5. TypeScript claim/report types and Zod schemas agree, require source ranges,
   reject unsupported or verdict-bearing extraction data, and preserve report
   serialization. Advisory and overridden results do not affect pass/fail
   totals.
6. Path, package-manager, package-script, dependency/framework, command, scope,
   override, and narrow conflict decisions remain deterministic; AI does not
   assign verdicts or applicability.
7. Extraction uses a temporary non-repository directory, read-only Codex
   sandbox, schema-constrained output, Zod validation, disabled shell tools and
   hooks, a timeout, and a mocked normal test suite.
8. Command checks require `--execute`, classify the documented command before
   running it, block recognized unsafe forms, use detached temporary Git
   worktrees, capture evidence, enforce timeouts, and clean up in `finally`.
9. Scope tests confirm nested overrides stay in their subtree, siblings remain
   independent, same-scope deterministic contradictions retain both locations,
   and advisory text does not become a conflict.
10. Console, JSON, Markdown, and static escaped HTML render from the same report
    model. The audit generated all three file outputs alongside console output
    and performed an exact renderer round-trip comparison against the JSON
    report object.
11. Repair preview/apply restrictions reject non-instruction, new, deleted,
    renamed, binary, symlink, mode, and dirty-checkout changes; verified repairs
    are rechecked before optional application and never commit or push.
12. README setup, model, platform, claim, safety, development, testing, demo,
    and limitation text was reconciled with the implementation.
13. A dependency-free temporary source copy completed `npm ci`, build, help,
    and version checks. `npm pack --dry-run` confirmed the package contains the
    executable build, schemas, README, and license without bundled dependencies.
14. The broken demo again produced 1 pass and 4 deterministic failures, the
    nested target preserved its valid pnpm override, the dangerous fixture
    blocked `git push`, preview left the active checkout clean, apply changed
    only `AGENTS.md`, and the final executed recheck passed 3 of 3 claims.
15. The previously measured complete successful demo sequence remains 158.57
    seconds, below the three-minute acceptance limit; the final live recheck in
    this audit completed in 11.82 seconds.

### Defect fixed

- Repair generation previously launched Codex with the temporary Git repair
  worktree as its process directory. Although Codex was read-only, that allowed
  repository-local `.codex/config.toml` discovery to influence the invocation.
- `src/repair/generateRepair.ts` now creates a separate temporary non-repository
  Codex process directory, supplies `--skip-git-repo-check`, points `--cd` and
  subprocess `cwd` at that directory, and removes it in `finally`. Codex still
  receives only the prompt and writes no repository files; the returned patch
  remains the sole input applied to the restricted Git repair worktree.
- `test/unit/repair/generateRepair.test.ts` now verifies the isolated directory,
  arguments, and cleanup. The focused repair suites passed 20 of 20 tests.

### Files changed by the final audit

- `src/repair/generateRepair.ts`
- `test/unit/repair/generateRepair.test.ts`
- `README.md`
- `IMPLEMENTATION.md`

`PLAN.md` was reviewed and not changed because all milestone statuses and
acceptance criteria were already accurate.

### Exact commands run and results

```text
npm run typecheck
  PASS

npx vitest run test/unit/repair/generateRepair.test.ts \
  test/integration/repair/repairWorkflow.test.ts
  PASS; 2 files, 20 tests, 5.72s

npm run build
  PASS

npx vitest run test/unit
  PASS; 27 files, 375 tests, 1.79s

npx vitest run test/integration/command-execution \
  test/integration/repair test/integration/demo
  PASS; 3 files, 27 tests, 5.97s

npm run test:codex-integration
  PASS; 1 file and 1 test skipped by the explicit opt-in gate, 418ms

npm ls --depth=0
  PASS; Commander 14.0.3 and Zod 4.4.3 are the only runtime dependencies;
  TypeScript 5.9.3, Vitest 4.1.10, and @types/node 24.13.3 are development-only

npm pack --dry-run --json --cache \
  /private/tmp/escrow-final-audit-npm-cache
  PASS; 79,787-byte package, 378,853 bytes unpacked, 169 entries, executable
  dist/index.js, no bundled dependencies

npm ci --prefix /private/tmp/escrow-final-audit-clean.bu3fut \
  --cache /private/tmp/escrow-final-audit-clean-cache
npm run build --prefix /private/tmp/escrow-final-audit-clean.bu3fut
node /private/tmp/escrow-final-audit-clean.bu3fut/dist/index.js --help
node /private/tmp/escrow-final-audit-clean.bu3fut/dist/index.js --version
  PASS; 50 packages installed, 51 audited, 0 vulnerabilities; build/help
  succeeded; version 0.1.0

node dist/index.js --help
  PASS; exit 0
node dist/index.js check /missing/repository
  PASS; expected usage/input exit 2
node dist/index.js check <repository> --target <outside-target>
  PASS; expected usage/input exit 2
node dist/index.js check . --verbose
node dist/index.js check . --include-global
  PASS as discrepancy probes; each returns exit 2 for an unknown option

node dist/index.js check <demo> --execute --model gpt-5.6-sol \
  --json <audit-report.json> --markdown <audit-report.md> \
  --html <audit-report.html>
  PASS; expected validation exit 1; 1 passed, 4 failed; isolated health command
  passed; 17.40s; all report files generated

JSON.parse(audit-report.json) followed by renderJsonReport,
renderMarkdownReport, and renderHtmlReport comparisons
  PASS; all generated files exactly matched renderers using the JSON report
  object; overall fail and totals 1 passed / 4 failed agreed

node dist/index.js check <demo> --target packages/api --model gpt-5.6-sol
  PASS; expected validation exit 1; 1 passed, 3 failed, 1 inconclusive,
  1 overridden; nested pnpm override passed; 18.52s

node dist/index.js check <dangerous-fixture> --execute --model gpt-5.6-sol
  PASS; exit 0 with pass_with_warnings; git push classified git_destructive,
  blocked, and never executed; 10.52s

node dist/index.js fix <demo> --model gpt-5.6-sol
  PASS; exit 0; preview changed no active files; before 4 failed plus
  1 unexecuted command, after 2 passed plus 1 unexecuted command; 40.20s

node dist/index.js fix <demo> --apply --model gpt-5.6-sol
  PASS; verified patch applied; `git diff --name-only` returned only AGENTS.md

node dist/index.js check <repaired-demo> --execute --model gpt-5.6-sol
  PASS; exit 0; 3 passed, no failed/warning/blocked/inconclusive results;
  isolated health command passed; 11.82s

npm run build && npm run typecheck && npm test && \
  npm run test:codex-integration
  FINAL PASS; build and strict type check succeeded; 30 files, 402 tests,
  402 passed, 5.12s; optional live suite 1 file / 1 test skipped, 417ms

git worktree list --porcelain
find /private/tmp -maxdepth 2 \
  (escrow-worktree-* | escrow-repair-* |
   escrow-extraction-*)
  PASS; only the active project worktree remained; no unexpected temporary
  Escrow worktrees or process directories remained
```

The first clean-copy attempt accidentally invoked `npm ci` in the project
instead of using `--prefix`; its restricted empty cache caused npm's exit
handler error after removing `node_modules`. No source file changed. The project
dependencies were immediately restored with `npm ci` (50 packages, 51 audited,
0 vulnerabilities), and the correctly prefixed clean-copy check above passed.
The first final live recheck was also denied by the managed environment's
read-only Codex state database; the authorized rerun passed without changing
application behavior.

### Remaining known limitations

- Global instruction discovery and the `--include-global` flag named in
  `SPEC.md` are not implemented. PLAN milestone acceptance required globals to
  be excluded by default and never scheduled global discovery, so implementing
  it during this audit would have expanded scope.
- The `--verbose` flag named in `SPEC.md` is not implemented. Errors remain
  actionable, but the CLI rejects the flag with usage exit 2.
- Network denial is policy- and environment-based rather than a portable
  packet-level sandbox. Likewise, policy evaluates the documented command; an
  otherwise allowed repository script is not contained by a portable OS-level
  filesystem sandbox against unsafe transitive behavior.
- Live extraction and repair require an authenticated Codex installation and an
  available selected GPT-5.6 model. Natural-language output can vary, while
  strict schemas, exact source checks, deterministic verdicts, restricted patch
  validation, and new-failure rejection remain fail-closed.
- Windows, non-Git inputs, non-JavaScript package ecosystems, arbitrary semantic
  dependency mappings, general policy conflicts, hosted output, and automatic
  commits/pushes remain intentionally outside the MVP.

### Submission risks

- At the time of this audit, the workspace initially appeared to have an
  unborn `main` branch with untracked project files. Repository state was later
  updated outside Escrow: clean-machine onboarding verified tracked HEAD
  `3b7b25323e103dea0dd4e67a5ed73635380d97d1`, aligned local
  `main...origin/main`, and a successful local clone. Remote host availability
  was not required or independently tested.
- The two documented-but-unimplemented flags above are specification
  discrepancies even though they were outside PLAN milestone acceptance.
- Live demo success depends on Codex authentication/model availability and may
  vary in latency. The deterministic mocked suite remains clean-machine safe.
- Command isolation protects the active checkout with a temporary worktree but
  is not a universal host sandbox for transitive behavior of allowed scripts.

## Clean-machine onboarding verification — 2026-07-13

**Status:** COMPLETE

### Scope and method

- Followed `README.md` and the linked `docs/demo-script.md` from two separate
  dependency-free temporary source copies. Each copy started without
  `node_modules` or `dist`.
- Used only documented runtime prerequisites for the onboarding flow: Node.js,
  npm, Git, the shell utilities used by the documented demo setup, and an
  installed/authenticated Codex CLI. Audit-only inspection commands did not
  contribute to product success.
- Used direct `node dist/index.js` execution because README explicitly documents
  it as the alternative to the optional global `npm link` step. No global npm
  package or project dependency was installed outside the temporary copies.
- Verified the current official Codex manual after the first run. It confirms
  `codex login`, `codex login status`, API-key login through stdin, and
  non-interactive `codex exec`, so the README prerequisite guidance required no
  correction.

### Environment

```text
Node.js: v20.19.5
npm: 10.8.2
Git: 2.47.1
Codex CLI: 0.144.3
Codex authentication: Logged in using ChatGPT
Platform: macOS
Live demo model: gpt-5.6-sol
```

### Baseline clean-copy run

Temporary source copy:
`/private/tmp/escrow-onboarding-baseline.UOP69c`

```text
npm ci
  PASS; 50 packages installed in 1s

npm run build
  PASS

node dist/index.js --help
node dist/index.js --version
  PASS; help rendered; version 0.1.0

npm run typecheck
  PASS

npm test
  PASS; 30 files, 402 tests, 402 passed, 4.49s

npm run build
  PASS
```

The linked demo preparation commands created clean committed copies of the
sample and dangerous-command repositories and an existing report directory.
The subsequent live flow produced:

```text
node dist/index.js check <sample> --execute --model gpt-5.6-sol \
  --json <broken-report.json> --markdown <broken-report.md> \
  --html <broken-report.html>
  EXPECTED EXIT 1; 1 passed, 4 failed; isolated health command passed;
  JSON, Markdown, and static HTML files created

node dist/index.js check <sample> --target packages/api \
  --model gpt-5.6-sol
  EXPECTED EXIT 1; nested pnpm instruction passed; root npm instruction was
  overridden only for the nested target; 3 unrelated failures remained

node dist/index.js check <dangerous-fixture> --execute \
  --model gpt-5.6-sol
  PASS; exit 0 with pass_with_warnings; git push blocked and never executed

node dist/index.js fix <sample> --model gpt-5.6-sol
  PASS; exit 0; verified minimal AGENTS.md-only diff; repaired worktree had
  2 passed, 0 failed, and 1 unexecuted command; preview left active checkout
  clean
```

After preview, both fixture repositories had clean `git status`, each
`git worktree list` contained only its active checkout, and no unexpected
`escrow-worktree-*`, `escrow-repair-*`, or
`escrow-extraction-*` directory remained.

### Repeated final clean-copy run

Temporary source copy:
`/private/tmp/escrow-onboarding-final.jK81eA`

The second copy again began without `node_modules` or `dist` and repeated the
required judge/developer flow:

```text
npm ci
  PASS; 50 packages installed in 858ms

npm run build
  PASS

npm run typecheck
  PASS

npm test
  PASS; 30 files, 402 tests, 402 passed, 4.39s

node dist/index.js --help
node dist/index.js --version
  PASS; help rendered; version 0.1.0

node dist/index.js check <sample> --execute --model gpt-5.6-sol \
  --json <onboarding.json> --markdown <onboarding.md> \
  --html <onboarding.html>
  EXPECTED EXIT 1; 1 passed, 4 failed; safe command passed in an isolated
  worktree; all three report files were valid and non-empty

node dist/index.js fix <sample> --model gpt-5.6-sol
  PASS; exit 0; same minimal verified instruction diff; after report had
  2 passed, 0 failed, 1 inconclusive; active fixture remained clean

JSON.parse(<onboarding.json>)
  PASS; overallStatus fail; exact totals 1 passed / 4 failed

git status --short
git worktree list --porcelain
find /private/tmp -maxdepth 2 <Escrow temporary-directory patterns>
  PASS; active fixture unchanged; only its active worktree remained; no
  unexpected Escrow process or worktree directory remained
```

### Undocumented assumptions and missing steps

- No onboarding command or prerequisite was missing from README. Installation,
  building, tests, direct execution, optional linking, authentication, fixture
  commits, report-directory creation, expected failing exit code, repair
  cleanliness, model override, and limitations are all documented.
- The first two passes used complete dependency-free source copies because the
  preceding audit had recorded an unborn/untracked workspace. A final state
  check found that tracked repository history was now present, so a third pass
  used a true local clone. No Escrow command committed, pushed, or
  otherwise changed repository history.
- `npm link` is explicitly optional. The audit selected the documented direct
  `node dist/index.js` route, avoiding an unnecessary global mutation.
- Live claim extraction and repair require Codex network/service access and an
  available selected model. The demo's `gpt-5.6-sol` override is documented;
  model latency and entitlement remain external assumptions.
- The intentionally broken sample returns exit 1. Shell automation must allow
  that expected result before continuing; the demo text states the expected
  exit code immediately after the command.
- Report parent directories must exist. README lists this limitation, and the
  demo preparation creates the directory before report generation.
- The managed audit harness required permission for Codex's own state/network
  access. That approval is environment-specific and is not an Escrow
  installation step.

### Files changed

- `IMPLEMENTATION.md`

No README, package, dependency, source, test, or product change was necessary.

Final project verification after this log update:

```text
npm run build && npm run typecheck && npm test
  PASS; build and strict type check succeeded; 30 files, 402 tests,
  402 passed, 4.60s

rm -rf <the four exact onboarding temporary directories>
test ! -e <each onboarding temporary directory>
find /private/tmp -maxdepth 2 <Escrow temporary-directory patterns>
  PASS; both source copies and both demo directories were removed; no
  unexpected Escrow temporary worktree or process directory remained
```

### True clean-clone confirmation

After repository history became available, the flow was repeated from an
actual clone rather than a source copy:

```text
git clone --no-local <local-escrow-checkout> \
  /private/tmp/escrow-onboarding-clone.h3yW9E/Escrow
  PASS; cloned HEAD 3b7b25323e103dea0dd4e67a5ed73635380d97d1;
  clean status; no node_modules or dist

npm ci
  PASS; 50 packages installed in 854ms

npm run build
npm run typecheck
npm test
  PASS; build and strict type check succeeded; 30 files, 402 tests,
  402 passed, 4.42s

node dist/index.js --help
node dist/index.js --version
  PASS; help rendered; version 0.1.0

node dist/index.js check <cloned-demo> --execute --model gpt-5.6-sol \
  --json <judge.json> --markdown <judge.md> --html <judge.html>
  EXPECTED EXIT 1; 1 passed, 4 failed; safe health command passed in an
  isolated worktree; JSON, Markdown, and HTML reports created

node dist/index.js fix <cloned-demo> --model gpt-5.6-sol
  PASS; exit 0; verified minimal AGENTS.md-only preview; after report had
  2 passed, 0 failed, 1 inconclusive; active fixture remained clean

git status --short
git worktree list --porcelain
find /private/tmp -maxdepth 2 <Escrow temporary-directory patterns>
  PASS; cloned project and demo fixture were clean; only the fixture's active
  worktree remained; no unexpected Escrow temporary directory remained

rm -rf <exact clean-clone and cloned-demo temporary directories>
test ! -e <each clean-clone temporary directory>
  PASS; clone and demo directories removed

npm run build && npm run typecheck && npm test
  FINAL PASS in the project workspace; build and strict type check succeeded;
  30 files, 402 tests, 402 passed, 4.50s; only IMPLEMENTATION.md is modified;
  the project has one registered worktree
```

## Milestone 14 — Local Web Interface

**Status:** COMPLETE
**Date:** 2026-07-14

### Completed

- Added `escrow ui <repository>` with `--target`, `--port`, `--model`,
  `--no-open`, `--execute`, `--allow-network`, and `--timeout` parsing.
- Added a Node built-in HTTP server that binds only to `127.0.0.1`, asks the OS
  for an available port by default, prints the local URL, opens the system
  browser by default on macOS/Linux, and closes cleanly on SIGINT or SIGTERM.
- Added a responsive, dependency-free static browser application with the
  tagline, read-only repository, target/model/execution controls, truthful
  stage labels without percentages, seven summary totals, effective
  instruction chain, expandable claim/evidence cards, required filters,
  repair preview/apply controls, and JSON/Markdown/HTML downloads.
- Kept `createRepositoryReport`, `fixRepository`, the report renderers,
  `applyVerifiedPatch`, command policy, and temporary-worktree code as the
  shared source of truth. The web server does not invoke the CLI or implement
  any validator, command policy, report total, or repair policy independently.
- Centralized the product version in `src/version.ts` for CLI, report, and web
  config consistency.
- Added `GET /api/config`, `POST /api/check`, `POST /api/fix/preview`,
  `POST /api/fix/apply`, and `GET /api/report` for JSON, Markdown, and HTML.
  The most recent report and one verified repair preview exist only in memory.
- Restricted operation requests with strict Zod schemas. Browser requests
  cannot override the supplied repository or submit commands; target paths
  still pass through canonical Git-root boundary validation. POST requests
  require JSON and are limited to 16 KiB.
- Added CSP, framing, MIME-sniffing, referrer, and no-store headers, no CORS
  opt-in, loopback Host-header enforcement against DNS rebinding, no dynamic
  repository interpolation into the HTML shell, and DOM rendering through
  `textContent`.
- Required the literal `APPLY_VERIFIED_REPAIR` confirmation and matching UUID
  for the exact previously verified in-memory patch. Successful apply consumes
  the preview. Existing clean-checkout, exact effective-instruction allowlist,
  textual patch, no-new-failures, and Git apply checks remain authoritative.
- Added focused command, asset, server, and integration coverage. Automated
  Codex behavior is mocked; one existing package-manager fixture is copied to a
  temporary Git repository for an HTTP adapter end-to-end test.
- Updated README installation/startup/options/security/judge guidance and its
  screenshot placeholder, added the interface to SPEC.md, and added Milestone
  14 to PLAN.md without altering completed milestone history.

### Files created or changed

- `src/version.ts`
- `src/cli.ts`
- `src/commands/check.ts`
- `src/commands/ui.ts`
- `src/web/assets.ts`
- `src/web/openBrowser.ts`
- `src/web/server.ts`
- `test/unit/cli.test.ts`
- `test/unit/commands/ui.test.ts`
- `test/unit/web/assets.test.ts`
- `test/unit/web/server.test.ts`
- `test/integration/web/uiWorkflow.test.ts`
- `vitest.config.ts`
- `README.md`
- `SPEC.md`
- `PLAN.md`
- `IMPLEMENTATION.md`

No runtime or development dependency was added.

### Commands run

```text
npm run typecheck
npx vitest run test/unit/cli.test.ts test/unit/commands/ui.test.ts \
  test/unit/web/server.test.ts
npx vitest run test/unit/cli.test.ts test/unit/commands/ui.test.ts \
  test/unit/web/server.test.ts  # loopback-enabled rerun
npm run typecheck
npm run build
npm run build
node --input-type=module -e <compile APP_JAVASCRIPT with new Function>
npx vitest run test/unit/cli.test.ts test/unit/commands/ui.test.ts \
  test/unit/web test/integration/web
npm test

mktemp -d /private/tmp/escrow-ui-manual.XXXXXX
cp -R demo/sample-monorepo <temporary-repository>
git init --quiet
git config user.name "Escrow UI Test"
git config user.email "ui@example.invalid"
git add .
git commit --quiet -m "UI manual baseline"
node dist/index.js ui <temporary-repository> --model gpt-5.6-sol \
  --port 4173 --no-open
curl http://127.0.0.1:4173/
curl http://127.0.0.1:4173/api/config
curl -X POST -H "Content-Type: application/json" \
  --data '{"execute":true,"allowNetwork":false,"timeout":120}' \
  http://127.0.0.1:4173/api/check
node --input-type=module -e <verify JSON, Markdown, and HTML downloads>
curl -X POST -H "Content-Type: application/json" \
  --data '{"execute":true,"allowNetwork":false,"timeout":120}' \
  http://127.0.0.1:4173/api/fix/preview
git status --short
git worktree list --porcelain
curl -X POST -H "Content-Type: application/json" \
  --data '{"previewId":"<verified-id>",\
"confirmation":"APPLY_VERIFIED_REPAIR"}' \
  http://127.0.0.1:4173/api/fix/apply
git diff --name-only
curl -X POST -H "Content-Type: application/json" \
  --data '{"execute":true,"allowNetwork":false,"timeout":120}' \
  http://127.0.0.1:4173/api/check
open http://127.0.0.1:4173
Ctrl+C
node --input-type=module -e <verify port 4173 is closed>
git worktree list --porcelain
find /private/tmp -maxdepth 2 <Escrow temporary-directory patterns>
rm -rf <exact temporary manual-acceptance directory>

npm run build
npm run typecheck
git diff --check
node dist/index.js ui --help
npm test
```

### Test results

```text
Initial source type check:
  npm run typecheck: PASS

First focused run in the managed sandbox:
  CLI and UI-command tests passed.
  All 8 real-server tests received expected environment-level EPERM because
  the sandbox denied loopback binding; no application assertion ran.

Loopback-enabled focused development runs:
  First run exposed four test-only canonical macOS path/capitalization
  expectations; production behavior was correct.
  Final run: PASS; 5 files, 28 tests, 28 passed, 944ms.

Browser asset syntax check:
  Initial check exposed an escaped-newline bug in the generated JavaScript.
  Corrected asset rebuilt and compiled successfully with new Function.

First full suite after implementation:
  npm test: PASS; 34 files, 417 tests, 417 passed, 6.94s.

Manual loopback acceptance using the committed synthetic demo:
  Server started on exactly 127.0.0.1:4173 and served the SPA and config.
  Live approved check with command execution: expected 1 passed / 4 failed;
  safe health command passed in an isolated worktree.
  JSON, Markdown, and HTML downloads: HTTP 200; parsed/recognized successfully;
  JSON totals exactly matched the check report.
  Live repair preview: verified true; changedFiles exactly ["AGENTS.md"];
  after report 3 passed / 0 failed; active repository remained clean and had
  only its active worktree.
  Explicit confirmed apply: applied true; git diff listed only AGENTS.md and
  matched the previewed diff.
  Final live recheck: PASS; 4 passed / 0 failed (Codex extracted an additional
  valid path claim from the health command); isolated command passed.
  Browser open command succeeded. The managed environment did not permit a
  screen capture because it could include unrelated desktop content, so visual
  evidence was not captured; the served DOM, client syntax/controls, and every
  HTTP interaction were verified directly.
  Ctrl+C: exit 0; subsequent fetch confirmed the port was closed.
  Cleanup: only the active fixture worktree remained before fixture removal;
  no Escrow temporary worktree/process/apply directories remained.

Final verification:
  npm run build: PASS (exit 0)
  npm run typecheck: PASS (exit 0)
  git diff --check: PASS (exit 0)
  node dist/index.js ui --help: PASS (exit 0), all documented options shown
  npm test: PASS (exit 0)
  Test files: 34 passed
  Tests: 418 passed
  Duration: 6.62s
```

### Known limitations

- The local UI supports the same macOS/Linux and JavaScript/TypeScript scope as
  the CLI; Windows remains outside the MVP.
- A live scan or repair still requires an installed, authenticated Codex CLI
  and access to the selected model. Automated tests do not require Codex.
- Scan stages identify the real pipeline without fake percentages, but the
  single check response does not stream sub-stage completion events.
- Session state is intentionally in memory. Restarting the server clears the
  latest report and verified preview.
- Browser launch is best-effort on macOS and Linux. `--no-open` always leaves
  the printed loopback URL available.
- Network blocking and documented-command transitive behavior retain the
  existing CLI limitations; the web adapter does not weaken or broaden them.

## Extraction source hydration defect fix

**Status:** COMPLETE
**Date:** 2026-07-14

### Defect

- Codex claim output was required to copy `originalText` exactly. Even with a
  valid `sourceFile` and line range, harmless model punctuation or formatting
  variation caused scans to fail with `Codex did not preserve originalText`.
- `scopeDirectory` was also copied by the model even though applicability and
  scope are deterministic repository properties.

### Completed

- Added `RawExtractedClaim` for strict AI output without `originalText` or
  `scopeDirectory`; retained `ExtractedClaim` as the hydrated internal model
  consumed by all existing validators and reporters.
- Updated the shipped JSON Schema, strict Zod response schema, and extraction
  prompt so Codex returns exact source file and inclusive line references plus
  normalized claim data, confidence, and extraction reason, but cannot return
  source evidence or choose scope.
- Replaced model-text comparison with deterministic hydration from the exact
  discovered `InstructionFile` matched by `sourceFile`. Exact string equality
  is required for the source path; there is no path normalization or fuzzy
  matching at this boundary.
- Added source-line splitting that recognizes LF and CRLF for line counting,
  preserves the original separator between selected lines, excludes an
  unselected trailing separator, and retains list markers, backticks,
  indentation, and multiline formatting exactly.
- Preserved the existing positive ordered range validation and added explicit
  beyond-file rejection before hydration. Files absent from the effective
  discovered instruction chain remain extraction failures.
- Left validators, report models, reporters, command execution, repair policy,
  and all unrelated features unchanged. Existing reports receive the same
  `ExtractedClaim` shape, now with deterministic source evidence.

### Files changed

- `schemas/claims.schema.json`
- `src/models/claims.ts`
- `src/extraction/claimSchema.ts`
- `src/extraction/extractionPrompt.ts`
- `src/extraction/extractClaims.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/unit/extraction/extractionPrompt.test.ts`
- `test/unit/models/claimSchema.test.ts`
- `test/integration/repair/repairWorkflow.test.ts`
- `test/integration/web/uiWorkflow.test.ts`
- `SPEC.md`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands run and results

```text
npm run typecheck
  PASS

npx vitest run test/unit/extraction/extractClaims.test.ts \
  test/unit/extraction/extractionPrompt.test.ts \
  test/unit/models/claimSchema.test.ts
  PASS; 3 files, 69 tests

npm run build
  PASS

npm test
  FINAL PASS; 34 files, 425 tests, 6.63s

node --input-type=module -e <start ephemeral UI server, POST /api/check,
  print hydrated claim sources, and close server>
  PASS; bound to 127.0.0.1 on an OS-selected port; HTTP 200
  Live synthetic demo report: expected fail, 0 passed / 4 failed /
  1 inconclusive because --execute was not enabled
  Five extracted claims contained exact AGENTS.md source lines, including
  Markdown list markers and backticks; no originalText preservation error

git status --short
git worktree list --porcelain
find /private/tmp -maxdepth 2 <Escrow temporary-directory patterns>
  PASS; disposable repository unchanged; only its active worktree remained;
  no extraction, execution, repair, or UI apply temporary directory remained
```

### Tests added or updated

- exact single-line reconstruction
- multiline reconstruction with indentation
- Markdown backticks and list markers
- CRLF source reconstruction
- reversed and beyond-file line ranges
- exact source-file membership in the instruction chain
- rejection of model-authored `originalText` and `scopeDirectory`
- exact hydrated source text in the shared report and console renderer
- updated mocked extraction payloads for repair and local UI integration

### Known limitations

- Line references remain one-based and inclusive. Codex can still select the
  wrong valid lines semantically; deterministic hydration guarantees those
  lines are quoted truthfully but does not use fuzzy matching to reinterpret
  the selection.

### Two-stage schema correction — 2026-07-14

- Renamed the Codex response boundary to
  `rawCodexExtractionResponseSchema` and confirmed it contains only
  `RawExtractedClaimSchema` entries. It does not reference or compose
  `ExtractedClaimSchema`.
- Added an explicit second parse inside hydration. After exact source-file
  lookup, range validation, source reconstruction, and scope derivation, each
  object must pass `ExtractedClaimSchema`; otherwise extraction fails before
  validators or reports receive it.
- Added separate proofs that a raw claim validates without `originalText`,
  validates without `scopeDirectory`, and fails the final schema. The hydrated
  version of that claim passes the final schema.
- Strengthened the mocked-Codex UI integration assertion to require the exact
  hydrated instruction text and metadata-derived scope in the returned report.
- Reconfirmed that `schemas/claims.schema.json` contains neither
  `originalText` nor `scopeDirectory` in any Codex-output branch.

Files changed for this correction:

- `src/extraction/claimSchema.ts`
- `src/extraction/extractClaims.ts`
- `test/unit/models/claimSchema.test.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/integration/web/uiWorkflow.test.ts`
- `SPEC.md`
- `PLAN.md`
- `IMPLEMENTATION.md`

Verification:

```text
npm run typecheck
  PASS

npx vitest run test/unit/models/claimSchema.test.ts \
  test/unit/extraction/extractClaims.test.ts \
  test/integration/web/uiWorkflow.test.ts
  PASS; 3 files, 70 tests

npm run build
  PASS

npm test
  PASS; 34 files, 428 tests, 6.83s
```

## Path-extraction intent false-positive fix — 2026-07-14

### Defect

Codex could classify a filename in a policy list as `path_exists`, for example
the `AGENTS.md` and `AGENTS.override.md` entries beneath “Repair mode may
modify only.” Those entries constrain which filenames repair may touch; they
do not assert that every listed file currently exists.

### Completed

- Tightened the extraction prompt to define positive path-existence intent and
  explicitly exclude allowed/forbidden lists, examples, output destinations,
  optional files, naming conventions, and repair-mode file allowlists.
- Added deterministic post-hydration filtering. A `path_exists` claim now
  requires its exact `referencedPath` in the selected source lines and clear
  existence intent in those lines or their bounded, contiguous list context.
- Gave non-existence policy context precedence over incidental verbs. This
  catches bare filename bullets whose meaning comes from a preceding policy
  header.
- Narrowed category detection to policy constructions rather than isolated
  words, so genuine instructions such as reviewing `docs/examples.md`,
  reading `docs/output.md`, or seeing `docs/naming-conventions.md` remain path
  claims.
- Left path resolution, repository-boundary enforcement, verdicts, validators,
  reports, execution, repair behavior, and UI behavior unchanged. The UI uses
  the same extraction pipeline and therefore receives the filtered claims.

### Files changed

- `src/extraction/pathClaimIntent.ts`
- `src/extraction/extractClaims.ts`
- `src/extraction/extractionPrompt.ts`
- `test/unit/extraction/pathClaimIntent.test.ts`
- `test/unit/extraction/extractClaims.test.ts`
- `test/unit/extraction/extractionPrompt.test.ts`
- `SPEC.md`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Tests added

- Genuine `Read`, `See`, `Use`, and `Review` path references.
- Allowed-file and forbidden-file lists.
- Example paths and sample headings.
- Output destinations.
- Optional files and conditional existence language.
- Filename naming conventions.
- Repair-mode modifiable-file lists with inherited list-header context.
- Exact referenced-path occurrence in selected source lines.
- Regression cases proving category words inside genuine path names are not
  over-filtered.
- End-to-end mocked extraction proving policy-list claims are removed while a
  genuine path claim in the same instruction file remains exact and hydrated.

### Commands run and results

```text
npm run typecheck
  PASS

npx vitest run test/unit/extraction/pathClaimIntent.test.ts \
  test/unit/extraction/extractClaims.test.ts \
  test/unit/extraction/extractionPrompt.test.ts
  PASS; 3 files, 59 tests, 736ms

npm run build
  PASS

npm run typecheck
  PASS

npm test
  PASS; 35 files, 447 tests, 6.61s
```

### Known limitations

- Natural-language classification remains intentionally narrow. Ambiguous
  filename mentions are discarded rather than converted into repository
  evidence. Genuine retained path claims still receive the existing strict
  path validation without relaxed matching or validation rules.

## Final hackathon demo UI polish — 2026-07-14

### Completed work

- Rebranded all user-visible surfaces to **Escrow**. The npm package and binary
  are `escrow`; browser title/content, CLI help, report headings/download
  names, errors, README, architecture/demo/submission documentation, license,
  fixtures, and checked-in sample reports no longer expose the former product
  names. Internal TypeScript interface names were intentionally left intact.
- Added `Zod -> zod` to the existing deterministic dependency map. The normal
  nearest-package resolution now validates Zod guidance in dependencies or
  devDependencies without AI judgment.
- Added pure result-filter selection shared by the generated browser code.
  Attention statuses are the default when present; otherwise passed claims are
  shown. Advisory totals remain visible, advisory cards are quiet and hidden
  initially, and explicit Advisory and Show all controls expose them.
- Added exact clean/failing result messages and stronger visual hierarchy for
  failed, warning, blocked, and inconclusive claims while keeping passed and
  advisory cards visually quieter.
- Added `formatRepositoryDisplayPath`, which uses the existing component-aware
  repository-boundary check. Console, Markdown, HTML, instruction-chain and
  browser source locations are repository-relative; outside paths are labeled
  `[outside repository]` and never masquerade as trusted relative paths.
  Canonical absolute paths remain unchanged inside validation and JSON.
- Replaced the three plain report links with accessible Download JSON,
  Download Markdown, and Download HTML buttons. They retain the existing
  endpoints, content, totals, attachment headers, keyboard behavior, and
  visible focus treatment.
- Added `npm run demo:reset`. The bounded script recreates only the ignored
  `.escrow-demo/sample-monorepo` directory from the tracked fixture, initializes
  a fresh local Git repository, and commits the reproducible broken baseline.
- Completed the tracked demo with four genuine stale instructions, one valid
  nested override, and one harmless passing command. Added integration tests
  for the exact failure set, override behavior, command isolation, repaired
  revalidation, branding, and report-total consistency.
- Updated the Judge Quick Test and three-minute demo script with exact reset,
  startup, scan, preview, revalidate, download, apply, and fallback steps.

### Files created or changed for this polish

- Branding and CLI: `package.json`, `package-lock.json`, `src/cli.ts`,
  `src/commands/ui.ts`, `src/utils/errors.ts`, extraction/repair/execution temp
  labels, public documents, fixtures, and sample reports.
- Dependency mapping: `src/validation/dependencyMappings.ts`, dependency
  fixtures, and `test/unit/validation/dependencyValidator.test.ts`.
- UI and reports: `src/web/assets.ts`, `src/web/claimFilters.ts`,
  `src/web/server.ts`, `src/reporting/displayPaths.ts`, console/Markdown/HTML
  reporters, and focused web/reporting tests.
- Demo: `scripts/reset-demo.mjs`, `.gitignore`, `demo/README.md`,
  `demo/sample-monorepo`, `test/integration/demo/demoWorkflow.test.ts`, and
  `test/integration/demo/demoAssets.test.ts`.
- Documentation: `README.md`, `SPEC.md`, `PLAN.md`, `IMPLEMENTATION.md`,
  `docs/architecture.md`, `docs/demo-script.md`, and
  `docs/devpost-submission.md`.

No React, cloud hosting, authentication, database, GitHub integration,
telemetry, runtime dependency, validator rewrite, or verdict change was added.

### Automated verification

```text
npm run typecheck
  PASS

npm run build
  PASS

npx vitest run test/unit/validation/dependencyValidator.test.ts \
  test/unit/reporting test/unit/web/assets.test.ts \
  test/unit/web/claimFilters.test.ts test/unit/cli.test.ts \
  test/unit/commands/ui.test.ts test/integration/demo
  PASS; 13 files, 109 tests, 1.89s

npx vitest run test/unit/web/server.test.ts \
  test/integration/web/uiWorkflow.test.ts
  PASS; 2 files, 9 tests, 950ms

npm test -- --reporter=dot
  PASS; 38 files, 463 tests, 7.23s

git diff --check
  PASS

Public-surface legacy-brand scan
  PASS; no former product-name matches

escrow --help
  PASS; usage and command descriptions consistently identify Escrow
```

Coverage includes all four requested Zod cases, default advisory hiding,
Advisory and Show all filters, component-aware relative/outside paths, report
download controls, public branding, exact demo failures, nested override
behavior, repaired validation, and CLI/UI report-total identity.

### Live UI acceptance

Commands run from the Escrow checkout:

```text
npm link
npm run demo:reset
npm run build
npm run typecheck
escrow ui .escrow-demo/sample-monorepo --model gpt-5.6-luna \
  --execute --no-open --port 4177
POST /api/check
POST /api/fix/preview
POST /api/fix/apply with APPLY_VERIFIED_REPAIR
POST /api/check
GET /api/report?format=json
GET /api/report?format=markdown
GET /api/report?format=html
Ctrl+C
npm run demo:reset
```

Exact results:

```text
Initial live scan: fail
  passed 1, failed 4, warnings 0, blocked 0, inconclusive 0,
  advisory 0, overridden 0
  failures: package_manager, path_exists, package_script,
  dependency_present
  command_runs: passed in an isolated worktree

Repair preview: verified true
  changedFiles: ["AGENTS.md"]
  before: 1 passed / 4 failed
  after: PASS, 3 passed / 0 failed
  active disposable checkout unchanged during preview

Explicit apply: applied true
Final live scan: PASS, 3 passed / 0 failed
Download JSON: HTTP 200, escrow-report.json, 4,613 bytes
Download Markdown: HTTP 200, escrow-report.md, 2,985 bytes
Download HTML: HTTP 200, escrow-report.html, 8,500 bytes
Measured workflow: 66.48 seconds
```

The active Escrow repository status was identical before and after the live
workflow. Only the ignored disposable demo's `AGENTS.md` changed on explicit
apply. Ctrl+C stopped the loopback server; `git worktree list --porcelain`
showed only the active Escrow checkout; no `escrow-*` temporary directory
remained. The final reset restored and committed the four-defect demo baseline,
and its `git status --short` was empty.

### Remaining limitations

- Live extraction and repair require an authenticated Codex CLI and access to
  the selected model. Automated tests use mocked model output.
- The UI remains loopback-only and supports the existing macOS/Linux MVP.
- Repository-relative display is presentation-only; JSON deliberately keeps
  canonical paths for existing machine consumers.

## Incomplete rebase repair — 2026-07-14

### Files repaired

- `.gitignore`: retained both `.DS_Store` and resettable `.escrow-demo/`
  exclusions.
- `src/extraction/extractClaims.ts`: retained the Escrow model environment
  setting while preserving the existing raw-output parse, deterministic source
  hydration, and final hydrated-schema validation pipeline.
- `test/unit/extraction/extractClaims.test.ts`: aligned the empty environment
  override test with the public Escrow setting.
- `test/unit/cli.test.ts`: retained UI help coverage and the public-branding
  regression assertion.
- `docs/demo-script.md`: retained the newer resettable UI workflow with
  `gpt-5.6-luna` and removed the obsolete terminal-only branch.
- `site/index.html`: replaced decorative seven-character separator comments so
  the repository-wide merge-delimiter scan is unambiguous and empty.
- `README.md`: removed a duplicated rebase fragment, the obsolete compatibility
  note, and the stale demo-model paragraph while retaining the current Luna UI
  instructions.
- `IMPLEMENTATION.md`: recorded this repair and its validation evidence.

All merge delimiter lines were removed. Public package, documentation, UI,
CLI, report, site, and demo surfaces consistently use Escrow. Existing internal
TypeScript report/error identifiers remain unchanged as permitted.

### Commands and exact results

```text
Repository-wide merge-delimiter scan with .git, node_modules, dist, coverage,
and generated sample reports excluded
  PASS; no results

Public-surface legacy-brand scan
  PASS; no results

python3 -m json.tool package.json
  PASS; valid JSON, package name escrow, binary escrow

git diff --check
  PASS

npm run build
  PASS; TypeScript compilation exit 0

npm run typecheck
  PASS; strict no-emit TypeScript check exit 0

npm test -- --reporter=dot
  PASS; 38 test files, 463 tests, 5.32s
```

No feature, milestone, validator verdict, dependency, or public API was added.
No rebase, pull, reset, commit, or push command was run.

## UI evidence path polish — 2026-07-14

- Added display-only repository path normalization for deterministic evidence
  inside browser claim cards.
- Canonical repository prefixes are removed from in-repository evidence,
  repository-root references display as `.`, and sibling/outside absolute paths
  remain unchanged rather than appearing trusted.
- Validator evidence, verdicts, report models, and JSON output remain unchanged.
- Added an executable browser-helper test covering nested repository paths,
  repository-root evidence, and an outside sibling path.

Verification:

```text
npx vitest run test/unit/web/assets.test.ts
  PASS; 1 file, 3 tests, 302ms

npm run build
  PASS

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 38 test files, 464 tests, 5.84s
```

## OpenAI Build Week model-reference audit — 2026-07-16

### Completed

- Removed the duplicated demo command that left a continued Terra invocation
  followed by a standalone Luna `--model` line.
- Standardized all active OpenAI Build Week judge surfaces on
  `gpt-5.6-luna`: the timed demo, demo fixture README, reset script output,
  judge-facing site, composite Action, checked-in workflow, generated workflow,
  Actions guide, README, and Devpost description.
- Retained `gpt-5.6-terra` as the generic CLI default in
  `src/extraction/extractClaims.ts` and aligned the active README, specification,
  and Devpost description with that existing behavior.
- Reviewed every Sol, Terra, Luna, and generic GPT-5.6 occurrence. Historical
  Sol/Luna acceptance records in this file remain unchanged; generic GPT-5.6
  prose remains where it describes the model family rather than a selectable
  default; synthetic custom-model strings remain in parsing tests.
- Removed the obsolete README claim that a former environment-variable name
  remained supported.
- Added regression coverage proving the timed demo uses Luna, contains no
  Terra command, and that the demo README, reset output, Action, and site all
  retain Luna.

### Shell-command validation

Parsed every active `bash`, `sh`, or `shell` fenced block in:

- `README.md`
- `docs/demo-script.md`
- `docs/devpost-submission.md`
- `demo/README.md`

All 21 blocks passed `bash -n`. A separate continuation scan found no
backslash followed by a blank line and a command option. Copying the judge
quick-test command therefore cannot execute `--model` as a second command.

### Files changed

- `README.md`
- `SPEC.md`
- `docs/demo-script.md`
- `docs/devpost-submission.md`
- `demo/README.md`
- `scripts/reset-demo.mjs`
- `site/index.html`
- `test/integration/demo/demoAssets.test.ts`
- `IMPLEMENTATION.md`

`action.yml`, `.github/workflows/escrow.yml`, `src/commands/init.ts`, and
`docs/github-actions.md` were reviewed and already used Luna, so they required
no edit. `package.json` was reviewed and contains no model default.

### Commands and results

```text
Repository-wide GPT-5.6 reference search
  PASS; every occurrence reviewed individually

Active fenced-shell bash -n validation
  PASS; 21 blocks

Continuation-gap scan
  PASS; no results

npx vitest run test/integration/demo/demoAssets.test.ts \
  test/unit/commands/init.test.ts
  PASS; 2 files, 7 tests, 437ms

npm run demo:reset
  PASS; printed gpt-5.6-luna startup command

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 39 test files, 473 tests, 7.29s

npm run build
  PASS

git diff --check
  PASS
```

### Model availability concern

Model availability remains account- and Codex-version-dependent. The judge
workflow explicitly selects Luna, while `ESCROW_DEMO_MODEL` and `--model`
remain documented escape hatches when Luna is unavailable. No model call was
required for this documentation/configuration audit.

## OpenAI Build Week README submission evidence — 2026-07-16

### Completed

- Added a judge-facing `Built with Codex and GPT-5.6 during OpenAI Build Week`
  section near the top of `README.md`.
- Grounded the build-period statement in the repository history: the first
  tracked commit is dated July 13, 2026, followed by implementation, tests, UI,
  CI, safety, documentation, and reliability commits through July 16.
- Avoided claiming that all ideas or artifacts were created during the event;
  the README states only what the tracked history proves.
- Summarized repository-supported Codex contributions across architecture
  planning, TypeScript iteration, tests and fixtures, security review,
  debugging, documentation, onboarding, demo preparation, and UI integration.
- Added two explicit team-confirmation TODOs rather than inventing personal
  history.
- Documented the human-selected trust boundary: AI interpretation and repair
  proposals, deterministic verdicts, opt-in worktree execution, and strict
  instruction-file-only repair.
- Clearly separated building Escrow with Codex from Escrow invoking Codex at
  runtime for claim extraction and restricted repair proposals.
- Added the Luna rationale for structured, repeatable extraction and linked
  judges to the quick test, architecture, dated implementation history, and
  three-minute walkthrough.
- Added a concise `Why Escrow is different` section without making first,
  only, novelty, hosted-demo, npm-release, or GitHub-release claims.

### Checks and results

```text
Git history audit beginning 2026-07-13
  PASS; first tracked commit 25e5244 on 2026-07-13

README local-link and Markdown-fence check
  PASS; all local targets exist, 24 fence markers balanced

README fenced-shell bash -n check
  PASS; 12 shell blocks

npx vitest run test/integration/demo/demoAssets.test.ts \
  test/unit/reporting/markdownReporter.test.ts \
  test/unit/reporting/reportConsistency.test.ts
  PASS; 3 files, 12 tests, 434ms

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 39 test files, 473 tests, 7.08s

npm run build
  PASS
```

### Personal confirmation still required

- Confirm whether any prototype, design, or code existed before the first
  tracked July 13 commit.
- Optionally provide a personal example of the most useful Codex-assisted
  development moment for the submission narrative.

## Judge-ready package distribution — 2026-07-16

### Completed

- Added `prepack: npm run build`, so a normal `npm pack` compiles TypeScript
  before npm constructs the tarball.
- Made the intended payload explicit in `package.json`: `dist`, `schemas`,
  `README.md`, and `LICENSE`. npm also supplies the package manifest.
- Added `scripts/package-smoke.mjs` and `npm run package:smoke`. The script:
  - creates an isolated temporary root and npm cache;
  - builds and packs Escrow;
  - verifies the required tarball entries;
  - installs the tarball into an unrelated temporary project;
  - resolves the installed `.bin/escrow` target canonically;
  - rejects a target inside the original checkout;
  - runs installed `escrow --help` and `escrow --version`;
  - checks the installed schemas, README, and license; and
  - removes the full temporary root in `finally`.
- Added `.github/workflows/release.yml`, triggered only by version tags matching
  `v*.*.*`. The verification job uses `contents: read`; only the dependent
  release job uses `contents: write`.
- The release workflow verifies that the tag matches `package.json`, runs
  `npm ci`, type checking, tests, build, and the package smoke test, creates a
  fresh `.tgz`, transfers it as a workflow artifact, and attaches it to a
  GitHub Release with `gh release create`.
- The workflow contains no OpenAI credential, model call, npm publication, tag
  creation, or tag push.
- Added `docs/judge-installation.md` with macOS/Linux, Node.js, Git, and Codex
  requirements; local tarball installation; no-model package checks; the live
  prepared demo; GPT-5.6 availability troubleshooting; and exact local/global
  uninstall commands.
- Linked the guide from README while explicitly stating that no GitHub Release
  is currently claimed.
- Added focused package metadata and release-workflow tests, and included the
  packaging integration directory in the normal Vitest suite.

### Files changed

- `package.json`
- `scripts/package-smoke.mjs`
- `.github/workflows/release.yml`
- `docs/judge-installation.md`
- `test/integration/packaging/packageDistribution.test.ts`
- `vitest.config.ts`
- `README.md`
- `PLAN.md`
- `IMPLEMENTATION.md`

`package-lock.json`, `tsconfig.json`, `action.yml`, runtime schema resolution,
validators, execution policy, repair restrictions, and product behavior were
inspected and did not require changes.

### Verification

```text
node --check scripts/package-smoke.mjs
  PASS

npx vitest run test/integration/packaging/packageDistribution.test.ts
  PASS; 1 file, 2 tests, 342ms

npm run package:smoke
  PASS; packed escrow-0.1.0.tgz, installed version 0.1.0 outside the checkout,
  help and version succeeded, temporary root cleaned

README and judge-guide local-link check
  PASS; all local targets exist

README and judge-guide Markdown-fence check
  PASS; balanced fences

README and judge-guide fenced-shell bash -n check
  PASS; 18 shell blocks

Ruby YAML parse of .github/workflows/release.yml
  PASS

npm ci
  PASS; 50 packages installed, 51 audited, 0 vulnerabilities

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 40 test files, 475 tests, 8.85s

npm run build
  PASS

npm run package:smoke
  PASS; installed binary resolved to the temporary installed package,
  version 0.1.0

npm pack --dry-run --json
  PASS; prepack build ran automatically; escrow-0.1.0.tgz was 112,283 bytes,
  502,151 bytes unpacked, 205 entries, executable dist/index.js, both schemas,
  package.json, README, LICENSE, and no bundled dependencies

git diff --check
  PASS
```

No package, tag, release, commit, push, or npm publication was created.

### Known limitations

- Installing the tarball downloads its declared Commander and Zod dependencies
  from npm unless they are already cached.
- Package installation and `--help`/`--version` require no Codex access. Live
  extraction or repair still requires an authenticated Codex CLI and an
  available selected model.
- A maintainer must deliberately update/confirm the package version, commit the
  release-ready tree, and push a matching version tag before the release
  workflow can create the first GitHub Release.

## Deterministic continuous integration — 2026-07-16

### Completed

- Added `.github/workflows/ci.yml` with triggers for every pull request and
  pushes to the confirmed default development branch, `main`.
- Added concurrency keyed by workflow plus pull request number or Git ref, with
  cancellation of superseded runs.
- Set workflow permissions to `contents: read` only.
- Used a GitHub-hosted Ubuntu runner, `actions/checkout@v5`, and
  `actions/setup-node@v5` with Node.js 20 and npm dependency caching.
- The job runs, in order: `npm ci`, `npm run typecheck`, `npm test`,
  `npm run build`, and `npm run package:smoke`.
- Added an accurate README badge targeting `.github/workflows/ci.yml` on
  `main`. The legacy repository slug is URL-encoded in the badge URL so the
  public Escrow branding regression remains valid while the link resolves to
  the actual repository.
- Extended packaging integration coverage to verify CI triggers, permissions,
  concurrency, runner, official actions, Node/npm cache, commands, badge, and
  the absence of write permission, OpenAI/API credentials, Codex, Ollama, or
  self-hosted runners.

### Live-model isolation audit

- `vitest.config.ts` includes unit, command-execution, repair, demo, packaging,
  and loopback-web suites only.
- The sole live Codex test remains in
  `test/integration/extraction/codex.manual.test.ts`, which is available only
  through `vitest.manual.config.ts` and additionally requires
  `ESCROW_RUN_CODEX_INTEGRATION=1` plus an installed Codex CLI.
- Normal extraction, repair, demo, and UI tests inject mocked Codex process
  runners. Normal web tests use only `127.0.0.1`.
- Therefore `npm test` requires no authentication, model access, OpenAI key,
  Ollama service, or external inference network.

### Files changed

- `.github/workflows/ci.yml`
- `README.md`
- `test/integration/packaging/packageDistribution.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Checks and local CI equivalent

```text
Ruby YAML parse of .github/workflows/ci.yml
  PASS

npx vitest run test/integration/packaging/packageDistribution.test.ts \
  test/integration/demo/demoAssets.test.ts
  PASS; 2 files, 8 tests, 418ms

git diff --check
  PASS

npm ci
  PASS; 50 packages installed, 51 audited, 0 vulnerabilities

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 40 test files, 476 tests, 7.37s

npm run build
  PASS

npm run package:smoke
  PASS; escrow-0.1.0.tgz installed outside the checkout, help/version passed,
  installed version 0.1.0, temporary root cleaned
```

No workflow was triggered or rerun externally. No repository setting,
credential, commit, push, or write permission was changed.

## Potential-impact fixture evidence — 2026-07-16

### Completed

- Audited `demo/sample-monorepo`, the nested override, reset workflow,
  checked-in sample reports, reporting commands, demo script, demo tests, and
  Escrow's own effective instruction chain.
- Strengthened the demo integration workflow so it proves exactly five
  validated root claims: four failures (`package_manager`, `path_exists`,
  `package_script`, and `dependency_present`) plus one passing
  `command_runs` result with exit code 0 and
  `sample healthcheck passed`.
- Kept the valid `packages/api/AGENTS.override.md` behavior explicit: the
  broader package-manager claim is overridden, the nested pnpm claim passes,
  and no conflict is produced.
- Replaced the direct repaired-file test with the real restricted repair
  lifecycle. The mocked Codex subprocess supplies only the proposed unified
  diff; Escrow creates the temporary repair worktree, restricts the changed
  file to `AGENTS.md`, runs fresh extraction and deterministic validators,
  re-executes the safe command, obtains `3 passed / 0 failed`, cleans up, and
  leaves the active fixture byte-for-byte unchanged and Git-clean.
- Added cross-surface assertions for all seven summary fields. Console, JSON,
  Markdown, static HTML, the UI scan response, and all UI report download
  endpoints consume and expose the same `1 passed / 4 failed` report.
- Added `docs/case-study.md`, linked it from README and the demo script, and
  documented each realistic stale-instruction risk, the exact repository
  evidence, nested scope, repair constraints, observed fixture totals, test
  boundaries, and reproduction commands. It explicitly disclaims unmeasured
  time savings, users, adoption, customers, and external deployment impact.

### Dogfooding attempt

- `codex --version` reported `codex-cli 0.144.3`.
- `codex login status` reported `Logged in using ChatGPT`.
- Attempted the requested read-only command:

```text
node dist/index.js check . --model gpt-5.6-luna \
  --json docs/dogfood-report-2026-07-16.json
```

- The execution environment rejected the external transfer before Codex was
  invoked because scanning Escrow itself would send repository instruction
  content to an external service without an additional repository-content
  approval. No content was sent, no live result was fabricated, and no dated
  report file was created. `docs/case-study.md` preserves the reproducible
  command for a repository owner who approves that transfer.

### Files changed

- `README.md`
- `docs/case-study.md`
- `docs/demo-script.md`
- `test/integration/demo/demoWorkflow.test.ts`
- `test/integration/demo/demoAssets.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

Validators, verdict aggregation, report implementation, command policy,
repair restrictions, the tracked demo fixture, reset script, and checked-in
sample report artifacts were not weakened or changed.

### Verification

```text
npx vitest run test/integration/demo/demoWorkflow.test.ts \
  test/integration/demo/demoAssets.test.ts --reporter=dot
  PASS; 2 files, 9 tests, 2.83s

npm run typecheck
  PASS

npm run build
  PASS

npm test -- --reporter=dot
  PASS; 40 files, 477 tests, 7.30s
```

No commit or push was performed.

## OpenAI Build Week submission draft — 2026-07-16

### Completed

- Audited `README.md`, the dated implementation record, architecture, canonical
  demo materials, fixture case study, package metadata, composite Action, and
  current Git history before rewriting the submission draft.
- Confirmed the tracked history begins with implementation commits dated July
  13, 2026 and retained the existing qualification that history does not prove
  every idea or artifact began from scratch during the event.
- Replaced the stale Devpost draft with a judge-oriented Developer Tools
  submission covering the problem, product, pipeline, Codex-assisted build
  work, runtime GPT-5.6 boundaries, builder decisions, technical challenges,
  accomplishments, lessons, roadmap, technologies, repository URL, setup,
  testing, limitations, and license.
- Corrected the extraction description to the current two-stage boundary:
  Codex emits raw source locations and normalized fields; Escrow validates the
  discovered file and range, derives scope, reconstructs exact source text
  from disk, and only then accepts the hydrated claim.
- Grounded accomplishments in current repository evidence: the deterministic
  `1 passed / 4 failed` fixture, valid nested override, instruction-only repair
  preview, `3 passed / 0 failed` revalidation, consistent report/UI totals,
  package smoke flow, composite Action, and 478-test suite.
- Added explicit placeholders for the public YouTube URL, Codex `/feedback`
  Session ID, GitHub Release URL, entrant/team information, pre-event work
  confirmation, and an optional personal Codex-development example. No URL,
  session, release, entrant, metric, adoption, customer, or award fact was
  invented.
- Reworked `docs/demo-script.md` into the single canonical story with every
  requested timestamp from 0:00 through 2:50. Its 352 spoken words explain the
  product, stale fixture, deterministic evidence, nested scope, restricted
  repair, revalidation, report, Action/judge path, Codex-assisted development,
  runtime GPT-5.6 role, and human-selected trust boundary.
- Preserved preparation, reset, cleanup, model-availability, offline-report,
  and deterministic-test fallback instructions outside the timed narration.
- Added a focused documentation regression test for required submission
  sections, placeholders, the canonical timeline, and the specific human/AI
  decision statement.

### Files changed

- `docs/devpost-submission.md`
- `docs/demo-script.md`
- `test/integration/demo/demoAssets.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

No validator, verdict, CLI, UI, report, command, repair, package, or Action
behavior changed.

### Verification

```text
Local Markdown-link validation for both edited documents
  PASS; every repository-relative target exists

Fenced-shell bash syntax validation
  PASS; 2 Devpost blocks and 4 canonical-demo blocks

npx vitest run test/integration/demo/demoAssets.test.ts --reporter=dot
  PASS; 1 file, 6 tests, 467ms

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 40 files, 478 tests, 8.35s

npm run build
  PASS
```

No video was uploaded, no Devpost submission was made, and no release, commit,
or push was performed.

## Final OpenAI Build Week submission audit — 2026-07-16

### Read-only audit evidence

- Confirmed the root commit is `25e5244`, dated July 13, 2026, and the active
  README/submission text does not claim that Git history proves every idea or
  artifact originated during the event.
- Confirmed unauthenticated HTTPS `git ls-remote` access to the GitHub
  repository at HEAD `b3ed4bb`; `LICENSE` is tracked and contains the MIT
  license. The public repository currently has no tags.
- Reviewed every active Terra/Luna reference. `gpt-5.6-terra` remains the
  generic CLI default; `gpt-5.6-luna` remains the explicit Build Week demo,
  Action, and generated-workflow selection. Sol references occur only in dated
  implementation history. No active model instruction conflicts.
- Found no merge-conflict markers. All active TODOs are explicitly presented
  as incomplete personal/submission fields; none is represented as finished.
- Found no tracked `.codex`, authentication, environment, credential, or key
  files and no private-key or common token-shaped secret values in the
  repository scan. Workflow secret names are references, not committed secret
  values. Regular `.github/workflows/ci.yml` has `contents: read` only and no
  model credential or live Codex call.
- Confirmed README setup, macOS/Linux support, tests, sample fixture, Codex
  development role, runtime GPT-5.6 boundary, builder decisions, and judge
  quick test. The Devpost draft selects Developer Tools and retains visible
  TODOs for YouTube, `/feedback`, release, and entrant/team data.
- Confirmed the 352-word canonical narration covers the product, Codex-assisted
  development, runtime GPT-5.6, and the builder-selected deterministic trust
  boundary within its 2:50 schedule.
- Confirmed all active local Markdown links, fenced shell syntax, and adjacent
  command duplication checks pass.

### Low-risk defect fixed

- `demo/README.md` and the startup command printed by
  `scripts/reset-demo.mjs` omitted `--execute`. Following either command would
  scan the four stale claims but leave the promised safe health command
  inconclusive instead of passed.
- Added `--execute` to both surfaces and added regression assertions. No
  validator, execution policy, report, repair, package, or external workflow
  behavior changed.

### Files changed by this audit

- `demo/README.md`
- `scripts/reset-demo.mjs`
- `test/integration/demo/demoAssets.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`

### Commands and results

```text
git status --short
  PASS; recorded the existing reviewed but uncommitted submission changes

rg -n '<<<<<<<|=======|>>>>>>>|TODO|PLACEHOLDER|gpt-5\\.6-(sol|terra|luna)' .
  PASS; no conflict markers; only explicit TODOs and reviewed model references

Unauthenticated git ls-remote for public HEAD
  PASS; b3ed4bb9f4a3bddde7e2a445bc0a15a7ceb789b9

Unauthenticated git ls-remote --tags
  PASS; no public tags returned

Tracked/local-state and token-shaped secret scans
  PASS; no secret material or Codex state found

npm ci
  PASS; 50 packages installed

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 40 files, 478 tests, 8.00s

npm run build
  PASS

npm run package:smoke
  PASS; escrow-0.1.0.tgz installed outside the checkout, installed CLI help
  and version succeeded, and the temporary package root was cleaned

npx vitest run test/integration/demo/demoWorkflow.test.ts \
  test/integration/demo/demoAssets.test.ts --reporter=dot
  PASS; 2 files, 10 tests, 2.96s after the command correction

npx vitest run test/integration/repair/repairWorkflow.test.ts \
  test/unit/repair/repairPrompt.test.ts \
  test/unit/reporting/reportConsistency.test.ts --reporter=dot
  PASS; 3 files, 18 tests, 6.08s

node --check scripts/reset-demo.mjs && npm run demo:reset
  PASS; reset fixture was clean and printed the Luna command with --execute

Markdown link, fenced-shell syntax, and adjacent-command checks
  PASS

git diff --check
  PASS
```

The first sandboxed package-smoke attempt was interrupted after its deliberately
fresh npm cache could not reach the registry. The approved read-only network
retry passed. No live model request or external write was made.

### Submission blockers requiring the owner

- The reviewed local changes are not yet committed or pushed, so the public
  repository does not contain the final submission state.
- No public release tag or GitHub Release tarball exists. The package is
  verified, but the advertised no-build judge installation path remains
  pending until the owner creates the release.
- Public YouTube URL, Codex `/feedback` Session ID, entrant/team information,
  and the factual pre-event-work confirmation remain incomplete.

No commit, push, tag, package publication, GitHub Release, video upload, or
Devpost submission was performed.

## Publication preparation — 2026-07-16

### Repository and diff audit

- Captured the dirty worktree, old SSH origin, `main` branch, latest five
  commits, and every repository occurrence of the former ProofCatcher name
  before editing.
- Reviewed the complete tracked diff and every untracked workflow,
  documentation file, package script, and integration test. The pending files
  are intentional publication assets; no generated `dist`, coverage, package
  tarball, disposable demo checkout, credential, or local Codex-state file is
  included.
- Reviewed all legacy-name matches individually. The only remaining
  `ProofCatcher` strings are negative branding regression assertions in tests;
  they are not URLs, product branding, documentation, or historical evidence
  presented to judges.
- Scanned added content and the whole publication surface for secret/token
  shapes, private keys, unsupported metrics or adoption claims, absolute
  personal paths, conflict markers, accidental completed placeholders, and
  duplicate shell commands. No publication blocker was found.

### Canonical repository corrections

- Updated the README CI badge, Devpost repository and clone links, judge
  Releases/source links, and release-workflow metadata to
  `https://github.com/PlutonicSauce/escrow`.
- Added npm metadata for MIT licensing, the canonical Git repository, project
  homepage, and issue tracker. Regenerated only the root package-lock metadata,
  which added the matching MIT license field.
- Updated the reusable composite-Action documentation and generated workflow
  from the planned separate `escrow-action@v1` repository to the canonical
  `PlutonicSauce/escrow@v0.1.0` release tag, with focused regression coverage.
- Updated the local origin to `git@github.com:PlutonicSauce/escrow.git` and
  verified the canonical HTTPS URL resolves without credentials to HEAD
  `b3ed4bb9f4a3bddde7e2a445bc0a15a7ceb789b9`.
- Replaced three personal absolute paths in historical implementation commands
  with descriptive placeholders while preserving the recorded operation and
  result. No `/Users/...` path remains in committed documentation candidates.
- Preserved the clearly incomplete GitHub Release, YouTube, entrant/team, and
  Codex `/feedback` placeholders.

### Files changed specifically for publication preparation

- `README.md`
- `docs/devpost-submission.md`
- `docs/judge-installation.md`
- `docs/github-actions.md`
- `.github/workflows/release.yml`
- `package.json`
- `package-lock.json`
- `src/commands/init.ts`
- `test/unit/commands/init.test.ts`
- `test/integration/packaging/packageDistribution.test.ts`
- `PLAN.md`
- `IMPLEMENTATION.md`
- local Git configuration: `origin` URL only

### Commands and exact results

```text
git status --short
git remote -v
git branch --show-current
git log -5 --oneline
rg -n 'PlutonicSauce/ProofCatcher|github\\.com/PlutonicSauce/ProofCatcher|ProofCatcher' .
  PASS; initial state captured; every match reviewed

Canonical and legacy URL scans
  PASS; active surfaces use PlutonicSauce/escrow; only negative regression
  assertions retain ProofCatcher

Personal absolute-path scan across publication documentation
  PASS; no /Users path remains

Secret, credential, Codex-state, conflict-marker, placeholder, generated-file,
and unsupported-claim review
  PASS

Unauthenticated canonical HTTPS git ls-remote
  PASS; HEAD b3ed4bb9f4a3bddde7e2a445bc0a15a7ceb789b9

npm install --package-lock-only --ignore-scripts --no-audit --no-fund
  PASS; package lock synchronized

npm ci
  PASS; 50 packages installed

npm run typecheck
  PASS

npm test -- --reporter=dot
  PASS; 40 files, 478 tests, 7.34s

npm run build
  PASS

npm run package:smoke
  PASS; escrow-0.1.0.tgz installed outside the source checkout; installed help
  and version succeeded; temporary files cleaned

npx vitest run test/integration/packaging/packageDistribution.test.ts \
  test/unit/commands/init.test.ts --reporter=dot
  PASS; 2 files, 5 tests, 358ms

Workflow YAML and package/package-lock JSON parsing
  PASS

Documentation local-link and fenced-shell syntax checks
  PASS

git diff --check
  PASS
```

No commit, push, tag, publication, release, video upload, or Devpost submission
was performed.
