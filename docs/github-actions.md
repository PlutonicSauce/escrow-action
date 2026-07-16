# GitHub Actions

Escrow can gate pull requests with the same trust boundary as the local UI:
Codex interprets instruction text, while deterministic repository evidence
decides every claim status.

## Setup

Add `OPENAI_API_KEY` in **GitHub repository → Settings → Secrets and variables
→ Actions → New repository secret**. GitHub runners cannot reuse your browser
or ChatGPT login, so an API key is required for non-interactive Codex use.

The included workflow runs on internal pull requests and manual dispatches. It
uses `gpt-5.6-luna`, writes JSON, Markdown, and self-contained HTML reports to
`.escrow-artifacts/`, updates one concise pull-request comment, and fails the
PR when Escrow finds stale instructions or encounters an operational error.

Forked pull requests are skipped because GitHub correctly withholds secrets
from them. Review those changes locally or through a trusted maintainer-run
workflow instead.

The comment distinguishes **stale**, **conflicting**, **unsafe** (blocked), and
**unverifiable** (inconclusive) instructions. It also records verified claims,
nested instruction scope resolution, and whether unsafe commands were blocked.

## Reusable action

The project root is a complete GitHub Action implementation. Once this is
released from a repository named `PlutonicSauce/escrow-action` and tagged `v1`,
consumer workflows can use:

```yaml
- uses: PlutonicSauce/escrow-action@v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    model: gpt-5.6-luna
    execute: "true"
```

The action scopes the API key to the one Escrow process that launches Codex,
installs dependencies without lifecycle scripts, and uses a disposable
`CODEX_HOME`. It exports the status and all report paths for downstream steps.

## Free local-runner option

For a zero-API-cost demo, add your Mac as a repository self-hosted runner and
run the **Escrow local Ollama** workflow manually. It uses Ollama with
`qwen2.5-coder:7b` and does not read `OPENAI_API_KEY`. The Mac must be online,
awake, and running Ollama while the job runs. Do not enable this workflow for
untrusted fork pull requests: a self-hosted runner executes repository code on
your own computer.

Escrow treats a non-empty instruction chain with zero source-grounded extracted
claims as **incomplete extraction**, not a successful verification. The report
states that no instructions were verified and the workflow fails closed, so a
weak or unavailable local model cannot create a misleading green check.
