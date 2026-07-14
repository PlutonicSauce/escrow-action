# AgentContract architecture

AgentContract separates natural-language interpretation from repository truth.
Codex may identify a candidate claim or propose instruction text, but every
applicability decision, verdict, summary, conflict, safety decision, and patch
acceptance decision is deterministic.

## Check pipeline

```text
repository + target
        |
        v
Git root and instruction discovery
        |
        v
Codex read-only extraction -> JSON Schema -> Zod validation
        |
        v
deterministic scope and validators
        |
        +---- path/package/dependency evidence (read-only repository access)
        |
        +---- optional command policy -> temporary Git worktree -> result
        |
        v
one AgentContractReport
        |
        +---- console
        +---- JSON
        +---- Markdown
        +---- standalone HTML
```

Instruction discovery walks from the canonical Git root to the canonical target
directory. At each directory it selects at most one non-empty instruction file:
`AGENTS.override.md` first, otherwise `AGENTS.md`. The resulting chain is broad
to specific. Deterministic target scope prevents nested guidance from leaking
into sibling directories.

Codex receives numbered instruction contents as untrusted data. It runs
non-interactively in a read-only sandbox, with an output schema and a prompt
that forbids verdicts. AgentContract validates the JSON again with Zod and
checks source files, line ranges, exact original text, and scope metadata.

## Deterministic validation

Validators are small modules selected by claim type:

- paths are resolved within the repository without following symlinks
- package managers use lockfiles and `packageManager` metadata
- scripts and dependencies use the nearest applicable `package.json`
- scope/override/conflict handling uses canonical path ancestry
- report totals and overall status are pure deterministic aggregation

Advisory claims are preserved but excluded from pass/fail totals. AI never
generates a quality score.

## Command isolation

Documented commands are inconclusive unless `--execute` is explicit. Before
execution, a deterministic policy rejects dangerous programs, shell chaining,
credential paths, traversal, network-capable commands without permission, and
other prohibited behavior.

An allowed command runs in a detached temporary Git worktree at the claim's
repository-relative scope. The active checkout is never the command working
directory. stdout, stderr, exit code, duration, and working directory are
captured. Process groups are terminated on timeout, and worktrees are cleaned
unless command-worktree retention was explicitly requested.

## Restricted repair lifecycle

```text
before report (active repository, read-only)
        |
        v
detached repair worktree
        |
        v
Codex read-only patch proposal (schema + Zod)
        |
        v
git apply --check + exact changed-file inspection
        |
        v
after report in repair worktree
        |
        +---- reject new/no-improvement failures
        |
        +---- preview: show and discard
        |
        +---- --apply: recheck clean active repository, apply verified patch
```

The allowlist is the existing effective instruction chain. All other paths are
forbidden. AgentContract rejects unsafe paths, untracked additions, staged
changes, symlinks, deletions, renames, mode changes, binary patches, NUL data,
invalid UTF-8, and any non-regular result. It never edits application code,
commits, or pushes.

## Trust boundaries

- Instruction text, Codex JSON, repair patches, repository paths, package
  metadata, and command output are untrusted inputs.
- Zod validates AI/external structured data at runtime.
- Git commands use argument arrays instead of an interpolated shell.
- HTML and Markdown reporters escape repository-controlled content.
- Credential/home paths are outside validation and command scope.
- The active repository is read-only except for an explicit verified
  instruction-file `fix --apply`.

## Main modules

- `src/discovery/`: Git root, target, and instruction chain
- `src/extraction/`: Codex client, prompt, schema validation, pipeline
- `src/validation/`: deterministic claim, scope, override, and conflict logic
- `src/execution/`: policy, subprocess handling, and Git worktrees
- `src/repair/`: repair prompt, patch generation, restriction, revalidation
- `src/models/`: claims, conflicts, and shared report
- `src/reporting/`: console, JSON, Markdown, and HTML consumers
- `src/commands/`: CLI orchestration
