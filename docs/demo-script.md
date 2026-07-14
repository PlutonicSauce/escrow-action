# Three-minute AgentContract demo

This is a 2:55 presenter script for the existing AgentContract product. Run the
preparation once immediately before presenting. During the demo, say that the
terminal output was generated in that rehearsal from the exact commands shown;
do not imply that a captured Codex call is live. The timed presentation stays
under three minutes.

## Files to open

Open these before starting the clock:

1. `$BROKEN_REPO/AGENTS.md` — the stale instructions copied from
   `demo/sample-monorepo/AGENTS.md`.
2. `$BROKEN_REPO/packages/api/AGENTS.override.md` — the valid nested override
   copied from the checked-in fixture.
3. `$ARTIFACTS/broken-console.txt` — discovery, four failures, and isolated
   command evidence.
4. `$ARTIFACTS/nested-console.txt` — the root-to-target instruction chain.
5. `$ARTIFACTS/repair-apply.txt` — the Codex-generated, verified repair.
6. `$ARTIFACTS/repaired-console.txt` — successful revalidation.
7. `$ARTIFACTS/broken-report.html` — the self-contained evidence report.

The generated paths are printed by the preparation block. Checked-in fallback
reports are in `demo/sample-reports/`.

## Prepare before the clock

Run from the AgentContract project root on macOS or Linux. This creates two
committed temporary repositories: one remains broken for the first half of the
demo, while the other receives the verified repair.

```bash
npm ci
npm run build
codex login status

DEMO_HOME="$(mktemp -d)"
BROKEN_REPO="$DEMO_HOME/broken-monorepo"
REPAIR_REPO="$DEMO_HOME/repair-monorepo"
ARTIFACTS="$DEMO_HOME/reports"
MODEL="${ESCROW_DEMO_MODEL:-gpt-5.6-terra}"

cp -R demo/sample-monorepo "$BROKEN_REPO"
cp -R demo/sample-monorepo "$REPAIR_REPO"
mkdir -p "$ARTIFACTS"

for REPO in "$BROKEN_REPO" "$REPAIR_REPO"; do
  git -C "$REPO" init --quiet
  git -C "$REPO" config user.name "AgentContract Demo"
  git -C "$REPO" config user.email "demo@example.invalid"
  git -C "$REPO" add .
  git -C "$REPO" commit --quiet -m "demo baseline"
done

set +e
node dist/index.js check "$BROKEN_REPO" --execute --model "$MODEL" \
  --json "$ARTIFACTS/broken-report.json" \
  --markdown "$ARTIFACTS/broken-report.md" \
  --html "$ARTIFACTS/broken-report.html" \
  >"$ARTIFACTS/broken-console.txt" 2>&1
BROKEN_EXIT=$?

node dist/index.js check "$BROKEN_REPO" --target packages/api \
  --model "$MODEL" >"$ARTIFACTS/nested-console.txt" 2>&1
NESTED_EXIT=$?
set -e

test "$BROKEN_EXIT" -eq 1
test "$NESTED_EXIT" -eq 1

node dist/index.js fix "$REPAIR_REPO" --apply --model "$MODEL" \
  >"$ARTIFACTS/repair-apply.txt" 2>&1

node dist/index.js check "$REPAIR_REPO" --execute --model "$MODEL" \
  --html "$ARTIFACTS/repaired-report.html" \
  >"$ARTIFACTS/repaired-console.txt" 2>&1

git -C "$BROKEN_REPO" status --short
git -C "$REPAIR_REPO" diff --name-only
printf 'BROKEN_REPO=%s\nREPAIR_REPO=%s\nARTIFACTS=%s\nMODEL=%s\n' \
  "$BROKEN_REPO" "$REPAIR_REPO" "$ARTIFACTS" "$MODEL"
```

Expected preparation results:

- the first two checks exit `1` because the stale root instructions still apply;
- the repair and final check exit `0`;
- the broken repository is clean;
- `git diff --name-only` for the repaired repository prints only `AGENTS.md`;
- the final report contains three passed claims and no failures.

Pre-open the HTML report, but leave the terminal visible:

```bash
# macOS
open "$ARTIFACTS/broken-report.html"

# Linux
xdg-open "$ARTIFACTS/broken-report.html"
```

## On-stage commands and narration

### 0:00–0:20 — The stale contract

```bash
sed -n '1,8p' "$BROKEN_REPO/AGENTS.md"
```

Narration:

> Coding agents trust repository instructions, but those instructions drift.
> This file says npm, references a deleted document, calls a missing test
> script, and claims Jest is installed. The repository actually uses pnpm,
> exposes `test:unit`, and declares Vitest.

### 0:20–0:58 — Discovery, deterministic failures, and safe execution

```bash
grep -E '^(AgentContract:|Summary:|Instruction chain:|  .*AGENTS|\[FAIL\]|\[PASS\]|  Working directory:|sample healthcheck)' \
  "$ARTIFACTS/broken-console.txt"
```

Narration:

> This output was generated just before the demo with the command in the
> preparation block. AgentContract discovers the effective instruction chain,
> then Codex extracts typed claims with source lines. Deterministic code—not
> the model—fails package manager, path, package script, and framework checks.
> The documented health command passes, and its working directory proves it ran
> in a temporary Git worktree rather than the active checkout.

### 0:58–1:20 — A valid nested override

```bash
sed -n '1,6p' "$BROKEN_REPO/packages/api/AGENTS.override.md"
grep -E '^(Summary:|Instruction chain:|  .*AGENTS|\[OVERRIDDEN\]|\[PASS\] package_manager)' \
  "$ARTIFACTS/nested-console.txt"
```

Narration:

> For `packages/api`, discovery returns the root file followed by this nested
> override. The broader npm claim is overridden only inside that subtree, and
> the more specific pnpm claim passes. Applicability is deterministic; GPT-5.6
> never decides scope.

### 1:20–1:52 — Codex-generated minimal repair

```bash
sed -n '/=== Verified instruction diff ===/,/=== After repair ===/p' \
  "$ARTIFACTS/repair-apply.txt"
sed -n '1,8p' "$REPAIR_REPO/AGENTS.md"
git -C "$REPAIR_REPO" diff --name-only
```

Narration:

> Repair mode gives Codex the failed claims and deterministic evidence, then
> asks for the smallest truthful documentation patch. AgentContract accepts
> only existing instruction files, applies the proposal in a temporary
> worktree, and rejects new failures. The verified patch changes only
> `AGENTS.md`: npm becomes pnpm, `test` becomes `test:unit`, and unsupported
> stale statements are removed.

### 1:52–2:13 — Successful revalidation

```bash
grep -E '^(AgentContract:|Summary:|\[PASS\]|  Evidence: Command exited|  Working directory:|sample healthcheck)' \
  "$ARTIFACTS/repaired-console.txt"
```

Narration:

> The repaired repository is checked again from scratch. All three remaining
> claims pass, including the health command in another isolated worktree. The
> repair neither changes application code nor commits or pushes anything.

### 2:13–2:34 — Static HTML evidence

Switch to the already-open `$ARTIFACTS/broken-report.html`.

Narration:

> The same report object drives console, JSON, Markdown, and this standalone
> HTML file. It needs no server or React, preserves source locations and
> deterministic evidence, and keeps command output expandable for review.

### 2:34–2:55 — How Codex and GPT-5.6 are used

Narration:

> Codex helped build and audit AgentContract. Inside the product, GPT-5.6 is
> limited to two language tasks: extracting candidate claims and proposing a
> minimal instruction repair. JSON Schema, Zod, repository validators, command
> policy, scope resolution, report totals, and repair acceptance are all
> deterministic. AI interprets language; repository evidence decides truth.

The timed narration is approximately 302 words and targets 2:55 including
terminal transitions.

## Live and fallback options

### Optional live call

If rehearsal latency is consistently low, run the broken check live at 0:20
instead of displaying `broken-console.txt`:

```bash
node dist/index.js check "$BROKEN_REPO" --execute --model "$MODEL" \
  --json "$ARTIFACTS/live-report.json" \
  --markdown "$ARTIFACTS/live-report.md" \
  --html "$ARTIFACTS/live-report.html"
```

Say that exit `1` is expected. Do not make the repair call live unless its
latency has already been measured with enough margin; the deterministic demo
sequence is more important than waiting on stage.

### If Codex is slow during the presentation

1. Press `Ctrl-C` only on the currently running AgentContract process.
2. Say: “The live extraction is service-latency dependent, so I’m switching to
   output generated in rehearsal with this exact command.”
3. Continue with `$ARTIFACTS/broken-console.txt`,
   `$ARTIFACTS/repair-apply.txt`, and `$ARTIFACTS/repaired-console.txt`.
4. Open `$ARTIFACTS/broken-report.html` as planned.

### If Codex is unavailable before rehearsal

Use only the checked-in artifacts below and label them as a recorded prior live
run, not current output:

```text
demo/sample-reports/broken-console.txt
demo/sample-reports/broken-report.json
demo/sample-reports/broken-report.md
demo/sample-reports/broken-report.html
```

The prior live repair and final-pass evidence is recorded under “Live demo and
repair evidence” in `IMPLEMENTATION.md`. If no fresh `repair-apply.txt` exists,
show that recorded evidence and the verified replacement text below while
explicitly saying it is archival:

```diff
-- Use npm as the package manager for this repository.
-- Read `docs/DELETED_SETUP.md` before changing workspace configuration.
-- Run unit tests with `pnpm test`.
-- Use the installed Jest dependency for unit tests.
+- Use pnpm as the package manager for this repository.
+- Run unit tests with `pnpm test:unit`.
```

Do not claim a fresh Codex repair or successful live revalidation when the live
service was unavailable.

## What should be pre-generated

Pre-generate these with the exact preparation commands:

- broken and nested console transcripts;
- repair/apply transcript and repaired console transcript;
- JSON, Markdown, broken HTML, and repaired HTML reports;
- the two temporary committed fixture repositories.

Pre-opening the HTML file and pre-generating real command output are timing
controls, not mocks. Disclose them once at 0:20. Never edit captured output,
never substitute hand-written verdicts, and never describe checked-in sample
reports as a fresh run.
