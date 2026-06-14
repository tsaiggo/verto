import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), "utf-8");
}

describe("Tauri static export config", () => {
  it("does not use document-relative asset prefixes for deep reader routes", async () => {
    const config = await readProjectFile("next.config.ts");

    expect(config).not.toContain("assetPrefix: './'");
    expect(config).not.toContain('assetPrefix: "./"');
  });
});
