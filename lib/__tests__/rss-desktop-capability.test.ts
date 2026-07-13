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
});
