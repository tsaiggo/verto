// Build a local desktop installer without an updater key or release signing.
//
// This is deliberately separate from `tauri:build`: a smoke-test package must
// not look update-ready or be mistaken for a distributable release artifact.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const unsignedConfig = {
  bundle: { createUpdaterArtifacts: false },
  plugins: { updater: { active: false, pubkey: "" } },
};

console.log("Building an unsigned local installer (updater disabled).");

const tauriCli = fileURLToPath(
  new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url)
);

const tauri = spawn(
  process.execPath,
  [tauriCli, "build", "--config", JSON.stringify(unsignedConfig)],
  {
    env: process.env,
    stdio: "inherit",
  }
);

tauri.on("error", (error) => {
  console.error(`Could not start the Tauri build: ${error.message}`);
  process.exitCode = 1;
});

tauri.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Tauri build stopped by ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
