import { describe, expect, it } from "vitest";

import { containsCheckoutFilterDirective } from "../../../src/execution/gitAttributes.js";

describe("containsCheckoutFilterDirective", () => {
  it.each([
    "*.bin filter=lfs",
    "*.dat filter",
    "*.txt -filter",
    "*.txt !filter",
    "[attr]generated filter=custom -text",
  ])("detects checkout filter attribute %s", (content) => {
    expect(containsCheckoutFilterDirective(content)).toBe(true);
  });

  it.each([
    "# *.bin filter=lfs",
    "*.txt text eol=lf",
    "docs/filter.md linguist-documentation",
    "",
  ])("allows non-filter attribute %s", (content) => {
    expect(containsCheckoutFilterDirective(content)).toBe(false);
  });
});
