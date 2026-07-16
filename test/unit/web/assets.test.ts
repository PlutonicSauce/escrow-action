import { describe, expect, it } from "vitest";

import {
  APP_JAVASCRIPT,
  INDEX_HTML,
  STYLES_CSS,
} from "../../../src/web/assets.js";

describe("local UI assets", () => {
  it("ships a dependency-free, syntactically valid browser application", () => {
    expect(() => new Function(APP_JAVASCRIPT)).not.toThrow();
    expect(INDEX_HTML).not.toMatch(/https?:\/\//u);
    expect(INDEX_HTML).not.toContain("React");
    expect(APP_JAVASCRIPT).not.toContain("innerHTML");
    expect(STYLES_CSS).toContain("@media");
    expect(INDEX_HTML).toContain("<title>Escrow · Instruction evidence</title>");
    expect(INDEX_HTML).not.toMatch(/AgentContract|ProofCatcher/u);
    expect(APP_JAVASCRIPT).not.toMatch(/AgentContract|ProofCatcher/u);
  });

  it("uses the dark developer-tool visual contract without external assets", () => {
    for (const token of [
      "--page:#0d1117",
      "--panel:#161b22",
      "--subtle:#1c2128",
      "--border:#30363d",
      "--text:#e6edf3",
      "--muted:#8b949e",
      "--blue:#2f81f7",
      "--green:#3fb950",
      "--red:#f85149",
      "--amber:#d29922",
    ]) {
      expect(STYLES_CSS).toContain(token);
    }
    expect(INDEX_HTML).toContain('name="color-scheme" content="dark"');
    expect(INDEX_HTML).toContain("Instruction integrity");
    expect(INDEX_HTML).toContain("Configuration");
    expect(APP_JAVASCRIPT).toContain("Commands run in isolated worktrees");
    expect(INDEX_HTML).not.toContain("Read-only by default");
    expect(INDEX_HTML).not.toContain("Instructions you can trust.");
    expect(INDEX_HTML).toContain("Verified patch");
    expect(STYLES_CSS).not.toContain("Georgia");
    expect(STYLES_CSS).not.toContain("gradient");
    expect(STYLES_CSS).not.toContain("box-shadow");
    expect(STYLES_CSS).toContain("prefers-reduced-motion:reduce");
    expect(STYLES_CSS.match(/border-radius:999px/gu)).toHaveLength(2);
    expect(INDEX_HTML).not.toContain("eyebrow");
    expect(INDEX_HTML).not.toContain("step-label");
    expect(INDEX_HTML).not.toMatch(/<(?:img|link)[^>]+https?:\/\//u);
    expect(INDEX_HTML).toContain('role="progressbar"');
    expect(INDEX_HTML).not.toContain("aria-valuenow");
    expect(INDEX_HTML).not.toContain("aria-valuemax");
    expect(APP_JAVASCRIPT).not.toMatch(/updateStages\([^)]*(?:seconds|elapsed)/u);
  });

  it("never places an absolute home-directory repository path in configuration", () => {
    const functionSource = APP_JAVASCRIPT.match(
      /function displayConfigurationRepository[\s\S]*?(?=\nfunction displayConfigurationTarget)/u,
    )?.[0];
    expect(functionSource).toBeDefined();
    const createFormatter = new Function(
      String(functionSource ?? "") + "; return displayConfigurationRepository;",
    ) as () => (value: string) => string;
    const displayRepository = createFormatter();

    expect(
      displayRepository(
        "/Users/example/Desktop/Projects/Escrow/.escrow-demo/sample-monorepo",
      ),
    ).toBe("sample-monorepo");
    expect(APP_JAVASCRIPT).toContain(
      "$('repository').value=repositoryLabel",
    );
    expect(APP_JAVASCRIPT).not.toContain(
      "$('repository').value=state.config.repository",
    );

    const targetFunction = APP_JAVASCRIPT.match(
      /function displayConfigurationTarget[\s\S]*?(?=\nfunction redactHomePath)/u,
    )?.[0];
    const createTargetFormatter = new Function(
      "state",
      String(targetFunction ?? "") + "; return displayConfigurationTarget;",
    ) as (state: { config: { repository: string } }) => (value: string) => string;
    const displayTarget = createTargetFormatter({
      config: { repository: "/Users/example/work/sample-monorepo" },
    });
    expect(displayTarget("/Users/example/work/sample-monorepo")).toBe(".");
    expect(
      displayTarget("/Users/example/work/sample-monorepo/packages/api"),
    ).toBe("packages/api");
    expect(displayTarget("/Users/example/private")).toBe(
      "[outside repository]",
    );
  });

  it("includes the required controls, evidence views, filters, and repair confirmation", () => {
    for (const id of [
      "repository",
      "target",
      "model",
      "execute",
      "allow-network",
      "scan",
      "instruction-chain",
      "claims",
      "preview-repair",
      "confirm-apply",
      "apply-repair",
    ]) {
      expect(INDEX_HTML).toContain(`id="${id}"`);
    }
    for (const filter of [
      "all",
      "attention",
      "failed",
      "warnings",
      "passed",
      "blocked",
      "inconclusive",
      "advisory",
    ]) {
      expect(APP_JAVASCRIPT).toContain(`"name":"${filter}"`);
    }
    expect(APP_JAVASCRIPT).toContain("filter:'attention'");
    expect(APP_JAVASCRIPT).toContain('"label":"Advisory"');
    expect(APP_JAVASCRIPT).toContain('"label":"Show all"');
    expect(APP_JAVASCRIPT).toContain("attentionStatuses");
    expect(APP_JAVASCRIPT).toContain("state.filter=report.claims.some");
    expect(APP_JAVASCRIPT).toContain("No broken instructions were found.");
    expect(APP_JAVASCRIPT).toContain(
      "These instructions do not match the repository.",
    );
    expect(APP_JAVASCRIPT).toContain("[outside repository]");
    expect(APP_JAVASCRIPT).toContain("function displayRepositoryEvidence");
    expect(APP_JAVASCRIPT).toContain("displayRepositoryEvidence(item)");
    for (const label of [
      "Download JSON",
      "Download Markdown",
      "Download HTML",
    ]) {
      expect(INDEX_HTML).toContain(label);
    }
    expect(INDEX_HTML.match(/class="download-button"/gu)).toHaveLength(3);
    expect(STYLES_CSS).toContain(".download-button");
    expect(STYLES_CSS).toContain("focus-visible");
    expect(APP_JAVASCRIPT).toContain("textContent");
    expect(APP_JAVASCRIPT).toContain("APPLY_VERIFIED_REPAIR");
  });

  it("renders deterministic evidence with safe repository-relative paths", () => {
    const functionSource = APP_JAVASCRIPT.match(
      /function redactHomePath[\s\S]*?(?=\nfunction sourceLocation)/u,
    )?.[0];
    expect(functionSource).toBeDefined();
    const createFormatter = new Function(
      "state",
      String(functionSource ?? "") + "; return displayRepositoryEvidence;",
    ) as (state: {
      report: { repositoryRoot: string };
    }) => (value: string) => string;
    const formatEvidence = createFormatter({
      report: { repositoryRoot: "/Users/demo/repository" },
    });

    expect(
      formatEvidence(
        'Nearest package.json is "/Users/demo/repository/packages/api/package.json".',
      ),
    ).toBe('Nearest package.json is "packages/api/package.json".');
    expect(
      formatEvidence(
        'Repository root "/Users/demo/repository" contains "/Users/demo/repository/pnpm-lock.yaml".',
      ),
    ).toBe('Repository root "." contains "pnpm-lock.yaml".');
    expect(
      formatEvidence(
        'External path "/Users/demo/repository-other/secrets.txt" was rejected.',
      ),
    ).toBe('External path "~/repository-other/secrets.txt" was rejected.');
  });
});
