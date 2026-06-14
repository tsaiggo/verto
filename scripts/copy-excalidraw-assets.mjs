// Vendor the Excalidraw production asset bundle (fonts + font-subset workers)
// into `public/` so the app self-hosts them instead of fetching from a CDN at
// runtime.
//
// Excalidraw loads its fonts and the `subset-worker` / `subset-shared` chunks
// relative to `window.EXCALIDRAW_ASSET_PATH`, which upstream defaults to a
// public CDN. In an offline or firewalled environment — notably the packaged
// desktop app — those fetches blackhole and diagrams hang forever on
// "Loading…". Copying the whole `dist/prod` folder under
// `public/excalidraw-assets/` lets us point the asset path at a same-origin URL
// that always resolves. The entire folder is copied (not just `fonts/`) because
// the worker chunks are themselves loaded relative to the asset path.
//
// Runs automatically before `dev` / `build` / `build:tauri` via npm `pre*`
// hooks (see package.json). Uses Node's `fs.cpSync` rather than a shell `cp` so
// it behaves identically on Windows, macOS and Linux / CI.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "node_modules/@excalidraw/excalidraw/dist/prod");
const destination = resolve(projectRoot, "public/excalidraw-assets");

if (!existsSync(source)) {
  console.error(
    `[copy-excalidraw-assets] Source not found: ${source}\n` +
      "Is @excalidraw/excalidraw installed? Run `npm install` first."
  );
  process.exit(1);
}

rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });

console.log(`[copy-excalidraw-assets] Copied ${source} -> ${destination}`);
