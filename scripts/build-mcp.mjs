// Bundle the same headless content service used by the in-app Agent into a
// standalone Node companion. Installed desktop clients need no node_modules.
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await build({
  absWorkingDir: root,
  entryPoints: ["scripts/verto-mcp.ts"],
  outfile: "src-tauri/resources/mcp/verto-mcp.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20.19",
  banner: {
    js: 'import { createRequire as __vertoCreateRequire } from "node:module"; const require = __vertoCreateRequire(import.meta.url);',
  },
  logLevel: "info",
});
