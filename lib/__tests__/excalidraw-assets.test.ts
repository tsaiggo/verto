import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), "utf-8");
}

describe("Excalidraw self-hosted assets", () => {
  it("does not point the asset path at a remote CDN", async () => {
    const source = await readProjectFile("components/mdx/Excalidraw.tsx");
    expect(source).not.toContain("unpkg.com");
    expect(source).not.toContain("cdn.jsdelivr.net");
  });

  it("serves Excalidraw assets from a same-origin public path", async () => {
    const source = await readProjectFile("components/mdx/Excalidraw.tsx");
    expect(source).toContain("/excalidraw-assets/");
  });

  it("wires the copy step into the build via package.json", async () => {
    const pkg = JSON.parse(await readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["copy:excalidraw-assets"]).toBe("node scripts/copy-excalidraw-assets.mjs");
    expect(pkg.scripts.predev).toContain("copy:excalidraw-assets");
    expect(pkg.scripts.prebuild).toContain("copy:excalidraw-assets");
    expect(pkg.scripts["prebuild:tauri"]).toContain("copy:excalidraw-assets");
  });

  it("ships a cross-platform copy script that vendors dist/prod", async () => {
    const script = await readProjectFile("scripts/copy-excalidraw-assets.mjs");
    expect(script).toContain("dist/prod");
    expect(script).toContain("public/excalidraw-assets");
    expect(script).toContain("cpSync");
  });
});
