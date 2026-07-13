# AgentContract Product Specification

## 1. Product summary

AgentContract is an executable verification tool for repository instructions
used by coding agents.

Coding agents rely on files such as `AGENTS.md` and `AGENTS.override.md`.
Those files may contain setup commands, test commands, package-manager rules,
framework claims, and referenced documentation. As repositories evolve, those
instructions can become stale.

AgentContract converts verifiable instructions into structured claims,
validates them against the repository, optionally executes documented commands
inside an isolated Git worktree, and generates evidence reports.

## 2. Tagline

> Executable tests for the instructions coding agents rely on.

## 3. Category

Developer Tools

## 4. Core principle

AI may identify and explain candidate claims, but AI must not decide whether a
claim passed.

All final statuses must come from deterministic validation.

## 5. Primary user story

As a developer using Codex or another coding agent, I want to verify that my
repository instructions still match the actual project so the agent does not
follow missing files, outdated commands, incorrect package-manager guidance,
or stale framework information.

## 6. MVP scope

The MVP supports:

- local Git repositories
- macOS and Linux
- `AGENTS.md`
- `AGENTS.override.md`
- root and nested instruction files
- JavaScript and TypeScript repositories
- npm, pnpm, and Yarn
- static verification
- optional documented-command execution
- Codex-assisted claim extraction
- Codex-assisted repair suggestions
- console, JSON, Markdown, and static HTML reports

## 7. Supported claim types

```ts
type ClaimType =
  | "path_exists"
  | "package_manager"
  | "package_script"
  | "dependency_present"
  | "command_runs"
  | "advisory";
```

The MVP verifies only:

1. referenced paths exist
2. declared package manager matches repository evidence
3. referenced package scripts exist
4. declared tools or frameworks exist in dependencies
5. documented shell commands execute successfully
6. nested instruction scope is interpreted correctly
7. overrides are distinguished from genuine contradictions

## 8. Non-goals

Do not implement:

- GitHub or GitLab integration
- pull-request comments
- hosted SaaS
- user accounts
- team dashboards
- repository indexing
- long-term memory
- general documentation linting
- general code review
- vulnerability scanning
- support for every programming language
- automatic source-code repairs
- automatic commits or pushes
- React

A self-contained static HTML report is sufficient.

## 9. Example problem

Instruction file:

```md
# AGENTS.md

- Install dependencies with `npm install`.
- Run tests with `npm test`.
- Use Jest for unit tests.
- Read `docs/API_ARCHITECTURE.md` before changing API routes.
```

Repository evidence:

```text
pnpm-lock.yaml
package.json contains "test:unit" but no "test"
package.json contains Vitest but not Jest
docs/API_ARCHITECTURE.md does not exist
```

Expected result:

```text
FAIL  Package manager
      Instruction says npm
      Repository contains pnpm-lock.yaml

FAIL  Package script
      "npm test" references missing script "test"
      Similar script: "test:unit"

FAIL  Framework
      Jest is not installed
      Vitest is installed

FAIL  Referenced path
      docs/API_ARCHITECTURE.md does not exist
```

## 10. CLI

Binary:

```bash
agentcontract
```

Commands:

```bash
agentcontract check .
agentcontract check . --target packages/api
agentcontract check . --execute
agentcontract check . --json report.json
agentcontract check . --markdown report.md
agentcontract check . --html report.html
agentcontract fix .
agentcontract fix . --apply
```

Supported flags:

```text
--target <directory>
--execute
--allow-network
--timeout <seconds>
--include-global
--json <path>
--markdown <path>
--html <path>
--verbose
--keep-worktree
--apply
--model <model>
```

Default model:

```text
gpt-5.6
```

Environment override:

```text
AGENTCONTRACT_CODEX_MODEL
```

## 11. Instruction discovery

Given a Git repository root and target directory:

1. Walk from the Git root toward the target.
2. At each directory, prefer non-empty `AGENTS.override.md`.
3. Otherwise use non-empty `AGENTS.md`.
4. Use at most one instruction file per directory.
5. Return the chain in root-to-target order.
6. Treat later files as more specific.

Global instructions are excluded by default.

With `--include-global`, inspect:

```text
$CODEX_HOME/AGENTS.override.md
$CODEX_HOME/AGENTS.md
```

Use `~/.codex` when `CODEX_HOME` is unset.

Do not expose unrelated home-directory content.

## 12. Claim model

```ts
interface ExtractedClaim {
  id: string;
  type: ClaimType;

  sourceFile: string;
  lineStart: number;
  lineEnd: number;

  originalText: string;
  normalizedValue: string;
  scopeDirectory: string;

  command?: string;
  referencedPath?: string;
  packageManager?: "npm" | "pnpm" | "yarn";
  packageScript?: string;
  dependencyNames?: string[];

  confidence: number;
  extractionReason: string;
}
```

## 13. Claim extraction

Codex with GPT-5.6 runs in read-only mode and produces schema-constrained JSON.

Codex may:

- identify candidate claims
- normalize command and framework names
- identify advisory language
- preserve source locations
- explain why text was classified as a claim

Codex must not assign validation statuses.

External and AI-generated data must be validated with Zod.

## 14. Deterministic validation

### 14.1 Referenced paths

Resolve relative paths from the directory containing the instruction file.

Repository-root references beginning with `/` resolve from the Git root.

Statuses:

```text
PASS          path exists
FAIL          path does not exist
INCONCLUSIVE  unsupported or ambiguous reference
```

Paths outside the repository must be rejected.

### 14.2 Package manager

Evidence:

```text
package-lock.json      npm
npm-shrinkwrap.json    npm
pnpm-lock.yaml         pnpm
yarn.lock              yarn
package.json#packageManager
```

Statuses:

```text
PASS          one matching package-manager signal
FAIL          instruction conflicts with repository evidence
WARNING       multiple lockfile types
INCONCLUSIVE  no reliable evidence
```

Repository inconsistencies must be reported separately.

### 14.3 Package scripts

Normalize:

```text
npm test             -> test
npm run test:unit    -> test:unit
pnpm lint            -> lint
pnpm run typecheck   -> typecheck
yarn build           -> build
```

Inspect the nearest applicable `package.json`.

Statuses:

```text
PASS          script exists
FAIL          script is missing
INCONCLUSIVE  no applicable package.json
```

String similarity may suggest alternatives but must not change the verdict.

### 14.4 Dependencies and frameworks

Inspect:

- dependencies
- devDependencies
- peerDependencies
- optionalDependencies

Initial deterministic mappings:

```text
Vitest      -> vitest
Jest        -> jest
TypeScript  -> typescript
ESLint      -> eslint
Prettier    -> prettier
Vite        -> vite
Next.js     -> next
React       -> react
Playwright  -> @playwright/test or playwright
```

Statuses:

```text
PASS          dependency exists
FAIL          dependency does not exist
INCONCLUSIVE  framework cannot be mapped safely
```

### 14.5 Command execution

Only execute commands when `--execute` is present.

Requirements:

- execute in a temporary Git worktree
- never execute in the active checkout
- capture stdout, stderr, exit code, duration, and working directory
- enforce a timeout
- disable network by default where practical
- classify the command before execution
- always clean up unless `--keep-worktree` is used

Statuses:

```text
PASS          exit code 0
FAIL          nonzero exit code
FAIL          timeout
BLOCKED       prohibited by safety policy
INCONCLUSIVE  unable to execute
```

## 15. Command safety

Block dangerous commands and behavior, including:

```text
sudo
su
shutdown
reboot
mkfs
diskutil erase
git push
git reset --hard
git clean -fd
rm -rf /
rm -rf ~
curl ... | sh
wget ... | sh
chmod -R 777
chown -R
```

Also block:

- writes outside the temporary worktree
- access to `.ssh`
- access to `.aws`
- access to `.gnupg`
- browser profile access
- commands requiring interactive credentials

Network access requires `--allow-network`.

Every blocked command must appear in the report.

## 16. Scope and overrides

Nested instructions are not automatically contradictions.

A more specific nested instruction may override a root instruction within that
subtree.

Example:

```text
Root: use npm for root commands
packages/api: use pnpm in this package
```

This is an override, not necessarily a conflict.

A genuine conflict occurs when mutually exclusive instructions apply within the
same effective scope.

Scope resolution must be deterministic. GPT-5.6 may help explain semantic
relationships, but it must not decide which files apply.

## 17. Claim statuses

```ts
type ClaimStatus =
  | "passed"
  | "failed"
  | "warning"
  | "blocked"
  | "inconclusive"
  | "advisory"
  | "overridden";
```

Overall status:

```text
PASS                no failed claims and no warnings
PASS WITH WARNINGS  no failed claims, but warnings/blocked/inconclusive exist
FAIL                one or more failed claims
```

Do not generate an AI quality score.

## 18. Repair mode

Codex repair mode may modify only instruction files.

Allowed:

```text
AGENTS.md
AGENTS.override.md
nested files with those exact names
```

Forbidden:

- source code
- tests
- package.json
- lockfiles
- build configuration
- CI configuration

Repair process:

1. create a temporary worktree
2. provide failed claims and deterministic evidence to Codex
3. request the smallest truthful documentation patch
4. reject changes outside allowed files
5. rerun AgentContract
6. reject repairs introducing new failures
7. show before-and-after evidence
8. show the diff
9. modify the active repository only when `--apply` was explicitly supplied

Without `--apply`, repair mode is preview-only.

## 19. Reports

All reports must use one shared report model.

Required formats:

- console
- JSON
- Markdown
- self-contained static HTML

Each claim result must include:

- claim type
- source file
- line range
- original text
- normalized value
- status
- deterministic evidence
- optional suggestion
- command output when relevant

HTML must require no server and no React.

## 20. Data model

```ts
interface BranchCommandResult {
  command: string;
  workingDirectory: string;
  status: "passed" | "failed" | "blocked" | "inconclusive";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

interface ValidatedClaim extends ExtractedClaim {
  status: ClaimStatus;
  evidence: string[];
  suggestion?: string;
  commandResult?: BranchCommandResult;
}

interface AgentContractReport {
  version: string;
  generatedAt: string;
  repositoryRoot: string;
  targetDirectory: string;
  instructionChain: InstructionFile[];
  claims: ValidatedClaim[];
  conflicts: InstructionConflict[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    blocked: number;
    inconclusive: number;
    advisory: number;
    overridden: number;
  };
  overallStatus: "pass" | "fail" | "pass_with_warnings";
}
```

## 21. Technical stack

Use:

- Node.js 20+
- TypeScript
- Commander
- Zod
- unified
- remark-parse
- execa
- simple-git or direct Git commands
- Vitest
- picocolors

Avoid unnecessary dependencies.

## 22. Project structure

```text
agentcontract/
├── AGENTS.md
├── SPEC.md
├── PLAN.md
├── IMPLEMENTATION.md
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── schemas/
│   └── claims.schema.json
├── src/
│   ├── cli.ts
│   ├── index.ts
│   ├── commands/
│   ├── discovery/
│   ├── extraction/
│   ├── validation/
│   ├── execution/
│   ├── repair/
│   ├── reporting/
│   ├── models/
│   └── utils/
├── test/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── demo/
    └── sample-monorepo/
```

## 23. Exit codes

```text
0  all checks passed
1  one or more claims failed
2  invalid arguments or repository
3  Codex extraction failed
4  internal AgentContract error
```

Warnings, blocked checks, and inconclusive results do not return `1` in the MVP.

## 24. Testing requirements

Unit tests must cover:

- Git-root discovery
- instruction precedence
- empty instruction files
- target-directory resolution
- path normalization
- package-manager detection
- package-script normalization
- dependency mapping
- command blocking
- timeout handling
- status aggregation
- nested overrides
- same-scope conflicts

Integration fixtures must include:

1. valid repository
2. stale instructions
3. nested overrides
4. dangerous command
5. passing, failing, and timed-out commands

## 25. Definition of done

The MVP is complete when:

1. root and nested instruction files are discovered correctly
2. Codex extracts schema-valid candidate claims
3. deterministic validators cover all supported claim categories
4. valid overrides are not reported as conflicts
5. commands execute only in isolated worktrees
6. dangerous commands are blocked
7. all report formats agree
8. repair mode changes only instruction files
9. proposed repairs are revalidated
10. tests pass
11. the demo runs in under three minutes
12. README setup instructions work on a clean machine
