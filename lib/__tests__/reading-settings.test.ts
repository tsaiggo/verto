import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  applySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  parseSettings,
  READING_SETTINGS_INIT_SCRIPT,
  saveSettings,
  STORAGE_KEY,
} from "@/lib/reading-settings";

// Minimal stand-in for the subset of HTMLElement that applySettings touches.
// Keeps the tests runnable under vitest's default `node` environment without
// pulling in jsdom / happy-dom as a dependency.
function makeFakeElement() {
  const attrs = new Map<string, string>();
  return {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    getAttribute(name: string): string | null {
      return attrs.has(name) ? (attrs.get(name) as string) : null;
    },
    hasAttribute(name: string): boolean {
      return attrs.has(name);
    },
  };
}

function makeFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

describe("reading-settings", () => {
  describe("normalizeSettings", () => {
    it("returns defaults for empty / null / undefined input", () => {
      expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
      expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
      expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    });

    it("keeps valid values", () => {
      expect(
        normalizeSettings({
          width: "wide",
          density: "compact",
          textSize: "large",
          font: "serif",
        })
      ).toEqual({
        width: "wide",
        density: "compact",
        textSize: "large",
        font: "serif",
      });
    });

    it("coerces invalid values back to defaults", () => {
      expect(
        normalizeSettings({
          width: "enormous",
          density: 42,
          textSize: "huge",
          font: null,
        })
      ).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe("parseSettings", () => {
    it("returns defaults on null / empty / malformed input", () => {
      expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
      expect(parseSettings("")).toEqual(DEFAULT_SETTINGS);
      expect(parseSettings("not-json")).toEqual(DEFAULT_SETTINGS);
    });

    it("parses a valid JSON payload", () => {
      const json = JSON.stringify({ width: "narrow", textSize: "small" });
      expect(parseSettings(json)).toEqual({
        ...DEFAULT_SETTINGS,
        width: "narrow",
        textSize: "small",
      });
    });
  });

  describe("applySettings", () => {
    it("omits attributes for default values", () => {
      const el = makeFakeElement();
      applySettings(DEFAULT_SETTINGS, el as unknown as HTMLElement);
      expect(el.hasAttribute("data-reading-width")).toBe(false);
      expect(el.hasAttribute("data-density")).toBe(false);
      expect(el.hasAttribute("data-text-size")).toBe(false);
      expect(el.hasAttribute("data-font")).toBe(false);
    });

    it("writes attributes for non-default values", () => {
      const el = makeFakeElement();
      applySettings(
        {
          width: "narrow",
          density: "compact",
          textSize: "large",
          font: "serif",
        },
        el as unknown as HTMLElement
      );
      expect(el.getAttribute("data-reading-width")).toBe("narrow");
      expect(el.getAttribute("data-density")).toBe("compact");
      expect(el.getAttribute("data-text-size")).toBe("large");
      expect(el.getAttribute("data-font")).toBe("serif");
    });

    it("removes attributes when reverted back to defaults", () => {
      const el = makeFakeElement();
      applySettings(
        {
          width: "narrow",
          density: "compact",
          textSize: "large",
          font: "serif",
        },
        el as unknown as HTMLElement
      );
      applySettings(DEFAULT_SETTINGS, el as unknown as HTMLElement);
      expect(el.hasAttribute("data-reading-width")).toBe(false);
      expect(el.hasAttribute("data-density")).toBe(false);
      expect(el.hasAttribute("data-text-size")).toBe(false);
      expect(el.hasAttribute("data-font")).toBe(false);
    });
  });

  describe("load / save (localStorage)", () => {
    let storage: Storage;
    let originalWindow: unknown;

    beforeEach(() => {
      storage = makeFakeStorage();
      originalWindow = (globalThis as { window?: unknown }).window;
      // Install a minimal `window` shim so the SSR-guarded helpers exercise
      // their real localStorage paths in the node test environment.
      (globalThis as { window?: { localStorage: Storage } }).window = {
        localStorage: storage,
      };
    });
    afterEach(() => {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    });

    it("returns defaults when nothing is stored", () => {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it("round-trips a non-default settings object", () => {
      const custom = {
        width: "narrow" as const,
        density: "spacious" as const,
        textSize: "large" as const,
        font: "mono" as const,
      };
      saveSettings(custom);
      expect(loadSettings()).toEqual(custom);
    });

    it("clears the storage key when settings match defaults", () => {
      storage.setItem(STORAGE_KEY, JSON.stringify({ width: "wide" }));
      saveSettings(DEFAULT_SETTINGS);
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("READING_SETTINGS_INIT_SCRIPT", () => {
    it("is a non-empty string referencing the storage key", () => {
      expect(typeof READING_SETTINGS_INIT_SCRIPT).toBe("string");
      expect(READING_SETTINGS_INIT_SCRIPT.length).toBeGreaterThan(0);
      expect(READING_SETTINGS_INIT_SCRIPT).toContain(STORAGE_KEY);
    });

    it("mentions every settings attribute it has to apply", () => {
      for (const attr of ["data-reading-width", "data-density", "data-text-size", "data-font"]) {
        expect(READING_SETTINGS_INIT_SCRIPT).toContain(attr);
      }
    });

    it("is wrapped in try/catch so it cannot throw at boot", () => {
      expect(READING_SETTINGS_INIT_SCRIPT).toMatch(/try\s*\{/);
      expect(READING_SETTINGS_INIT_SCRIPT).toMatch(/catch/);
    });

    it("applies persisted attributes via a fake DOM when executed", () => {
      const el = makeFakeElement();
      const storage = makeFakeStorage();
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          width: "narrow",
          density: "compact",
          textSize: "small",
          font: "serif",
        })
      );

      // The inline script references `document` and `localStorage` as
      // globals; shadow them as Function parameters so we don't have to
      // mutate the surrounding test environment.
      const fn = new Function("document", "localStorage", READING_SETTINGS_INIT_SCRIPT);
      expect(() => fn({ documentElement: el }, storage)).not.toThrow();

      expect(el.getAttribute("data-reading-width")).toBe("narrow");
      expect(el.getAttribute("data-density")).toBe("compact");
      expect(el.getAttribute("data-text-size")).toBe("small");
      expect(el.getAttribute("data-font")).toBe("serif");
    });

    it("does not throw on malformed storage", () => {
      const storage = makeFakeStorage();
      storage.setItem(STORAGE_KEY, "{not json");
      const fn = new Function("document", "localStorage", READING_SETTINGS_INIT_SCRIPT);
      expect(() => fn({ documentElement: makeFakeElement() }, storage)).not.toThrow();
    });
  });
});
