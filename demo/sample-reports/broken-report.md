# Escrow Report

**Overall status: FAIL**

- Repository: `/demo/sample-monorepo`
- Target directory: `/demo/sample-monorepo`
- Generated: `2026-07-13T23:46:59.820Z`
- Report version: `0.1.0`

## Summary

| Result | Total |
| --- | ---: |
| Passed | 1 |
| Failed | 4 |
| Warnings | 0 |
| Blocked | 0 |
| Inconclusive | 0 |
| Advisory | 0 |
| Overridden | 0 |

## Instruction chain

1. `/demo/sample-monorepo/AGENTS.md` — `AGENTS.md` in `/demo/sample-monorepo`

## Claims

### FAIL · package manager

- Source: `/demo/sample-monorepo/AGENTS.md:3`
- Scope: `/demo/sample-monorepo`

**Original instruction**

```markdown
- Use npm as the package manager for this repository.
```

**Normalized claim**

```text
npm
```

**Deterministic evidence**

- Selected package\-manager scope "/demo/sample\-monorepo"\.
- Detected pnpm from lockfile "/demo/sample\-monorepo/pnpm\-lock\.yaml"\.
- Detected pnpm from package\.json\#packageManager "pnpm@10\.0\.0" at "/demo/sample\-monorepo/package\.json"\.
- Instruction declares npm, but repository evidence indicates pnpm\.

### FAIL · path exists

- Source: `/demo/sample-monorepo/AGENTS.md:4`
- Scope: `/demo/sample-monorepo`

**Original instruction**

```markdown
- Read `docs/DELETED_SETUP.md` before changing workspace configuration.
```

**Normalized claim**

```text
docs/DELETED_SETUP.md
```

**Deterministic evidence**

- Resolved path "docs/DELETED\_SETUP\.md" from instruction directory "/demo/sample\-monorepo" to "/demo/sample\-monorepo/docs/DELETED\_SETUP\.md"\.
- Repository path does not exist: "/demo/sample\-monorepo/docs/DELETED\_SETUP\.md"\.

### FAIL · package script

- Source: `/demo/sample-monorepo/AGENTS.md:5`
- Scope: `/demo/sample-monorepo`

**Original instruction**

```markdown
- Run unit tests with `pnpm test`.
```

**Normalized claim**

```text
test
```

**Deterministic evidence**

- Normalized package command "pnpm test" to pnpm script "test"\.
- Selected nearest package\.json "/demo/sample\-monorepo/package\.json" for claim scope "/demo/sample\-monorepo"\.
- Package script "test" does not exist in "/demo/sample\-monorepo/package\.json"\.

**Suggestion:** Did you mean package script "test:unit"?

### FAIL · dependency present

- Source: `/demo/sample-monorepo/AGENTS.md:6`
- Scope: `/demo/sample-monorepo`

**Original instruction**

```markdown
- Use the installed Jest dependency for unit tests.
```

**Normalized claim**

```text
Jest
```

**Deterministic evidence**

- Mapped framework or tool "Jest" to dependency "jest"\.
- Selected nearest package\.json "/demo/sample\-monorepo/package\.json" for claim scope "/demo/sample\-monorepo"\.
- Mapped dependency "jest" for "Jest" is absent from dependencies, devDependencies, peerDependencies, and optionalDependencies in "/demo/sample\-monorepo/package\.json"\.

### PASS · command runs

- Source: `/demo/sample-monorepo/AGENTS.md:7`
- Scope: `/demo/sample-monorepo`

**Original instruction**

```markdown
- Run `node scripts/healthcheck.mjs` to verify the repository health check.
```

**Normalized claim**

```text
node scripts/healthcheck.mjs
```

**Deterministic evidence**

- Command exited with code 0 in an isolated Git worktree\.
- Temporary worktree removed after command execution\.
- Network\-capable commands were blocked and common package/network clients were configured offline\.

<details>
<summary>Command output</summary>
<ul>
<li>Command: <code>node scripts/healthcheck.mjs</code></li>
<li>Working directory: <code>/tmp/agentcontract-worktree-demo/checkout</code></li>
<li>Status: <strong>PASSED</strong></li>
<li>Exit code: <code>0</code></li>
<li>Duration: <code>103ms</code></li>
</ul>
<strong>stdout</strong>
<pre><code>sample healthcheck passed
</code></pre>
<strong>stderr</strong>
<pre><code></code></pre>
</details>

## Overrides

No claims were overridden.

## Conflicts

No instruction conflicts were detected.
