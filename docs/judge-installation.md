# Judge installation from a GitHub Release

Escrow does not currently claim a published GitHub Release. After a maintainer
creates a version-tag release, judges can install its `.tgz` asset without
cloning the source or compiling TypeScript.

## Requirements

- macOS or Linux
- Node.js 20 or newer, including npm
- Git
- For live scans only: an installed and authenticated Codex CLI

Verify the runtime prerequisites:

```bash
node --version
npm --version
git --version
codex --version
codex login status
```

Install or authenticate Codex using the official
[Codex CLI documentation](https://learn.chatgpt.com/docs/codex/cli) and
[authentication documentation](https://learn.chatgpt.com/docs/auth).

## Install the release tarball

Download `escrow-<version>.tgz` from the matching version on the canonical
[Escrow Releases page](https://github.com/PlutonicSauce/escrow/releases).
Then install it into an isolated local directory:

```bash
mkdir escrow-judge
cd escrow-judge
npm init -y
npm install /path/to/escrow-0.1.0.tgz
npx escrow --version
npx escrow --help
```

These commands test package installation and the compiled CLI. They do not
contact Codex and do not require an OpenAI API key.

## Run the prepared judge demo

Use a separately downloaded
[source archive](https://github.com/PlutonicSauce/escrow/archive/refs/heads/main.zip)
or checkout only for the bundled demo fixture; no TypeScript compilation is
required:

```bash
cd /path/to/escrow-source-checkout
npm run demo:reset
/path/to/escrow-judge/node_modules/.bin/escrow \
  ui .escrow-demo/sample-monorepo --model gpt-5.6-luna --execute
```

Open the printed loopback URL and follow the
[three-minute walkthrough](demo-script.md). The initial scan should show four
deterministic failures and one passing isolated command.

This live demo is different from installation testing: it invokes the
authenticated Codex service for claim extraction and repair proposals. Escrow
itself still assigns verdicts deterministically.

## If GPT-5.6 Luna is unavailable

Model availability depends on the authenticated Codex account and installed
Codex version. Select an available GPT-5.6 variant explicitly:

```bash
/path/to/escrow-judge/node_modules/.bin/escrow \
  ui .escrow-demo/sample-monorepo --model <available-gpt-5.6-model> --execute
```

You may also set `ESCROW_DEMO_MODEL` when following the README judge command.
Automated package smoke tests never require a live model.

## Uninstall

From the installation directory:

```bash
cd /path/to/escrow-judge
npm uninstall escrow
cd ..
rm -rf /path/to/escrow-judge
```

If you chose a global installation instead, remove it with:

```bash
npm uninstall --global escrow
```
