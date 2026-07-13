import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), "utf-8");
}

describe("release update channels", () => {
  it("keeps development on nightly but stamps stable installers with the published channel", async () => {
    const [tauriConfig, releaseWorkflow] = await Promise.all([
      readProjectFile("src-tauri/tauri.conf.json"),
      readProjectFile(".github/workflows/release.yml"),
    ]);

    expect(tauriConfig).toContain(
      "https://github.com/tsaiggo/verto/releases/download/nightly/latest.json"
    );
    expect(releaseWorkflow).toMatch(
      /TAURI_CONFIG:\s*>-\s*\n\s*\{"plugins":\{"updater":\{"endpoints":\["https:\/\/github\.com\/tsaiggo\/verto\/releases\/latest\/download\/latest\.json"\]\}\}\}/
    );
  });
});
