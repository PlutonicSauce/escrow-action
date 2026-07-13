# AgentContract Implementation Plan

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
- `agentcontract check <repository>` command
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

---

## Milestone 2 — Git root and instruction discovery

**Status:** NOT STARTED

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

---

## Milestone 3 — Claim and report foundations

**Status:** NOT STARTED

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

---

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

---

## Milestone 5 — Package-manager validation

**Status:** NOT STARTED

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

---

## Milestone 6 — Package-script validation

**Status:** NOT STARTED

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

---

## Milestone 7 — Dependency and framework validation

**Status:** NOT STARTED

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

---

## Milestone 8 — Codex claim extraction

**Status:** NOT STARTED

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

---

## Milestone 9 — Safe command execution

**Status:** NOT STARTED

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

---

## Milestone 10 — Scope, overrides, and conflicts

**Status:** NOT STARTED

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

---

## Milestone 11 — Markdown and HTML reports

**Status:** NOT STARTED

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

---

## Milestone 12 — Restricted repair mode

**Status:** NOT STARTED

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
- rerun AgentContract after repair
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

---

## Milestone 13 — Demo repository and final polish

**Status:** NOT STARTED

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

---

## Current milestone

**Milestone 1 — Project foundation**

Do not implement later milestones until Milestone 1 is complete and reviewed.
