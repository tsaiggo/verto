import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop RSS capability", () => {
  it("allows user-selected http(s) RSS feeds in the desktop HTTP plugin", async () => {
    const file = await readFile(
      resolve(process.cwd(), "src-tauri/capabilities/default.json"),
      "utf8"
    );
    const capability = JSON.parse(file) as {
      permissions: Array<string | { identifier?: string; allow?: Array<{ url?: string }> }>;
    };
    const httpPermission = capability.permissions.find(
      (permission): permission is { identifier: string; allow: Array<{ url?: string }> } =>
        typeof permission !== "string" && permission.identifier === "http:default"
    );
    const urls = httpPermission?.allow.map((entry) => entry.url) ?? [];

    expect(urls).toEqual(
      expect.arrayContaining(["https://*", "https://*:*", "http://*", "http://*:*"])
    );
  });

  it("does not expose renderer filesystem or folder-picker capabilities", async () => {
    const [capabilityFile, packageFile, rustSource] = await Promise.all([
      readFile(resolve(process.cwd(), "src-tauri/capabilities/default.json"), "utf8"),
      readFile(resolve(process.cwd(), "package.json"), "utf8"),
      readFile(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8"),
    ]);
    const capability = JSON.parse(capabilityFile) as {
      permissions: Array<string | { identifier?: string }>;
    };
    const identifiers = capability.permissions.map((permission) =>
      typeof permission === "string" ? permission : (permission.identifier ?? "")
    );
    const packageJson = JSON.parse(packageFile) as { dependencies?: Record<string, string> };

    expect(identifiers.some((identifier) => identifier.startsWith("fs:"))).toBe(false);
    expect(identifiers).not.toContain("dialog:default");
    expect(identifiers).not.toContain("dialog:allow-open");
    expect(packageJson.dependencies).not.toHaveProperty("@tauri-apps/plugin-fs");
    expect(packageJson.dependencies).not.toHaveProperty("@tauri-apps/plugin-dialog");
    expect(rustSource).not.toContain("tauri_plugin_fs::init()");
  });
});
