# Canonical OpenAI Build Week demo script

This is the canonical Escrow judge story. The spoken track targets about 2:45
and is safely below three minutes. Keep setup and model authentication outside
the recording clock.

## Prepare before recording

Run from the Escrow repository root:

```bash
npm ci
npm run build
npm link
codex login status
npm run demo:reset
escrow ui .escrow-demo/sample-monorepo \
  --model "${ESCROW_DEMO_MODEL:-gpt-5.6-luna}" --execute
```

Open the printed loopback URL. Keep these tabs or files ready:

- `demo/sample-monorepo/AGENTS.md`
- `demo/sample-monorepo/packages/api/AGENTS.override.md`
- the Escrow browser interface
- `README.md` at **Judge Quick Test**
- `action.yml`
- `demo/sample-reports/broken-report.html` as an explicitly labeled offline
  fallback
- `docs/case-study.md` for the exact fixture evidence

## Spoken demo — target 2:45

### 0:00–0:15 — Problem and audience

**Show:** `demo/sample-monorepo/AGENTS.md`.

**Say:**

> Coding agents trust repository instructions, but those instructions drift
> outside normal tests. Escrow is a developer tool that checks whether
> `AGENTS.md` still matches the repository before an agent relies on it.

### 0:15–0:55 — Stale claims and scan

**Show:** Point to lines 3–7, switch to the browser, and click **Scan
instructions**.

**Say:**

> This prepared monorepo says npm even though it uses pnpm, requires a deleted
> setup document, calls a missing `test` script, and says Jest is installed
> while the package declares Vitest. It also documents one real health-check
> command. Codex with GPT-5.6 extracts typed candidate claims and exact source
> locations. Escrow then reports four stale claims, while the health command
> passes only because execution was explicitly enabled and it ran in a
> temporary Git worktree—not this checkout.

### 0:55–1:25 — Deterministic evidence and nested scope

**Show:** Expand the four failed cards, then open
`packages/api/AGENTS.override.md`.

**Say:**

> The model does not choose these verdicts. TypeScript validators compare npm
> with the pnpm lockfile and package metadata, resolve the missing path inside
> the Git root, inspect the nearest package scripts, and verify that Jest is
> absent. Source text is reconstructed from the exact repository lines, not
> copied from AI. This nested pnpm override applies only to `packages/api`, so
> it is valid rather than a conflict.

### 1:25–1:55 — Restricted repair preview

**Show:** Click **Preview instruction repair** and highlight the changed-file
list and diff.

**Say:**

> I chose a narrow repair boundary: Codex may propose documentation changes,
> but only for effective `AGENTS.md` or `AGENTS.override.md` files. Escrow
> applies this proposal in another temporary worktree, inspects the real Git
> diff, rejects source, test, package, lockfile, build, or CI changes, and
> rejects new failures. This preview changes only `AGENTS.md` and leaves the
> active demo untouched.

### 1:55–2:15 — Revalidation and report

**Show:** Click **Revalidate**, then **Download HTML** and open the report.

**Say:**

> Revalidation now passes all three remaining truthful instructions. The
> static HTML preserves the same claims and totals as console, JSON, Markdown,
> and the browser, with source locations and deterministic evidence. It opens
> locally without a server.

### 2:15–2:35 — GitHub Action and judge path

**Show:** `action.yml`, then README **Judge Quick Test**.

**Say:**

> The repository includes a composite GitHub Action and deterministic CI, plus
> a copy-paste judge path that resets this fixture for repeatable runs. Normal
> tests mock the Codex subprocess, so CI needs no model credential; the live
> demo uses the judge's authenticated Codex CLI.

### 2:35–2:50 — Codex, GPT-5.6, and the human decisions

**Show:** Return to the clean PASS report.

**Say:**

> I used Codex to plan, implement, test, security-review, debug, document, and
> integrate Escrow. Inside the product, GPT-5.6 only extracts claims and
> proposes restricted repairs. My key decision was that AI interprets
> language, while deterministic repository evidence decides truth. Escrow
> makes the instructions agents trust testable.

## Repeat or restore

Stop the server with Ctrl+C. Restore the exact broken demo at any time:

```bash
npm run demo:reset
```

Confirm both the Escrow checkout and disposable demo state:

```bash
git status --short
git -C .escrow-demo/sample-monorepo status --short
```

The reset command removes and recreates only the ignored `.escrow-demo/`
directory, copies the tracked sample fixture, initializes it as its own Git
repository, and commits the broken baseline.

## Fallback if the live model is slow or unavailable

- Show `demo/sample-reports/broken-console.txt` and
  `demo/sample-reports/broken-report.html` and say explicitly that they are
  pre-generated examples from the bundled synthetic fixture.
- Use the deterministic integration evidence:

```bash
npx vitest run \
  test/integration/demo/demoWorkflow.test.ts \
  test/integration/demo/demoAssets.test.ts
```

- If `gpt-5.6-luna` is unavailable to the authenticated account, set
  `ESCROW_DEMO_MODEL` to an available GPT-5.6 variant and disclose that model
  choice.
- Do not describe prerecorded or mocked output as a live Codex response.

## Verified story facts

The bundled fixture's automated evidence verifies:

- broken scan: `1 passed / 4 failed`;
- failures: package manager, path, package script, and dependency;
- health command: passed in an isolated worktree;
- nested override: passed without a conflict;
- repair preview: changed only `AGENTS.md`, active fixture unchanged;
- repaired revalidation: `3 passed / 0 failed`, overall PASS; and
- console, JSON, Markdown, HTML, UI, and UI downloads: identical totals.

See [`case-study.md`](case-study.md) for the evidence and limitations behind
these statements.
