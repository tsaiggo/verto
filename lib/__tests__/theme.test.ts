import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  persistThemeChoice,
  readThemeChoice,
  resolveThemeChoice,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

function makeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("theme persistence", () => {
  let originalWindow: unknown;
  let storage: Storage;

  beforeEach(() => {
    originalWindow = (globalThis as { window?: unknown }).window;
    storage = makeStorage();
    (globalThis as { window?: { localStorage: Storage } }).window = { localStorage: storage };
  });

  afterEach(() => {
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
  });

  it("round-trips fixed choices and removes the key for system", () => {
    persistThemeChoice("dark");
    expect(readThemeChoice()).toBe("dark");
    persistThemeChoice("system");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readThemeChoice()).toBe("system");
  });

  it("falls back to system when storage cannot be read", () => {
    storage.getItem = () => {
      throw new Error("storage disabled");
    };
    expect(readThemeChoice()).toBe("system");
  });

  it("surfaces failed writes instead of reporting a false success", () => {
    storage.setItem = () => {
      throw new Error("quota exceeded");
    };
    expect(() => persistThemeChoice("dark")).toThrow("quota exceeded");
  });

  it("resolves system appearance without requiring a browser media query", () => {
    expect(resolveThemeChoice("system", false)).toBe("light");
    expect(resolveThemeChoice("system", true)).toBe("dark");
    expect(resolveThemeChoice("light", true)).toBe("light");
  });

  it("accepts a theme mutation that applied before a mirror error", () => {
    const apply = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      apply(key, value);
      throw new Error("mirror failed");
    };

    expect(() => persistThemeChoice("dark")).not.toThrow();
    expect(readThemeChoice()).toBe("dark");
  });

  it("rejects a silent theme write that did not change storage", () => {
    storage.setItem = () => {};

    expect(() => persistThemeChoice("dark")).toThrow("Theme choice was not persisted.");
    expect(readThemeChoice()).toBe("system");
  });
});
