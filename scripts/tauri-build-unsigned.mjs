// Build a local desktop installer without an updater key or release signing.
//
// This is deliberately separate from `tauri:build`: a smoke-test package must
// not look update-ready or be mistaken for a distributable release artifact.

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cargoTargetDir = process.env.CARGO_TARGET_DIR
  ? resolve(repoRoot, process.env.CARGO_TARGET_DIR)
  : resolve(repoRoot, "src-tauri", "target");
const bundleDir = resolve(cargoTargetDir, "release", "bundle");
const tauriCli = resolve(repoRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
const checksumFile = resolve(bundleDir, "SHA256SUMS.txt");

const installerSuffixes = [".msi", "-setup.exe", ".dmg", ".deb", ".rpm", ".appimage"];

const unsignedConfig = {
  bundle: { createUpdaterArtifacts: false },
  plugins: { updater: { active: false, pubkey: "" } },
};

function printHelp() {
  console.log(`Build an unsigned local Verto installer.

Usage:
  npm run package:local
  npm run package:local:report

Options:
  --report-only  Report existing installers without rebuilding
  --help         Show this help

Local packages are unsigned and have the updater disabled.`);
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectRun(new Error(`Tauri build stopped by ${signal}.`));
        return;
      }
      if (code !== 0) {
        rejectRun(new Error(`Tauri build exited with code ${code ?? "unknown"}.`));
        return;
      }
      resolveRun();
    });
  });
}

async function walkFiles(directory) {
  const files = [];
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function isInstaller(path) {
  const normalized = path.toLowerCase();
  return installerSuffixes.some((suffix) => normalized.endsWith(suffix));
}

function displayPath(path, base = repoRoot) {
  return relative(base, path).split(sep).join("/");
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function sha256(path) {
  const hash = createHash("sha256");
  await new Promise((resolveHash, rejectHash) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", resolveHash);
    stream.once("error", rejectHash);
  });
  return hash.digest("hex").toUpperCase();
}

async function collectInstallers() {
  const paths = (await walkFiles(bundleDir)).filter(isInstaller).sort();
  return Promise.all(
    paths.map(async (path) => {
      const metadata = await stat(path);
      return {
        path,
        bytes: metadata.size,
        fingerprint: `${metadata.size}:${metadata.mtimeMs}`,
      };
    })
  );
}

async function snapshotInstallers() {
  const installers = await collectInstallers();
  return new Map(installers.map((installer) => [installer.path, installer.fingerprint]));
}

async function reportArtifacts(previousInstallers) {
  const installers = (await collectInstallers()).filter(
    (installer) =>
      previousInstallers === undefined ||
      previousInstallers.get(installer.path) !== installer.fingerprint
  );

  if (installers.length === 0) {
    throw new Error(
      previousInstallers === undefined
        ? `No installer artifacts found under ${displayPath(bundleDir)}. Run npm run package:local first.`
        : "The build completed but did not create or update an installer artifact."
    );
  }

  const artifacts = await Promise.all(
    installers.map(async (installer) => {
      return {
        path: installer.path,
        size: formatMiB(installer.bytes),
        sha256: await sha256(installer.path),
      };
    })
  );

  const checksums = artifacts
    .map((artifact) => `${artifact.sha256}  ${displayPath(artifact.path, bundleDir)}`)
    .join("\n");
  await writeFile(checksumFile, `${checksums}\n`, "utf8");

  console.log("\nLocal installer artifacts:");
  for (const artifact of artifacts) {
    console.log(`\n  ${displayPath(artifact.path)}`);
    console.log(`  Size:   ${artifact.size}`);
    console.log(`  SHA256: ${artifact.sha256}`);
  }
  console.log(`\nChecksums: ${displayPath(checksumFile)}`);
  console.log("These packages are unsigned and intended for local QA only.");
}

async function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has("--help")) {
    printHelp();
    return;
  }

  const unknownArgs = [...args].filter((arg) => arg !== "--report-only");
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown option: ${unknownArgs.join(", ")}. Use --help for usage.`);
  }

  if (!args.has("--report-only")) {
    try {
      await access(tauriCli);
    } catch {
      throw new Error("Tauri CLI is missing. Run npm install before packaging.");
    }

    console.log("Building an unsigned local installer (updater disabled).");
    const previousInstallers = await snapshotInstallers();
    await run(process.execPath, [tauriCli, "build", "--config", JSON.stringify(unsignedConfig)]);
    await reportArtifacts(previousInstallers);
    return;
  }

  await reportArtifacts();
}

main().catch((error) => {
  console.error(`\nPackaging failed: ${error.message}`);
  process.exitCode = 1;
});
