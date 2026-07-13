// Build a local desktop installer without an updater key or release signing.
//
// This is deliberately separate from `tauri:build`: a smoke-test package must
// not look update-ready or be mistaken for a distributable release artifact.

import { spawn } from "node:child_process";

const unsignedConfig = {
  bundle: { createUpdaterArtifacts: false },
  plugins: { updater: { active: false, pubkey: "" } },
};

console.log("Building an unsigned local installer (updater disabled).");

const tauri = spawn(
  process.platform === "win32" ? "tauri.cmd" : "tauri",
  ["build", "--config", JSON.stringify(unsignedConfig)],
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
