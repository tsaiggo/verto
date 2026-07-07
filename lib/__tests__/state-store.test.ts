// State-store unit tests.
//
// vitest environment: "node" — localStorage is NOT available without mocking.
// All window/localStorage access is stubbed via vi.stubGlobal("window", ...).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks (vi.mock is hoisted before any imports) ----------------

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tauri", () => ({ isTauri: vi.fn(() => false) }));
vi.mock("@/lib/local-folder", () => ({ loadActiveLocalFolder: vi.fn(() => null) }));

// --- Imports (resolved through mocks above) --------------------------------

import { writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { isTauri } from "@/lib/tauri";
import { loadActiveLocalFolder } from "@/lib/local-folder";
import { getStateStore } from "@/lib/state-store";
import { createWebStore } from "@/lib/state-store/web";
import { createLocalFolderStore } from "@/lib/state-store/local-folder";

// --- Window stub helpers ---------------------------------------------------

let _store: Map<string, string>;
let _listeners: Array<(e: Event) => void>;

function makeWindowStub() {
  _store = new Map();
  _listeners = [];
  return {
    localStorage: {
      getItem: (k: string) => _store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        _store.set(k, v);
      },
      removeItem: (k: string) => _store.delete(k),
    },
    addEventListener: (type: string, fn: (e: Event) => void) => {
      if (type === "storage") _listeners.push(fn);
    },
    removeEventListener: (_type: string, fn: (e: Event) => void) => {
      const idx = _listeners.indexOf(fn);
      if (idx >= 0) _listeners.splice(idx, 1);
    },
    dispatchEvent: (e: Event) => {
      _listeners.forEach((fn) => fn(e));
    },
  };
}

/** Flush all pending microtasks / Promise continuations. */
async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// --- WebStore tests --------------------------------------------------------

describe("WebStore", () => {
  beforeEach(() => {
    vi.stubGlobal("window", makeWindowStub());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("round-trip: write then read returns the stored value", () => {
    const s = createWebStore();
    s.write("prefs", { theme: "dark" });
    expect(s.read("prefs", {})).toEqual({ theme: "dark" });
  });

  it("returns fallback for a key never written", () => {
    const s = createWebStore();
    expect(s.read("missing", [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("returns fallback on malformed JSON", () => {
    _store.set("verto:bad", "not-json{");
    const s = createWebStore();
    expect(s.read("bad", "fallback")).toBe("fallback");
  });

  it("returns fallback when localStorage is unavailable", () => {
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const s = createWebStore();
    expect(s.read("x", 99)).toBe(99);
  });

  it("subscribe: listener is called when write fires a same-tab event", () => {
    const s = createWebStore();
    const calls: number[] = [];
    s.subscribe(() => calls.push(1));
    s.write("x", "hello");
    expect(calls).toHaveLength(1);
  });

  it("subscribe cleanup: listener NOT called after unsubscribe", () => {
    const s = createWebStore();
    const calls: number[] = [];
    const unsub = s.subscribe(() => calls.push(1));
    s.write("x", "a");
    expect(calls).toHaveLength(1);
    unsub();
    s.write("x", "b");
    expect(calls).toHaveLength(1); // still 1, not 2
  });
});

// --- LocalFolderStore tests ------------------------------------------------

describe("LocalFolderStore", () => {
  beforeEach(() => {
    vi.stubGlobal("window", makeWindowStub());
    vi.mocked(writeTextFile).mockClear();
    vi.mocked(mkdir).mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("delegates reads to the web (localStorage) layer", () => {
    vi.mocked(loadActiveLocalFolder).mockReturnValue(null);
    const s = createLocalFolderStore();
    s.write("items", [1, 2, 3]);
    expect(s.read("items", [])).toEqual([1, 2, 3]);
  });

  it("fires async mirror to .verto/<name>.json", async () => {
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/home/user/vault");
    const s = createLocalFolderStore();
    s.write("bookmarks", { items: [] });
    await flushAsync();
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith("/home/user/vault/.verto", { recursive: true });
    expect(vi.mocked(writeTextFile)).toHaveBeenCalledWith(
      "/home/user/vault/.verto/bookmarks.json",
      JSON.stringify({ items: [] })
    );
  });
});

// --- getStateStore factory tests ------------------------------------------

describe("getStateStore factory", () => {
  beforeEach(() => {
    vi.stubGlobal("window", makeWindowStub());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns a working web store when isTauri() is false", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(loadActiveLocalFolder).mockReturnValue(null);
    const s = getStateStore();
    s.write("check", true);
    expect(s.read("check", false)).toBe(true);
  });

  it("returns a working web store when in Tauri but no active folder", () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(loadActiveLocalFolder).mockReturnValue(null);
    const s = getStateStore();
    s.write("check", true);
    expect(s.read("check", false)).toBe(true);
  });

  it("returns null store (SSR guard) when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    const s = getStateStore();
    expect(s.read("x", "fallback")).toBe("fallback");
    expect(() => s.write("x", 1)).not.toThrow();
  });
});
