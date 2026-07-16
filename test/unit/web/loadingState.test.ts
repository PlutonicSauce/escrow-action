import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_JAVASCRIPT, INDEX_HTML } from "../../../src/web/assets.js";

class FakeClassList {
  public constructor(private readonly owner: FakeElement) {}

  private values(): Set<string> {
    return new Set(this.owner.className.split(/\s+/u).filter(Boolean));
  }

  private write(values: Set<string>): void {
    this.owner.className = [...values].join(" ");
  }

  public add(...names: string[]): void {
    const values = this.values();
    names.forEach((name) => values.add(name));
    this.write(values);
  }

  public remove(...names: string[]): void {
    const values = this.values();
    names.forEach((name) => values.delete(name));
    this.write(values);
  }

  public toggle(name: string, force?: boolean): boolean {
    const values = this.values();
    const enabled = force ?? !values.has(name);
    if (enabled) values.add(name);
    else values.delete(name);
    this.write(values);
    return enabled;
  }

  public contains(name: string): boolean {
    return this.values().has(name);
  }
}

class FakeElement {
  public className = "";
  public readonly classList = new FakeClassList(this);
  public readonly children: FakeElement[] = [];
  public value = "";
  public checked = false;
  public disabled = false;
  public type = "";
  public onclick?: () => unknown;
  public onchange?: () => unknown;
  private ownText = "";
  private readonly attributes = new Map<string, string>();

  public constructor(public readonly tagName = "div") {}

  public get textContent(): string {
    return this.children.length > 0
      ? this.children.map((child) => child.textContent).join("")
      : this.ownText;
  }

  public set textContent(value: string) {
    this.children.splice(0);
    this.ownText = value;
  }

  public append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  public replaceChildren(...children: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...children);
    this.ownText = "";
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

interface BrowserState {
  report: Report | null;
  scanBusy: boolean;
  repairBusy: boolean;
  operationTimer: ReturnType<typeof setInterval> | null;
}

interface BrowserApplication {
  state: BrowserState;
  scan: () => Promise<void>;
  previewRepair: () => Promise<void>;
}

interface Report {
  repositoryRoot: string;
  targetDirectory: string;
  overallStatus: "pass" | "fail";
  summary: Record<string, number>;
  claims: unknown[];
  instructionChain: unknown[];
}

interface ResponseLike {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

function response(body: unknown): ResponseLike {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function report(overallStatus: "pass" | "fail" = "pass"): Report {
  return {
    repositoryRoot: "/Users/example/work/sample-monorepo",
    targetDirectory: "/Users/example/work/sample-monorepo",
    overallStatus,
    summary: {
      passed: overallStatus === "pass" ? 1 : 0,
      failed: overallStatus === "fail" ? 1 : 0,
      warnings: 0,
      blocked: 0,
      inconclusive: 0,
      advisory: 0,
      overridden: 0,
    },
    claims: [],
    instructionChain: [],
  };
}

function createHarness(fetchImplementation: (path: string) => Promise<ResponseLike>): {
  app: BrowserApplication;
  elements: Map<string, FakeElement>;
  fetch: ReturnType<typeof vi.fn>;
} {
  const elements = new Map<string, FakeElement>();
  for (const match of INDEX_HTML.matchAll(/id="([^"]+)"/gu)) {
    elements.set(match[1] ?? "", new FakeElement());
  }
  const stages = elements.get("stages") as FakeElement;
  for (let index = 0; index < 5; index += 1) stages.append(new FakeElement("li"));
  const body = new FakeElement("body");
  const document = {
    body,
    getElementById: (id: string) => elements.get(id),
    createElement: (name: string) => new FakeElement(name),
    createTextNode: (text: string) => {
      const node = new FakeElement("#text");
      node.textContent = text;
      return node;
    },
  };
  const fetch = vi.fn(fetchImplementation);
  const createApplication = new Function(
    "document",
    "fetch",
    "setInterval",
    "clearInterval",
    "Date",
    `${APP_JAVASCRIPT}\nreturn {state,scan,previewRepair};`,
  ) as (
    documentValue: typeof document,
    fetchValue: typeof fetch,
    setIntervalValue: typeof setInterval,
    clearIntervalValue: typeof clearInterval,
    dateValue: DateConstructor,
  ) => BrowserApplication;
  const app = createApplication(document, fetch, setInterval, clearInterval, Date);
  return { app, elements, fetch };
}

async function settleLoad(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("local UI loading states", () => {
  it("starts one scan, shows honest elapsed progress, and clears its timer on success", async () => {
    vi.useFakeTimers();
    const check = deferred<ResponseLike>();
    const harness = createHarness(async (path) =>
      path === "/api/config"
        ? response({
            repository: "/Users/example/work/sample-monorepo",
            target: "/Users/example/work/sample-monorepo",
            model: "gpt-test",
            execute: false,
            allowNetwork: false,
            timeout: 120,
          })
        : check.promise,
    );
    await settleLoad();

    const running = harness.app.scan();
    void harness.app.scan();

    expect(harness.elements.get("scan")?.disabled).toBe(true);
    expect(harness.elements.get("scan")?.textContent).toContain("Scanning…");
    expect(harness.elements.get("overall-status")?.textContent).toBe("RUNNING");
    expect(harness.elements.get("scan-progress")?.getAttribute("aria-valuenow")).toBeNull();
    expect(harness.fetch.mock.calls.filter(([path]) => path === "/api/check")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(harness.elements.get("elapsed-message")?.textContent).toBe(
      "Scanning repository… 10s",
    );
    expect(harness.elements.get("helper-message")?.textContent).toBe(
      "Live extraction may take 10–20 seconds.",
    );
    expect(
      (harness.elements.get("stages") as FakeElement).children.every(
        (stage) => !stage.classList.contains("done"),
      ),
    ).toBe(true);

    check.resolve(response(report("pass")));
    await running;

    expect(vi.getTimerCount()).toBe(0);
    expect(harness.app.state.operationTimer).toBeNull();
    expect(harness.elements.get("scan")?.disabled).toBe(false);
    expect(harness.elements.get("scan")?.textContent).toBe("Scan instructions");
    expect(harness.elements.get("overall-status")?.textContent).toBe("PASS");
  });

  it("keeps prior results stale during refresh and available after a failed scan", async () => {
    vi.useFakeTimers();
    const check = deferred<ResponseLike>();
    const harness = createHarness(async (path) =>
      path === "/api/config"
        ? response({
            repository: "/Users/example/work/sample-monorepo",
            target: "/Users/example/work/sample-monorepo",
            model: "gpt-test",
            execute: false,
            allowNetwork: false,
            timeout: 120,
          })
        : check.promise,
    );
    await settleLoad();
    const previous = report("pass");
    harness.app.state.report = previous;
    const results = harness.elements.get("results") as FakeElement;
    results.classList.remove("hidden");
    const existingContent = new FakeElement();
    existingContent.textContent = "previous evidence";
    results.append(existingContent);
    const overall = harness.elements.get("overall-status") as FakeElement;
    overall.textContent = "PASS";
    overall.className = "overall-status pass";

    const running = harness.app.scan();
    expect(results.classList.contains("results-stale")).toBe(true);
    expect(results.getAttribute("aria-busy")).toBe("true");
    expect(harness.elements.get("results-updating")?.textContent).toBe(
      "Updating results…",
    );

    check.reject(new Error("temporary extraction failure"));
    await running;

    expect(vi.getTimerCount()).toBe(0);
    expect(harness.app.state.report).toBe(previous);
    expect(results.children).toContain(existingContent);
    expect(results.classList.contains("results-stale")).toBe(false);
    expect(results.getAttribute("aria-busy")).toBeNull();
    expect(harness.elements.get("results-updating")?.textContent).toContain(
      "previous verified results",
    );
    expect(harness.elements.get("overall-status")?.textContent).toBe("PASS");
    expect(harness.elements.get("message")?.textContent).toContain("Scan failed:");
  });

  it("protects repair preview from duplicates and clears repair loading on failure", async () => {
    vi.useFakeTimers();
    const preview = deferred<ResponseLike>();
    const harness = createHarness(async (path) =>
      path === "/api/config"
        ? response({
            repository: "/Users/example/work/sample-monorepo",
            target: "/Users/example/work/sample-monorepo",
            model: "gpt-test",
            execute: false,
            allowNetwork: false,
            timeout: 120,
          })
        : preview.promise,
    );
    await settleLoad();

    const running = harness.app.previewRepair();
    void harness.app.previewRepair();
    expect(harness.elements.get("preview-repair")?.disabled).toBe(true);
    expect(harness.elements.get("preview-repair")?.textContent).toContain(
      "Generating and verifying repair…",
    );
    expect(harness.fetch.mock.calls.filter(([path]) => path === "/api/fix/preview")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(harness.elements.get("elapsed-message")?.textContent).toBe(
      "Generating and verifying repair… 3s",
    );
    preview.reject(new Error("repair unavailable"));
    await running;

    expect(vi.getTimerCount()).toBe(0);
    expect(harness.app.state.operationTimer).toBeNull();
    expect(harness.elements.get("preview-repair")?.disabled).toBe(false);
    expect(harness.elements.get("preview-repair")?.textContent).toBe(
      "Preview instruction repair",
    );
    expect(harness.elements.get("message")?.textContent).toContain(
      "Repair preview rejected:",
    );
  });
});
