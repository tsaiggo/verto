import { execFile as execFileCallback } from "node:child_process";
import { access, copyFile, mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const cacheDirectory = join(repoRoot, ".cache", "desktop-smoke", "edge-driver");
export const stableEdgeDriverPath = join(cacheDirectory, "msedgedriver.exe");
const fourPartVersionPattern = /^\d+\.\d+\.\d+\.\d+$/;
const registryPaths = [
  String.raw`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`,
  String.raw`HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`,
  String.raw`HKCU\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`,
];

function validFourPartVersion(value) {
  return value && fourPartVersionPattern.test(value) ? value : undefined;
}

async function detectWebView2Version() {
  for (const registryPath of registryPaths) {
    try {
      const { stdout } = await execFile("reg.exe", ["query", registryPath, "/v", "pv"], {
        encoding: "utf8",
      });
      const match = stdout.match(/pv\s+REG_SZ\s+([\d.]+)/);
      const version = validFourPartVersion(match?.[1]);
      // Edge uses 0.0.0.0 as an absent-runtime sentinel. Keep looking so a
      // valid per-user install can win over a stale machine registry entry.
      if (version && version !== "0.0.0.0") return version;
    } catch {
      // Try the next machine/user registry location.
    }
  }
  throw new Error("Could not detect the installed Microsoft Edge WebView2 runtime version.");
}

async function readDriverVersion(path) {
  try {
    const { stdout } = await execFile(path, ["--version"], {
      encoding: "utf8",
      timeout: 10_000,
    });
    return validFourPartVersion(
      stdout.match(/(?:MSEdgeDriver|Microsoft Edge WebDriver)\s+([\d.]+)/i)?.[1]
    );
  } catch {
    return undefined;
  }
}

function compatible(runtimeVersion, driverVersion) {
  if (!validFourPartVersion(runtimeVersion) || !validFourPartVersion(driverVersion)) {
    return false;
  }
  return (
    runtimeVersion.split(".").slice(0, 3).join(".") ===
    driverVersion?.split(".").slice(0, 3).join(".")
  );
}

async function downloadMatchingDriver(runtimeVersion) {
  async function prepareDriver(driverVersion) {
    const versionDirectory = join(cacheDirectory, driverVersion);
    const downloadedDriver = join(versionDirectory, "msedgedriver.exe");
    if (compatible(runtimeVersion, await readDriverVersion(downloadedDriver))) {
      await copyFile(downloadedDriver, stableEdgeDriverPath);
      return driverVersion;
    }

    await mkdir(versionDirectory, { recursive: true });
    const archivePath = join(versionDirectory, "edgedriver_win64.zip");
    console.log(`Downloading EdgeDriver ${driverVersion} for WebView2 ${runtimeVersion}.`);
    const archiveResponse = await fetch(
      `https://msedgedriver.microsoft.com/${driverVersion}/edgedriver_win64.zip`
    );
    if (archiveResponse.status === 404) return undefined;
    if (!archiveResponse.ok) {
      throw new Error(
        `Microsoft's EdgeDriver ${driverVersion} archive returned ${archiveResponse.status}.`
      );
    }
    await writeFile(archivePath, Buffer.from(await archiveResponse.arrayBuffer()), {
      flag: "w",
    });

    try {
      // Windows ships bsdtar, which extracts ZIP files without loading a user's
      // PowerShell profile. That avoids profile modules making CI/local driver
      // bootstrap nondeterministic.
      await execFile("tar.exe", ["-xf", archivePath, "-C", versionDirectory], {
        timeout: 60_000,
      });
    } finally {
      await unlink(archivePath).catch(() => undefined);
    }
    await access(downloadedDriver);
    const actualVersion = await readDriverVersion(downloadedDriver);
    if (!compatible(runtimeVersion, actualVersion)) {
      throw new Error(
        `Downloaded EdgeDriver ${actualVersion ?? "unknown"} does not match WebView2 ${runtimeVersion}.`
      );
    }
    await copyFile(downloadedDriver, stableEdgeDriverPath);
    return actualVersion;
  }

  // The major-version endpoint can outlive the archive it names. This is
  // observable on the Windows 2022 runner, where LATEST_RELEASE_131 points at
  // a removed patch while the exact WebView2 runtime archive remains
  // available. Prefer the exact runtime build so a clean runner is
  // deterministic and only consult the endpoint as a compatibility fallback.
  const exactVersion = await prepareDriver(runtimeVersion);
  if (exactVersion) return exactVersion;

  const major = runtimeVersion.split(".")[0]?.replace(/\D/g, "");
  if (!major) throw new Error(`Invalid WebView2 version: ${runtimeVersion}`);

  const releaseResponse = await fetch(`https://msedgedriver.microsoft.com/LATEST_RELEASE_${major}`);
  if (!releaseResponse.ok) {
    throw new Error(`Microsoft's EdgeDriver version endpoint returned ${releaseResponse.status}.`);
  }
  const releaseBytes = Buffer.from(await releaseResponse.arrayBuffer());
  const releaseVersion = (
    releaseBytes[0] === 0xff && releaseBytes[1] === 0xfe
      ? releaseBytes.subarray(2).toString("utf16le")
      : releaseBytes.toString("utf8")
  )
    .replaceAll("\0", "")
    .trim();
  const fallbackVersion = validFourPartVersion(releaseVersion);
  if (!fallbackVersion) {
    throw new Error("Microsoft's EdgeDriver version endpoint returned an invalid version.");
  }
  if (!compatible(runtimeVersion, fallbackVersion)) {
    throw new Error(
      `EdgeDriver ${fallbackVersion} does not match WebView2 ${runtimeVersion} through the build number.`
    );
  }

  const preparedFallbackVersion = await prepareDriver(fallbackVersion);
  if (preparedFallbackVersion) return preparedFallbackVersion;
  throw new Error(
    `Microsoft has no EdgeDriver archive for WebView2 ${runtimeVersion} or fallback ${fallbackVersion}.`
  );
}

if (process.platform !== "win32") {
  throw new Error("The desktop EdgeDriver bootstrap is Windows-only.");
}

await mkdir(cacheDirectory, { recursive: true });
const runtimeVersion = await detectWebView2Version();
const cachedVersion = await readDriverVersion(stableEdgeDriverPath);
const driverVersion = compatible(runtimeVersion, cachedVersion)
  ? cachedVersion
  : await downloadMatchingDriver(runtimeVersion);

await access(stableEdgeDriverPath);
console.log(`EdgeDriver ${driverVersion} is ready for WebView2 ${runtimeVersion}.`);
