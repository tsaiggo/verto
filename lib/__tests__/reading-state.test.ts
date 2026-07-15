import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_RECENT_READINGS,
  READING_STATE_KEY,
  READING_STATE_VERSION,
  computeScrollProgress,
  deleteReadingEntry,
  getReadingStatus,
  loadReadingState,
  readingStatusLabel,
  removeReadingEntry,
  saveReadingState,
  saveReadingEntry,
  selectRecentInScope,
  upsertReadingEntry,
  type ReadingEntry,
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

function expectedState(entries: readonly ReadingEntry[]) {
  return {
    version: READING_STATE_VERSION,
    byHref: Object.fromEntries(entries.map((item) => [item.href, item])),
    recentHrefs: entries.map((item) => item.href),
    recent: [...entries],
  };
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
      entry({ href: `/read/docs/${index}`, title: `Doc ${index}` })
    );

    expect(upsertReadingEntry(existing, baseEntry)).toHaveLength(MAX_RECENT_READINGS);
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
    expect(upsertReadingEntry([], entry({ href: "javascript:alert(1)" }))).toEqual([]);
    expect(upsertReadingEntry([], entry({ href: "//evil.example" }))).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const list = [entry({ href: "/read/docs/intro", title: "Intro" })];
    upsertReadingEntry(list, baseEntry);

    expect(list).toEqual([entry({ href: "/read/docs/intro", title: "Intro" })]);
  });
});

describe("removeReadingEntry", () => {
  it("removes entries by href", () => {
    const target = entry({ href: "/read/docs/target", title: "Target" });
    const other = entry({ href: "/read/docs/other", title: "Other" });

    expect(removeReadingEntry([target, other], target.href)).toEqual([other]);
  });

  it("does not mutate the input list", () => {
    const list = [entry({ href: "/read/docs/intro", title: "Intro" })];
    removeReadingEntry(list, "/read/docs/intro");

    expect(list).toEqual([entry({ href: "/read/docs/intro", title: "Intro" })]);
  });
});

describe("getReadingStatus", () => {
  it("returns unread for zero progress", () => {
    expect(getReadingStatus(0)).toBe("unread");
  });

  it("returns reading for partial progress", () => {
    expect(getReadingStatus(42)).toBe("reading");
  });

  it("returns read near completion", () => {
    expect(getReadingStatus(95)).toBe("read");
  });
});

describe("readingStatusLabel", () => {
  it("returns an empty label for unread documents", () => {
    expect(readingStatusLabel(0)).toBe("");
  });

  it("labels in-progress reading with a rounded percentage", () => {
    expect(readingStatusLabel(42.4)).toBe("reading 42%");
    expect(readingStatusLabel(1)).toBe("reading 1%");
  });

  it("labels near-complete documents as read", () => {
    expect(readingStatusLabel(95)).toBe("read");
    expect(readingStatusLabel(100)).toBe("read");
  });
});

describe("selectRecentInScope", () => {
  it("keeps only entries whose href is still available, newest-first", () => {
    const a = entry({ href: "/read/a", title: "A" });
    const b = entry({ href: "/read/b", title: "B" });
    const gone = entry({ href: "/read/gone", title: "Gone" });

    // Entries are stored newest-first; the stale one is dropped, order preserved.
    expect(selectRecentInScope([a, gone, b], ["/read/a", "/read/b"])).toEqual([a, b]);
  });

  it("caps the result at the requested limit", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      entry({ href: `/read/${i}`, title: `Doc ${i}` })
    );

    expect(
      selectRecentInScope(
        entries,
        entries.map((e) => e.href),
        2
      )
    ).toHaveLength(2);
  });

  it("returns an empty list when nothing is in scope", () => {
    expect(selectRecentInScope([entry({ href: "/read/x" })], ["/read/y"])).toEqual([]);
  });
});

describe("computeScrollProgress", () => {
  it("reports no progress for non-scrollable documents", () => {
    expect(computeScrollProgress({ scrollTop: 120, scrollHeight: 800, clientHeight: 800 })).toEqual(
      { progress: 0, scrollTop: 120 }
    );
  });

  it("computes percentage from scroll geometry", () => {
    expect(
      computeScrollProgress({ scrollTop: 250, scrollHeight: 1000, clientHeight: 500 })
    ).toEqual({ progress: 50, scrollTop: 250 });
  });

  it("clamps negative scroll positions to zero", () => {
    expect(
      computeScrollProgress({ scrollTop: -30, scrollHeight: 1000, clientHeight: 500 })
    ).toEqual({ progress: 0, scrollTop: 0 });
  });

  it("clamps progress to 100", () => {
    expect(
      computeScrollProgress({ scrollTop: 800, scrollHeight: 1000, clientHeight: 500 })
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips reading state through localStorage", async () => {
    const state = { recent: [baseEntry] };

    await saveReadingState(state);

    expect(loadReadingState()).toEqual(expectedState([baseEntry]));
    expect(JSON.parse(window.localStorage.getItem(READING_STATE_KEY)!)).toEqual({
      version: READING_STATE_VERSION,
      byHref: { [baseEntry.href]: baseEntry },
      recentHrefs: [baseEntry.href],
    });
  });

  it("returns an empty state when nothing is stored", () => {
    expect(loadReadingState()).toEqual(expectedState([]));
  });

  it("ignores malformed stored JSON", () => {
    window.localStorage.setItem(READING_STATE_KEY, "{not json");

    expect(loadReadingState()).toEqual(expectedState([]));
  });

  it("drops invalid entries without evicting valid document state", () => {
    const many = Array.from({ length: MAX_RECENT_READINGS + 3 }, (_, index) =>
      entry({ href: `/read/docs/${index}`, title: `Doc ${index}` })
    );
    window.localStorage.setItem(
      READING_STATE_KEY,
      JSON.stringify({ recent: [null, { title: "Missing href" }, ...many] })
    );

    const loaded = loadReadingState();

    expect(loaded.recent).toHaveLength(MAX_RECENT_READINGS + 3);
    expect(Object.keys(loaded.byHref)).toHaveLength(MAX_RECENT_READINGS + 3);
    expect(loaded.recent[0].href).toBe("/read/docs/0");
    expect(selectRecentInScope(loaded.recent, loaded.recentHrefs)).toHaveLength(
      MAX_RECENT_READINGS
    );
  });

  it("migrates existing v1 localStorage data on the next write", async () => {
    const legacyEntries = Array.from({ length: MAX_RECENT_READINGS + 2 }, (_, index) =>
      entry({ href: `/read/legacy/${index}`, title: `Legacy ${index}` })
    );
    window.localStorage.setItem(READING_STATE_KEY, JSON.stringify({ recent: legacyEntries }));

    const loaded = loadReadingState();
    expect(loaded.recent).toEqual(legacyEntries);
    expect(Object.keys(loaded.byHref)).toHaveLength(legacyEntries.length);

    const updated = entry({
      href: legacyEntries[legacyEntries.length - 1].href,
      title: "Updated legacy entry",
      progress: 77,
    });
    await saveReadingEntry(updated);

    const persisted = JSON.parse(window.localStorage.getItem(READING_STATE_KEY)!);
    expect(persisted.version).toBe(READING_STATE_VERSION);
    expect(persisted.recent).toBeUndefined();
    expect(Object.keys(persisted.byHref)).toHaveLength(legacyEntries.length);
    expect(persisted.recentHrefs[0]).toBe(updated.href);
    expect(persisted.byHref[updated.href].progress).toBe(77);
  });

  it("keeps earlier progress after more than five documents are opened", async () => {
    const opened = Array.from({ length: MAX_RECENT_READINGS + 1 }, (_, index) =>
      entry({
        href: `/read/opened/${index}`,
        title: `Opened ${index}`,
        progress: index + 10,
        scrollTop: index * 100,
      })
    );

    for (const item of opened) await saveReadingEntry(item);

    const loaded = loadReadingState();
    expect(loaded.recent).toHaveLength(MAX_RECENT_READINGS + 1);
    expect(loaded.byHref[opened[0].href]).toEqual(opened[0]);
    expect(loaded.recentHrefs).toEqual(opened.map((item) => item.href).reverse());
  });

  it("saves one entry and notifies same-tab subscribers without StorageEvent", async () => {
    const events: string[] = [];
    vi.stubGlobal("StorageEvent", undefined);
    window.addEventListener = (type: string) => void events.push(`listen:${type}`);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    await expect(saveReadingEntry(baseEntry)).resolves.toEqual(expectedState([baseEntry]));
    expect(loadReadingState()).toEqual(expectedState([baseEntry]));
    expect(events).toContain("storage");
  });

  it("deletes one entry and notifies same-tab subscribers", async () => {
    const other = entry({ href: "/read/docs/other", title: "Other" });
    const events: string[] = [];
    await saveReadingState({ recent: [baseEntry, other] });
    vi.stubGlobal("StorageEvent", undefined);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    await expect(deleteReadingEntry(baseEntry.href)).resolves.toEqual(expectedState([other]));
    expect(loadReadingState()).toEqual(expectedState([other]));
    expect(events).toContain("storage");
  });
});

describe("reading state without a DOM", () => {
  it("loadReadingState returns an empty state when window is undefined", () => {
    expect(loadReadingState()).toEqual(expectedState([]));
  });

  it("saveReadingState is a no-op when window is undefined", async () => {
    await expect(saveReadingState({ recent: [baseEntry] })).resolves.toEqual(
      expectedState([baseEntry])
    );
  });
});
