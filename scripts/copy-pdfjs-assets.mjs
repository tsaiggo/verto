// Self-host PDF.js assets for Web and packaged desktop use.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "node_modules/pdfjs-dist");
const destination = resolve(projectRoot, "public/pdfjs");
const worker = resolve(source, "build/pdf.worker.min.mjs");
if (!existsSync(worker)) throw new Error("PDF.js is missing. Run npm install first.");
mkdirSync(destination, { recursive: true });
cpSync(worker, resolve(destination, "pdf.worker.min.mjs"));
for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  if (existsSync(resolve(source, directory))) {
    cpSync(resolve(source, directory), resolve(destination, directory), { recursive: true });
  }
}
console.log("[copy-pdfjs-assets] Copied PDF.js worker, fonts and decoders.");
