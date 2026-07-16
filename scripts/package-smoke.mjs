import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const canonicalProjectRoot = await realpath(projectRoot);
const temporaryRoot = await mkdtemp(join(tmpdir(), "escrow-package-smoke-"));
const packageDirectory = join(temporaryRoot, "package");
const installDirectory = join(temporaryRoot, "install");
const cacheDirectory = join(temporaryRoot, "npm-cache");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: cacheDirectory,
      npm_config_audit: "false",
      npm_config_fund: "false",
    },
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed:\n${output}`);
  }
  return result.stdout.trim();
}

function isInside(parent, candidate) {
  const path = relative(resolve(parent), resolve(candidate));
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

try {
  await mkdir(packageDirectory, { recursive: true });
  await mkdir(installDirectory, { recursive: true });
  await writeFile(
    join(installDirectory, "package.json"),
    `${JSON.stringify({ name: "escrow-package-smoke", private: true }, null, 2)}\n`,
    "utf8",
  );

  run("npm", ["run", "build"]);
  const packOutput = run("npm", [
    "pack",
    "--json",
    "--pack-destination",
    packageDirectory,
  ]);
  const packResult = JSON.parse(packOutput);
  const packed = packResult[0];
  if (packed === undefined || typeof packed.filename !== "string") {
    throw new Error("npm pack did not return a package filename.");
  }

  const requiredFiles = new Set([
    "dist/index.js",
    "schemas/claims.schema.json",
    "schemas/repair.schema.json",
    "package.json",
    "README.md",
    "LICENSE",
  ]);
  const packedFiles = new Set(
    Array.isArray(packed.files)
      ? packed.files.map((file) => file.path)
      : [],
  );
  for (const path of requiredFiles) {
    if (!packedFiles.has(path)) {
      throw new Error(`Packed artifact is missing required file: ${path}`);
    }
  }

  const tarball = join(packageDirectory, packed.filename);
  await access(tarball);
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarball,
    ],
    { cwd: installDirectory },
  );

  const installedPackage = await realpath(
    join(installDirectory, "node_modules", "escrow"),
  );
  const installedBinary = await realpath(
    join(installDirectory, "node_modules", ".bin", "escrow"),
  );
  if (!isInside(installedPackage, installedBinary)) {
    throw new Error(`Installed binary resolved outside the installed package: ${installedBinary}`);
  }
  if (isInside(canonicalProjectRoot, installedBinary)) {
    throw new Error("Installed binary unexpectedly depends on the original checkout.");
  }

  await Promise.all([
    access(join(installedPackage, "dist", "index.js")),
    access(join(installedPackage, "schemas", "claims.schema.json")),
    access(join(installedPackage, "schemas", "repair.schema.json")),
    access(join(installedPackage, "README.md")),
    access(join(installedPackage, "LICENSE")),
  ]);

  const installedManifest = JSON.parse(
    await readFile(join(installedPackage, "package.json"), "utf8"),
  );
  const help = run(installedBinary, ["--help"], { cwd: installDirectory });
  const version = run(installedBinary, ["--version"], { cwd: installDirectory });
  if (!help.includes("Usage: escrow")) {
    throw new Error("Installed escrow --help did not render the CLI usage.");
  }
  if (version !== installedManifest.version) {
    throw new Error(
      `Installed version ${version} did not match package version ${installedManifest.version}.`,
    );
  }

  process.stdout.write(
    [
      `Packed artifact: ${packed.filename}`,
      `Installed binary: ${installedBinary}`,
      `Installed version: ${version}`,
      "Package smoke test passed outside the original checkout.",
      "",
    ].join("\n"),
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
