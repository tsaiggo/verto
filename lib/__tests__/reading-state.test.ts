import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_RECENT_READINGS,
  READING_STATE_KEY,
  computeScrollProgress,
  loadReadingState,
  saveReadingState,
  saveReadingEntry,
  upsertReadingEntry,
  type ReadingEntry,
  type ReadingState,
} from "@/lib/reading-state";

const baseEntry: ReadingEntry = {
  href: "/read/docs/getting-started",
  slug: ["docs", "getting-started"],
  title: "Getting Started",
  path: "docs/getting-started.mdx",
  lastReadAt: "2026-06-05T00:00:00.000Z",
  progress: 0,
  scrollTop: 0,
};

function entry(overrides: Partial<ReadingEntry>): ReadingEntry {
  return { ...baseEntry, ...overrides };
}

describe("upsertReadingEntry", () => {
  it("adds a new entry to the front", () => {
    const previous = entry({ href: "/read/docs/intro", title: "Intro" });
    const next = upsertReadingEntry([previous], baseEntry);

    expect(next).toEqual([baseEntry, previous]);
  });

  it("moves an existing entry to the front and updates metadata", () => {
    const old = entry({ title: "Old title", progress: 12, scrollTop: 100 });
    const other = entry({ href: "/read/docs/other", title: "Other" });
    const updated = entry({ title: "New title", progress: 64, scrollTop: 900 });

    expect(upsertReadingEntry([old, other], updated)).toEqual([updated, other]);
  });

  it("caps the list at the requested maximum", () => {
    const existing = Array.from({ length: MAX_RECENT_READINGS }, (_, index) =>
      entry({ href: `/read/docs/${index}`, title: `Doc ${index}` }),
    );

    expect(upsertReadingEntry(existing, baseEntry)).toHaveLength(
      MAX_RECENT_READINGS,
    );
    expect(upsertReadingEntry(existing, baseEntry)[0]).toEqual(baseEntry);
  });

  it("clamps progress and scroll position", () => {
    const next = upsertReadingEntry([], {
      ...baseEntry,
      progress: 140,
      scrollTop: -10,
    });

    expect(next[0].progress).toBe(100);
    expect(next[0].scrollTop).toBe(0);
  });

  it("rejects non-internal hrefs", () => {
    expect(
      upsertReadingEntry([], entry({ href: "javascript:alert(1)" })),
    ).toEqual([]);
    expect(upsertReadingEntry([], entry({ href: "//evil.example" }))).toEqual(
      [],
    );
  });

  it("does not mutate the input list", () => {
    const list = [entry({ href: "/read/docs/intro", title: "Intro" })];
    upsertReadingEntry(list, baseEntry);

    expect(list).toEqual([entry({ href: "/read/docs/intro", title: "Intro" })]);
  });
});

describe("computeScrollProgress", () => {
  it("reports no progress for non-scrollable documents", () => {
    expect(
      computeScrollProgress({ scrollTop: 120, scrollHeight: 800, clientHeight: 800 }),
    ).toEqual({ progress: 0, scrollTop: 120 });
  });

  it("computes percentage from scroll geometry", () => {
    expect(
      computeScrollProgress({ scrollTop: 250, scrollHeight: 1000, clientHeight: 500 }),
    ).toEqual({ progress: 50, scrollTop: 250 });
  });

  it("clamps negative scroll positions to zero", () => {
    expect(
      computeScrollProgress({ scrollTop: -30, scrollHeight: 1000, clientHeight: 500 }),
    ).toEqual({ progress: 0, scrollTop: 0 });
  });

  it("clamps progress to 100", () => {
    expect(
      computeScrollProgress({ scrollTop: 800, scrollHeight: 1000, clientHeight: 500 }),
    ).toEqual({ progress: 100, scrollTop: 800 });
  });
});

describe("reading state persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips reading state through localStorage", () => {
    const state: ReadingState = { recent: [baseEntry] };

    saveReadingState(state);

    expect(loadReadingState()).toEqual(state);
  });

  it("returns an empty state when nothing is stored", () => {
    expect(loadReadingState()).toEqual({ recent: [] });
  });

  it("ignores malformed stored JSON", () => {
    window.localStorage.setItem(READING_STATE_KEY, "{not json");

    expect(loadReadingState()).toEqual({ recent: [] });
  });

  it("drops invalid entries and caps persisted entries", () => {
    const many = Array.from({ length: MAX_RECENT_READINGS + 3 }, (_, index) =>
      entry({ href: `/read/docs/${index}`, title: `Doc ${index}` }),
    );
    window.localStorage.setItem(
      READING_STATE_KEY,
      JSON.stringify({ recent: [null, { title: "Missing href" }, ...many] }),
    );

    const loaded = loadReadingState();

    expect(loaded.recent).toHaveLength(MAX_RECENT_READINGS);
    expect(loaded.recent[0].href).toBe("/read/docs/0");
  });

  it("saves one entry and notifies same-tab subscribers without StorageEvent", () => {
    const events: string[] = [];
    vi.stubGlobal("StorageEvent", undefined);
    window.addEventListener = (type: string) => void events.push(`listen:${type}`);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    expect(() => saveReadingEntry(baseEntry)).not.toThrow();
    expect(loadReadingState()).toEqual({ recent: [baseEntry] });
    expect(events).toContain("storage");
  });
});

describe("reading state without a DOM", () => {
  it("loadReadingState returns an empty state when window is undefined", () => {
    expect(loadReadingState()).toEqual({ recent: [] });
  });

  it("saveReadingState is a no-op when window is undefined", () => {
    expect(() => saveReadingState({ recent: [baseEntry] })).not.toThrow();
  });
});
