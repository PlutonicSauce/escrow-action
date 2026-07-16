# Case study: instruction drift in the sample monorepo

This case study uses Escrow's bundled synthetic repository,
[`demo/sample-monorepo`](../demo/sample-monorepo). It represents common
instruction drift without claiming results from an external customer,
production deployment, or measured developer-time study.

## The repository scenario

The fixture is a small pnpm workspace whose root
[`AGENTS.md`](../demo/sample-monorepo/AGENTS.md) contains four stale
instructions and one valid command.

| Stale instruction | Realistic developer problem | What an agent could do if it trusted the instruction | Deterministic evidence |
| --- | --- | --- | --- |
| Use npm | A repository can migrate package managers while its agent instructions remain unchanged. | Use npm commands, create or update the wrong lockfile, or give setup advice that conflicts with the workspace. | `pnpm-lock.yaml` exists and `package.json#packageManager` is `pnpm@10.0.0`; both signals conflict with npm. |
| Read `docs/DELETED_SETUP.md` | Documentation is renamed or deleted but remains part of a required workflow. | Stop on a missing prerequisite, search for nonexistent guidance, or change workspace configuration without the promised context. | The path validator resolves the instruction relative to the instruction file and confirms that the repository path does not exist. |
| Run `pnpm test` | A test script is renamed but the documented command is not updated. | Run a command that fails before tests start or incorrectly report that the repository has no test workflow. | The nearest `package.json` has no `test` script and does have `test:unit`. The suggestion does not change the failed verdict. |
| Use installed Jest | A project changes test frameworks while old framework guidance remains. | Add Jest-specific tests, configuration, or imports to a Vitest project. | The nearest `package.json` declares `vitest` in `devDependencies` and does not declare `jest` in any supported dependency section. |

The fifth instruction runs `node scripts/healthcheck.mjs`. With execution
explicitly enabled, Escrow classifies the command, runs it in a temporary Git
worktree, observes exit code 0 and `sample healthcheck passed`, and removes the
worktree. The active checkout is not the command working directory.

## Nested scope

[`packages/api/AGENTS.override.md`](../demo/sample-monorepo/packages/api/AGENTS.override.md)
correctly says that the API package uses pnpm. For the `packages/api` target,
Escrow keeps that more-specific instruction inside its subtree, marks the
broader root package-manager claim as overridden, and reports no conflict.
The override does not leak into sibling scopes.

## Restricted repair

The demo repair changes only the effective root `AGENTS.md`:

- npm becomes pnpm;
- `pnpm test` becomes `pnpm test:unit`;
- the deleted-document requirement is removed;
- the obsolete Jest requirement is removed;
- the passing health-check command remains.

Codex may propose that minimal documentation patch, but Escrow accepts it only
after applying it in a temporary Git worktree. Deterministic checks reject
changes outside the effective `AGENTS.md` or `AGENTS.override.md` allowlist,
binary or symlink changes, deleted instruction files, new failures, and
unverified patches. Preview mode leaves the active repository unchanged.

## Observed fixture results

The checked-in report fixture and automated integration workflow observe:

| Stage | Passed | Failed | Warnings | Blocked | Inconclusive | Advisory | Overridden | Overall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Broken root scan with command execution | 1 | 4 | 0 | 0 | 0 | 0 | 0 | FAIL |
| Revalidation in the repair worktree | 3 | 0 | 0 | 0 | 0 | 0 | 0 | PASS |
| Nested `packages/api` scope | 1 | 0 | 0 | 0 | 0 | 0 | 1 | PASS |

The four failed claim types are exactly `package_manager`, `path_exists`,
`package_script`, and `dependency_present`. The single passing result in the
broken scan is the isolated health-check command. Console, JSON, Markdown,
static HTML, and the local UI expose the same `1 passed / 4 failed` report
summary; automated coverage compares every total and the report download
payloads.

The integration suite mocks only the Codex subprocess response so normal tests
do not require authentication or network access. Claim hydration, scope,
validators, command policy, temporary worktree execution, repair restrictions,
revalidation, aggregation, reporters, and the loopback UI adapter use the real
Escrow implementation.

## Reproduce the evidence

Reset and launch the live judge fixture:

```bash
npm run demo:reset
escrow ui .escrow-demo/sample-monorepo \
  --model "${ESCROW_DEMO_MODEL:-gpt-5.6-luna}" --execute
```

Run the deterministic integration evidence:

```bash
npx vitest run \
  test/integration/demo/demoWorkflow.test.ts \
  test/integration/demo/demoAssets.test.ts
```

Offline examples are in [`demo/sample-reports`](../demo/sample-reports), and
the timed presentation sequence is in the
[`three-minute demo script`](demo-script.md).

## Escrow repository dogfood attempt

On 2026-07-16, `codex-cli 0.144.3` was installed and `codex login status`
reported an authenticated ChatGPT session. The requested read-only scan was
attempted with:

```bash
node dist/index.js check . \
  --model gpt-5.6-luna \
  --json docs/dogfood-report-2026-07-16.json
```

The execution environment's external-transfer approval gate rejected the
invocation before Escrow could send the repository instruction chain to Codex.
No live result or dated report was produced, so this case study does not claim
a dogfood verdict. A repository owner who has reviewed the instruction content
and permits that transfer can reproduce the command above; it does not enable
documented-command execution because `--execute` is absent.

These results describe only the bundled fixture. Escrow has not measured time
savings, user adoption, customer outcomes, or external deployment impact.
