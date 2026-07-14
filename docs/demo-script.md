# Three-minute AgentContract demo

This demo starts from committed temporary copies, so the checked-in templates
and the AgentContract working tree remain unchanged. Authenticate Codex before
starting (`codex login status`) and build AgentContract once (`npm ci && npm run
build`). The measured automated run is recorded in `IMPLEMENTATION.md`.

## 1. Prepare the temporary repositories

Run from the AgentContract project root:

```bash
DEMO_HOME="$(mktemp -d)"
DEMO_REPO="$DEMO_HOME/sample-monorepo"
DANGER_REPO="$DEMO_HOME/dangerous-command-fixture"
ARTIFACTS="$DEMO_HOME/reports"
MODEL="${ESCROW_DEMO_MODEL:-gpt-5.6-terra}"

cp -R demo/sample-monorepo "$DEMO_REPO"
cp -R demo/dangerous-command-fixture "$DANGER_REPO"
mkdir -p "$ARTIFACTS"

git -C "$DEMO_REPO" init --quiet
git -C "$DEMO_REPO" config user.name "AgentContract Demo"
git -C "$DEMO_REPO" config user.email "demo@example.invalid"
git -C "$DEMO_REPO" add .
git -C "$DEMO_REPO" commit --quiet -m "demo baseline"

git -C "$DANGER_REPO" init --quiet
git -C "$DANGER_REPO" config user.name "AgentContract Demo"
git -C "$DANGER_REPO" config user.email "demo@example.invalid"
git -C "$DANGER_REPO" add .
git -C "$DANGER_REPO" commit --quiet -m "danger fixture"
```

## 2. Show the broken instructions and every report format

```bash
node dist/index.js check "$DEMO_REPO" --execute --model "$MODEL" \
  --json "$ARTIFACTS/broken-report.json" \
  --markdown "$ARTIFACTS/broken-report.md" \
  --html "$ARTIFACTS/broken-report.html"
```

Expected exit code: `1`. The report shows:

- npm instruction versus pnpm lockfile/metadata
- missing `docs/DELETED_SETUP.md`
- missing `test` package script, with `test:unit` suggested
- Jest guidance while only Vitest is declared
- a passing `node scripts/healthcheck.mjs` command from an isolated worktree

Checked-in examples are under `demo/sample-reports/`.

## 3. Show the valid nested override

```bash
node dist/index.js check "$DEMO_REPO" --target packages/api --model "$MODEL"
```

The root npm claim is overridden for this target by
`packages/api/AGENTS.override.md`; the nested pnpm claim passes. Other stale
root guidance still applies and remains visible.

## 4. Prove a dangerous command is blocked

```bash
node dist/index.js check "$DANGER_REPO" --execute --model "$MODEL"
```

Expected exit code: `0` with `PASS WITH WARNINGS`. `git push origin main`
appears as `BLOCKED`; it is classified before any command subprocess or command
worktree is created and is never executed.

## 5. Preview, apply, and recheck the repair

Preview first; this shows the before report, verified diff, and after report but
leaves the temporary demo repository clean:

```bash
node dist/index.js fix "$DEMO_REPO" --model "$MODEL"
git -C "$DEMO_REPO" status --short
```

Apply only after inspecting the verified instruction-only diff:

```bash
node dist/index.js fix "$DEMO_REPO" --apply --model "$MODEL"
git -C "$DEMO_REPO" status --short
node dist/index.js check "$DEMO_REPO" --model "$MODEL"
```

The final check has no failed claims. `fix --apply` leaves only the verified
instruction file modified and performs no commit or push.

## Timing target

Start timing after dependencies are installed, AgentContract is built, and
Codex is authenticated. The intended live sequence is under three minutes on a
normal development connection; Codex service latency can vary. The repository's
recorded deterministic/mock-backed demonstration is comfortably below that
limit and is used in normal CI.
