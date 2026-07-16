import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { request as httpRequest } from "node:http";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RepairCommandResult } from "../../../src/commands/fix.js";
import { renderJsonReport } from "../../../src/reporting/jsonReporter.js";
import {
  APPLY_CONFIRMATION,
  LOOPBACK_HOST,
  MAX_JSON_BODY_BYTES,
  startUiServer,
  type RunningUiServer,
} from "../../../src/web/server.js";
import {
  createReport,
  createValidatedClaim,
} from "../models/claimFixtures.js";

const temporaryDirectories: string[] = [];
const servers: RunningUiServer[] = [];

async function createRepository(): Promise<string> {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "agentcontract-ui-test-")),
  );
  temporaryDirectories.push(directory);
  await mkdir(join(directory, ".git"));
  await writeFile(join(directory, "AGENTS.md"), "Use npm for this repository.\n", "utf8");
  await writeFile(join(directory, "package-lock.json"), "{}\n", "utf8");
  return directory;
}

async function start(
  repository: string,
  dependencies: Parameters<typeof startUiServer>[1] = {},
): Promise<RunningUiServer> {
  const server = await startUiServer({ repository, port: 0, model: "gpt-test" }, dependencies);
  servers.push(server);
  return server;
}

async function post(url: string, path: string, body: unknown, contentType = "application/json") {
  return fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => server.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("local UI server", () => {
  it("starts on loopback, serves the SPA, exposes config, and shuts down", async () => {
    const repository = await createRepository();
    const server = await start(repository);

    expect(server.host).toBe(LOOPBACK_HOST);
    expect(server.url).toBe(`http://127.0.0.1:${String(server.port)}`);
    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(await page.text()).toContain("Instruction integrity");
    const configResponse = await fetch(`${server.url}/api/config`);
    expect(configResponse.headers.get("access-control-allow-origin")).toBeNull();
    await expect(configResponse.json()).resolves.toMatchObject({
      repository,
      target: repository,
      model: "gpt-test",
      execute: false,
      allowNetwork: false,
      timeout: 120,
      version: "0.1.0",
    });

    await server.close();
    servers.splice(servers.indexOf(server), 1);
    await expect(fetch(server.url)).rejects.toThrow();
  });

  it("returns the shared report and all three shared renderer downloads", async () => {
    const repository = await createRepository();
    const report = createReport([
      createValidatedClaim({ status: "failed", evidence: ["missing"] }),
      createValidatedClaim({ id: "pass", status: "passed" }),
    ]);
    const evaluate = vi.fn().mockResolvedValue(report);
    const server = await start(repository, { evaluate });

    const response = await post(server.url, "/api/check", {
      target: repository,
      model: "gpt-test",
      execute: false,
      allowNetwork: false,
      timeout: 12,
    });
    expect(response.status).toBe(200);
    const uiReport = await response.json();
    expect(uiReport.summary).toEqual(report.summary);
    expect(uiReport.overallStatus).toBe(report.overallStatus);
    expect(evaluate).toHaveBeenCalledWith(repository, {
      target: repository,
      model: "gpt-test",
      execute: false,
      allowNetwork: false,
      timeout: 12,
    });

    const json = await fetch(`${server.url}/api/report?format=json`);
    expect(await json.text()).toBe(renderJsonReport(report));
    expect(json.headers.get("content-disposition")).toContain("escrow-report.json");
    const markdown = await fetch(`${server.url}/api/report?format=markdown`);
    expect(await markdown.text()).toContain("# Escrow Report");
    const html = await fetch(`${server.url}/api/report?format=html`);
    expect(await html.text()).toContain("<!doctype html>");
  });

  it("rejects malformed, non-JSON, oversized, and browser-supplied repository input", async () => {
    const repository = await createRepository();
    const evaluate = vi.fn().mockResolvedValue(createReport([]));
    const server = await start(repository, { evaluate });

    expect((await post(server.url, "/api/check", "{", "application/json")).status).toBe(400);
    expect((await post(server.url, "/api/check", {}, "text/plain")).status).toBe(415);
    expect(
      (
        await post(
          server.url,
          "/api/check",
          JSON.stringify({ model: "x".repeat(MAX_JSON_BODY_BYTES + 1) }),
        )
      ).status,
    ).toBe(413);
    const suppliedRepository = await post(server.url, "/api/check", {
      repository: "/tmp/not-allowed",
    });
    expect(suppliedRepository.status).toBe(400);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("rejects non-loopback Host headers to prevent DNS-rebinding access", async () => {
    const repository = await createRepository();
    const server = await start(repository);

    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = httpRequest(`${server.url}/api/config`, {
        headers: { host: "attacker.example" },
      }, (incoming) => {
        let body = "";
        incoming.setEncoding("utf8");
        incoming.on("data", (chunk: string) => {
          body += chunk;
        });
        incoming.on("end", () => {
          resolve({ status: incoming.statusCode ?? 0, body });
        });
      });
      request.on("error", reject);
      request.end();
    });

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({
      error: "The local UI accepts requests only for 127.0.0.1.",
    });
  });

  it("rejects a target outside the repository before extraction", async () => {
    const repository = await createRepository();
    const outside = await mkdtemp(join(tmpdir(), "agentcontract-ui-outside-"));
    temporaryDirectories.push(outside);
    const server = await start(repository);

    const response = await post(server.url, "/api/check", { target: outside });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("outside") });
  });

  it("never interpolates repository data into static HTML and safely escapes report HTML", async () => {
    const repository = await createRepository();
    const unsafe = `<script>alert("repository")</script>`;
    const report = {
      ...createReport([
        createValidatedClaim({ originalText: unsafe, evidence: [unsafe] }),
      ]),
      repositoryRoot: unsafe,
    };
    const server = await start(repository, { evaluate: async () => report });

    const page = await fetch(server.url);
    expect(await page.text()).not.toContain(unsafe);
    await post(server.url, "/api/check", {});
    const html = await fetch(`${server.url}/api/report?format=html`);
    const output = await html.text();
    expect(output).not.toContain(unsafe);
    expect(output).toContain("&lt;script&gt;alert(&quot;");
  });

  it("applies only the matching previously verified preview after explicit confirmation", async () => {
    const repository = await createRepository();
    const beforeReport = createReport([createValidatedClaim({ status: "failed" })]);
    const afterReport = createReport([createValidatedClaim({ status: "passed" })]);
    const repairResult: RepairCommandResult = {
      beforeReport,
      afterReport,
      patch: "diff --git a/AGENTS.md b/AGENTS.md\n",
      changedFiles: ["AGENTS.md"],
      applied: false,
    };
    const applyRepair = vi.fn().mockResolvedValue(undefined);
    const server = await start(repository, {
      previewRepair: async () => repairResult,
      applyRepair,
      createId: () => "123e4567-e89b-42d3-a456-426614174000",
    });

    const previewResponse = await post(server.url, "/api/fix/preview", {});
    const preview = await previewResponse.json();
    expect(preview).toMatchObject({ verified: true, changedFiles: ["AGENTS.md"] });
    const latestReport = await fetch(`${server.url}/api/report?format=json`);
    expect((await latestReport.json()).summary).toEqual(afterReport.summary);
    expect((await post(server.url, "/api/fix/apply", { previewId: preview.previewId })).status).toBe(400);
    expect(
      (
        await post(server.url, "/api/fix/apply", {
          previewId: "00000000-0000-4000-8000-000000000000",
          confirmation: APPLY_CONFIRMATION,
        })
      ).status,
    ).toBe(409);
    const applied = await post(server.url, "/api/fix/apply", {
      previewId: preview.previewId,
      confirmation: APPLY_CONFIRMATION,
    });
    expect(applied.status).toBe(200);
    expect(applyRepair).toHaveBeenCalledOnce();
    expect(applyRepair).toHaveBeenCalledWith(repository, repairResult.patch);
    expect(
      (
        await post(server.url, "/api/fix/apply", {
          previewId: preview.previewId,
          confirmation: APPLY_CONFIRMATION,
        })
      ).status,
    ).toBe(409);
  });

  it("rejects a preview that contains a forbidden changed file", async () => {
    const repository = await createRepository();
    const report = createReport([createValidatedClaim({ status: "failed" })]);
    const server = await start(repository, {
      previewRepair: async () => ({
        beforeReport: report,
        afterReport: report,
        patch: "diff --git a/package.json b/package.json\n",
        changedFiles: ["package.json"],
        applied: false,
      }),
    });

    const response = await post(server.url, "/api/fix/preview", {});

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("instruction-only") });
  });

});
