import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(projectRoot, "demo", "sample-monorepo");
const demoRoot = join(projectRoot, ".escrow-demo");
const destination = join(demoRoot, "sample-monorepo");

function runGit(args) {
  const result = spawnSync("git", ["-C", destination, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const diagnostic = result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(" ")} failed: ${diagnostic}`);
  }
}

await rm(demoRoot, { recursive: true, force: true });
await mkdir(demoRoot, { recursive: true });
await cp(source, destination, { recursive: true });

runGit(["init", "--quiet"]);
runGit(["config", "user.name", "Escrow Demo"]);
runGit(["config", "user.email", "demo@example.invalid"]);
runGit(["add", "."]);
runGit(["commit", "--quiet", "-m", "broken demo baseline"]);

process.stdout.write(
  [
    `Reset broken demo repository: ${destination}`,
    "Start the UI with:",
    "  escrow ui .escrow-demo/sample-monorepo --model gpt-5.6-luna --execute",
    "",
  ].join("\n"),
);
