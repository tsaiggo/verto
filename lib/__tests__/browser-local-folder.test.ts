import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BROWSER_LOCAL_INDEX_KEY,
  hasBrowserLocalFolder,
  loadBrowserLocalIndex,
} from "@/lib/browser-local-folder";

function storageWith(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("browser local folder index", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a valid cached browser-local index", () => {
    const index = {
      folder: "Browser folder",
      savedAt: 1_717_000_000_000,
      entries: [{ id: "browser-local:Browser%20folder/intro.md", path: ["intro.md"], size: 12 }],
    };
    vi.stubGlobal("window", {
      localStorage: storageWith({ [BROWSER_LOCAL_INDEX_KEY]: JSON.stringify(index) }),
    });

    expect(loadBrowserLocalIndex()).toEqual(index);
    expect(hasBrowserLocalFolder("Browser folder")).toBe(true);
    expect(hasBrowserLocalFolder("Other folder")).toBe(false);
  });

  it("returns null for malformed cached data", () => {
    vi.stubGlobal("window", {
      localStorage: storageWith({ [BROWSER_LOCAL_INDEX_KEY]: "{not-json" }),
    });

    expect(loadBrowserLocalIndex()).toBeNull();
    expect(hasBrowserLocalFolder()).toBe(false);
  });
});
