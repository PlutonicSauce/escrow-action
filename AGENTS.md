# AgentContract Engineering Rules

## Project purpose

AgentContract is an executable verification tool for `AGENTS.md` and
`AGENTS.override.md`.

It extracts verifiable repository instructions, validates them against the
actual repository, optionally executes documented commands in an isolated Git
worktree, and produces evidence reports.

## Required reading

Before making changes:

1. Read `SPEC.md`.
2. Read `PLAN.md`.
3. Implement only the milestone explicitly requested by the user.
4. Review existing tests before changing architecture.

## Scope rules

- Do not implement future milestones early.
- Do not expand the product beyond `SPEC.md`.
- Do not add React, a database, authentication, cloud hosting, GitHub
  integration, GitLab integration, or a team dashboard.
- Prefer small, direct modules over abstract frameworks.
- Avoid unnecessary dependencies.
- Keep the MVP focused on validating the truthfulness of coding-agent
  instructions.

## Validation rules

- GPT-5.6 or Codex may extract candidate claims from natural language.
- AI must never assign final pass, fail, warning, blocked, or inconclusive
  statuses.
- All verdicts must come from deterministic code.
- Every extracted claim must preserve its source file and line numbers.
- Every failed result must include repository evidence.
- Advisory instructions must never be counted as passed or failed.
- Nested instructions are not automatically conflicts.
- More specific instruction files may override broader instructions.

## Safety rules

- Never execute documented commands in the active working tree.
- Use a temporary Git worktree for command execution.
- Never run dangerous commands.
- Never access credentials or sensitive user directories.
- Network access is disabled by default.
- Never modify application source code during repair mode.
- Repair mode may modify only:
  - `AGENTS.md`
  - `AGENTS.override.md`
  - nested files with those exact names
- Never silently apply an AI-generated patch.
- Never commit, push, delete branches, force-reset, or clean the user repository.

## Engineering workflow

For every milestone:

1. Inspect the current implementation.
2. State the files expected to change.
3. Implement only the requested milestone.
4. Add or update focused tests.
5. Run:
   - type checking
   - unit tests
   - relevant integration tests
6. Fix failures before stopping.
7. Update `PLAN.md` milestone status.
8. Update `IMPLEMENTATION.md` with:
   - completed work
   - files changed
   - commands run
   - test results
   - known limitations
9. Summarize completed work and remaining work.

## Code quality

- Use TypeScript strict mode.
- Use explicit types at module boundaries.
- Validate external and AI-generated data with Zod.
- Keep subprocess execution isolated behind a small interface.
- Keep report generation separate from validation.
- Keep claim extraction separate from deterministic validation.
- Prefer pure functions for discovery, parsing, and validation.
- Include actionable error messages.
- Do not hide command output needed for debugging.

## Testing expectations

Tests must cover:

- happy paths
- malformed inputs
- repository-boundary protection
- instruction-file precedence
- nested scope behavior
- blocked commands
- cleanup after failures
- consistent report totals

Do not mark a milestone complete until its acceptance criteria in `PLAN.md`
are satisfied.
