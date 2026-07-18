import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

const GLOBAL_STYLE_FILES = [
  "globals.css",
  "redesign.css",
  "polish.css",
  "codex-clone.css",
  "codex-desktop.css",
  "codex-content.css",
] as const;

const LEGACY_WORKBENCH_MARKER = "Restrained desktop workbench";
const LEGACY_WORKBENCH_END = ".vx-skip-link";
const LEGACY_WORKBENCH_TOKENS = ["--vx-shell-inset", "--vx-main-radius"];

const CANONICAL_TOKEN_OWNERS = {
  "--vx-canvas": "codex-clone.css",
  "--vx-surface": "codex-clone.css",
  "--vx-panel": "codex-clone.css",
  "--vx-border": "codex-clone.css",
  "--vx-border-card": "codex-clone.css",
  "--vx-border-soft": "codex-clone.css",
  "--vx-border-strong": "codex-clone.css",
  "--vx-ink": "codex-clone.css",
  "--vx-ink-2": "codex-clone.css",
  "--vx-muted": "codex-clone.css",
  "--vx-faint": "codex-clone.css",
  "--vx-rail-active": "codex-clone.css",
  "--vx-hover": "codex-clone.css",
  "--vx-page-identity-h": "codex-clone.css",
  "--vx-tabs-h": "codex-clone.css",
  "--vx-context-w": "codex-clone.css",
  "--vx-rail-w": "codex-desktop.css",
  "--vx-desktop-chrome-h": "codex-desktop.css",
  "--vx-topbar-h": "codex-desktop.css",
  "--vx-page-pad": "codex-desktop.css",
  "--titlebar-h": "codex-desktop.css",
} as const;

async function readGlobalStyles() {
  return Promise.all(
    GLOBAL_STYLE_FILES.map(async (file) => ({
      file,
      css: await fs.readFile(path.join(process.cwd(), "app", file), "utf8"),
    }))
  );
}

describe("Codex CSS token contract", () => {
  it("keeps control colors separate from control dimensions", async () => {
    const styles = await readGlobalStyles();

    const controlColors = styles.flatMap(({ file, css }) =>
      [...css.matchAll(/--codex-control:\s*([^;]+);/g)].map((match) => ({
        file,
        value: match[1]?.trim(),
      }))
    );
    const controlSizes = styles.flatMap(({ file, css }) =>
      [...css.matchAll(/--codex-control-size:\s*([^;]+);/g)].map((match) => ({
        file,
        value: match[1]?.trim(),
      }))
    );

    expect(controlColors).toEqual([
      { file: "codex-clone.css", value: "#f4f4f4" },
      { file: "codex-clone.css", value: "#2a2a2a" },
    ]);
    expect(controlSizes).toEqual([{ file: "codex-desktop.css", value: "32px" }]);
  });

  it("keeps the legacy workbench block limited to tokens it still owns", async () => {
    const redesign = await fs.readFile(path.join(process.cwd(), "app", "redesign.css"), "utf8");
    const start = redesign.indexOf(LEGACY_WORKBENCH_MARKER);
    const end = redesign.indexOf(LEGACY_WORKBENCH_END, start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const workbenchTokens = [...redesign.slice(start, end).matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
      (match) => match[1]
    );

    expect(workbenchTokens).toEqual(LEGACY_WORKBENCH_TOKENS);
  });

  it("loads the canonical owner after every retired workbench token", async () => {
    const layout = await fs.readFile(path.join(process.cwd(), "app", "layout.tsx"), "utf8");
    const styles = await readGlobalStyles();
    let previousImport = -1;

    for (const file of GLOBAL_STYLE_FILES) {
      const importIndex = layout.indexOf(`import "@/app/${file}"`);
      expect(importIndex).toBeGreaterThan(previousImport);
      previousImport = importIndex;
    }

    const finalOwners = Object.fromEntries(
      Object.keys(CANONICAL_TOKEN_OWNERS).map((token) => {
        const owner = [...styles].reverse().find(({ css }) => css.includes(`${token}:`))?.file;
        return [token, owner];
      })
    );

    expect(finalOwners).toEqual(CANONICAL_TOKEN_OWNERS);
  });
});
