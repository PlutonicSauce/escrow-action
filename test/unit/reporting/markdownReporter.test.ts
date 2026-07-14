import { describe, expect, it } from "vitest";

import { renderMarkdownReport } from "../../../src/reporting/markdownReporter.js";
import { createEmptyReport, createRichReport } from "./reportFixture.js";

describe("renderMarkdownReport", () => {
  it("renders a submission-ready report with all shared report sections", () => {
    const output = renderMarkdownReport(createRichReport());

    expect(output).toContain("# Escrow Report");
    expect(output).toContain("**Overall status: FAIL**");
    expect(output).toContain("## Instruction chain");
    expect(output).toContain("packages/api/AGENTS.override.md");
    expect(output).toContain("## Claims");
    expect(output).toContain("AGENTS.md:7-9");
    expect(output).toContain("**Original instruction**");
    expect(output).toContain("**Normalized claim**");
    expect(output).toContain("**Deterministic evidence**");
    expect(output).toContain("**Suggestion:**");
    expect(output).toContain("## Overrides");
    expect(output).toContain("AGENTS.md:14");
    expect(output).toContain("## Conflicts");
    expect(output).toContain("packages/api/AGENTS.md:18");
    expect(output).toContain("packages/api/AGENTS.override.md:4-5");
  });

  it("uses expandable command output and preserves multiline streams safely", () => {
    const output = renderMarkdownReport(createRichReport());

    expect(output).toContain("<details>");
    expect(output).toContain("<summary>Command output</summary>");
    expect(output).toContain(
      "first stdout line\nsecond &lt;script&gt;stdout&lt;/script&gt; line",
    );
    expect(output).toContain(
      "first stderr line\n&lt;/details&gt;&lt;script&gt;stderr&lt;/script&gt;",
    );
    expect(output).toContain("````markdown");
    expect(output).not.toContain(
      "Path <docs/missing.md> does not exist & cannot be validated.",
    );
    expect(output).toContain(
      "Path &lt;docs/missing\\.md&gt; does not exist &amp; cannot be validated\\.",
    );
  });

  it("renders an empty report without omitting required sections", () => {
    const output = renderMarkdownReport(createEmptyReport());

    expect(output).toContain("**Overall status: PASS**");
    expect(output).toContain("| Passed | 0 |");
    expect(output).toContain("No instruction files were discovered.");
    expect(output).toContain("No claims were extracted.");
    expect(output).toContain("No claims were overridden.");
    expect(output).toContain("No instruction conflicts were detected.");
  });
});
