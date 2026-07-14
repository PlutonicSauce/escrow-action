import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = resolve(projectRoot, "site");
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".css": "text/css; charset=utf-8" };

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readRequest(request) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; if (body.length > 4_096) request.destroy(); });
    request.on("end", () => resolveBody(body));
    request.on("error", reject);
  });
}

function isInsideProject(path) {
  const pathRelative = relative(projectRoot, path);
  return pathRelative === "" || (!pathRelative.startsWith("..") && !pathRelative.includes("../"));
}

async function runCheck(target) {
  const targetDirectory = resolve(projectRoot, target);
  if (!isInsideProject(targetDirectory)) throw new Error("Only repositories inside this Escrow checkout can be checked from the demo site.");
  await access(targetDirectory);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "escrow-site-"));
  const reportPath = join(temporaryDirectory, "report.json");
  try {
    const result = await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, ["dist/index.js", "check", targetDirectory, "--json", reportPath], { cwd: projectRoot, shell: false });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("error", reject);
      child.once("close", (exitCode) => resolveResult({ exitCode, stdout, stderr }));
    });
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    return { ...result, report };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "POST" && requestUrl.pathname === "/api/check") {
    try {
      const payload = JSON.parse(await readRequest(request));
      const target = typeof payload.target === "string" && payload.target.trim() ? payload.target.trim() : "demo/sample-monorepo";
      sendJson(response, 200, await runCheck(target));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  const relativePath = normalize(decodeURIComponent(requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname)).replace(/^[/\\]+/, "");
  const staticPath = resolve(siteRoot, relativePath);
  const fallbackPath = resolve(projectRoot, relativePath);
  const siteCandidate = isInsideProject(staticPath) ? staticPath : undefined;
  const projectCandidate = isInsideProject(fallbackPath) ? fallbackPath : undefined;
  if (siteCandidate === undefined && projectCandidate === undefined) { response.writeHead(403).end("Forbidden"); return; }
  try {
    let filePath = siteCandidate;
    if (filePath !== undefined) {
      try { await access(filePath); } catch { filePath = projectCandidate; }
    }
    if (filePath === undefined) throw new Error("Not found");
    await access(filePath);
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Escrow site: http://localhost:${port}\n`);
});
