// Bookmarks unit tests.
//
// vitest environment: "node" — no real localStorage or window.
// @/lib/state-store is mocked with a simple in-memory Map so the tests are
// completely self-contained.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bookmark } from "@/lib/bookmarks";

// --- Hoisted mock map (available inside vi.mock factory) -------------------

const { mockMap } = vi.hoisted(() => ({
  mockMap: new Map<string, unknown>(),
}));

// --- Mock @/lib/state-store -------------------------------------------------

vi.mock("@/lib/state-store", () => ({
  getStateStore: vi.fn(() => ({
    read: <T>(name: string, fallback: T): T =>
      (mockMap.has(name) ? mockMap.get(name) : fallback) as T,
    write: <T>(name: string, value: T): void => {
      mockMap.set(name, value);
    },
    subscribe: () => () => {},
  })),
}));

// --- Imports (resolved after mocks are registered) -------------------------

import {
  BOOKMARKS_KEY,
  isBookmarked,
  loadBookmarks,
  notifyBookmarksChanged,
  removeBookmark,
  toggleBookmark,
} from "@/lib/bookmarks";

// --- Helpers ----------------------------------------------------------------

const baseBookmark: Bookmark = {
  href: "/read/docs/intro",
  title: "Introduction",
  kind: "document",
  addedAt: "2026-07-01T00:00:00.000Z",
};

function bm(overrides: Partial<Bookmark>): Bookmark {
  return { ...baseBookmark, ...overrides };
}

// --- loadBookmarks ----------------------------------------------------------

describe("loadBookmarks", () => {
  beforeEach(() => mockMap.clear());

  it("returns [] when the store is empty", () => {
    expect(loadBookmarks()).toEqual([]);
  });

  it("returns normalized bookmarks from the store", () => {
    mockMap.set("bookmarks", [baseBookmark]);
    expect(loadBookmarks()).toEqual([baseBookmark]);
  });

  it("drops items with a missing or blank href", () => {
    mockMap.set("bookmarks", [{ ...baseBookmark, href: "" }]);
    expect(loadBookmarks()).toEqual([]);
  });

  it("drops items with a missing or blank title", () => {
    mockMap.set("bookmarks", [{ ...baseBookmark, title: "  " }]);
    expect(loadBookmarks()).toEqual([]);
  });

  it("falls back to 'document' kind for unknown kind values", () => {
    mockMap.set("bookmarks", [{ ...baseBookmark, kind: "unknown" }]);
    const loaded = loadBookmarks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].kind).toBe("document");
  });

  it("accepts 'note' kind", () => {
    const noteBookmark = bm({ kind: "note" });
    mockMap.set("bookmarks", [noteBookmark]);
    expect(loadBookmarks()[0].kind).toBe("note");
  });

  it("returns [] when the stored value is not an array", () => {
    mockMap.set("bookmarks", { href: "/read/foo", title: "Foo" });
    expect(loadBookmarks()).toEqual([]);
  });

  it("returns [] when stored value is null", () => {
    mockMap.set("bookmarks", null);
    expect(loadBookmarks()).toEqual([]);
  });

  it("filters out null / invalid entries within a valid array", () => {
    mockMap.set("bookmarks", [null, undefined, { invalid: true }, baseBookmark]);
    expect(loadBookmarks()).toEqual([baseBookmark]);
  });

  it("trims whitespace from href and title", () => {
    mockMap.set("bookmarks", [
      { ...baseBookmark, href: "  /read/docs/intro  ", title: "  Intro  " },
    ]);
    const loaded = loadBookmarks();
    expect(loaded[0].href).toBe("/read/docs/intro");
    expect(loaded[0].title).toBe("Intro");
  });
});

// --- isBookmarked -----------------------------------------------------------

describe("isBookmarked", () => {
  beforeEach(() => mockMap.clear());

  it("returns false when the href is not in the store", () => {
    expect(isBookmarked("/read/docs/intro")).toBe(false);
  });

  it("returns true when the href exists in the store", () => {
    mockMap.set("bookmarks", [baseBookmark]);
    expect(isBookmarked(baseBookmark.href)).toBe(true);
  });

  it("returns false for an href that does not match", () => {
    mockMap.set("bookmarks", [baseBookmark]);
    expect(isBookmarked("/read/other")).toBe(false);
  });
});

// --- toggleBookmark ---------------------------------------------------------

describe("toggleBookmark", () => {
  beforeEach(() => mockMap.clear());

  it("adds a new bookmark at the front", () => {
    const result = toggleBookmark(baseBookmark);
    expect(result).toEqual([baseBookmark]);
    expect(loadBookmarks()).toEqual([baseBookmark]);
  });

  it("removes an existing bookmark (toggle off)", () => {
    mockMap.set("bookmarks", [baseBookmark]);
    const result = toggleBookmark(baseBookmark);
    expect(result).toEqual([]);
    expect(loadBookmarks()).toEqual([]);
  });

  it("does not duplicate: toggling a new item then toggling again returns []", () => {
    toggleBookmark(baseBookmark);
    const result = toggleBookmark(baseBookmark);
    expect(result).toEqual([]);
  });

  it("prepends the new bookmark before existing ones", () => {
    const older = bm({ href: "/read/old", title: "Old Doc" });
    mockMap.set("bookmarks", [older]);
    const result = toggleBookmark(baseBookmark);
    expect(result.map((b) => b.href)).toEqual([baseBookmark.href, older.href]);
  });

  it("removing one bookmark does not affect others", () => {
    const other = bm({ href: "/read/other", title: "Other" });
    mockMap.set("bookmarks", [baseBookmark, other]);
    const result = toggleBookmark(baseBookmark);
    expect(result).toEqual([other]);
  });

  it("persists the toggled state so subsequent loadBookmarks() reflects the change", () => {
    toggleBookmark(baseBookmark);
    expect(isBookmarked(baseBookmark.href)).toBe(true);

    toggleBookmark(baseBookmark);
    expect(isBookmarked(baseBookmark.href)).toBe(false);
  });
});

// --- removeBookmark ---------------------------------------------------------

describe("removeBookmark", () => {
  beforeEach(() => mockMap.clear());

  it("removes a bookmark by href", () => {
    mockMap.set("bookmarks", [baseBookmark]);
    const result = removeBookmark(baseBookmark.href);
    expect(result).toEqual([]);
    expect(loadBookmarks()).toEqual([]);
  });

  it("is a no-op for an unknown href", () => {
    mockMap.set("bookmarks", [baseBookmark]);
    const result = removeBookmark("/read/nonexistent");
    expect(result).toEqual([baseBookmark]);
  });

  it("removes only the matching href, leaving others intact", () => {
    const other = bm({ href: "/read/other", title: "Other" });
    mockMap.set("bookmarks", [baseBookmark, other]);
    const result = removeBookmark(baseBookmark.href);
    expect(result).toEqual([other]);
  });
});

// --- notifyBookmarksChanged -------------------------------------------------

describe("notifyBookmarksChanged", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dispatches a storage event with the bookmarks key", () => {
    const dispatched: string[] = [];
    // Stub StorageEvent so the key-path branch is exercised
    vi.stubGlobal(
      "StorageEvent",
      class MockStorageEvent {
        type: string;
        key: string | null;
        constructor(type: string, init?: { key?: string }) {
          this.type = type;
          this.key = init?.key ?? null;
        }
      }
    );
    vi.stubGlobal("window", {
      dispatchEvent: (e: { type: string; key?: string | null }) => {
        dispatched.push(e.key ?? e.type);
        return true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    notifyBookmarksChanged();
    expect(dispatched).toContain(BOOKMARKS_KEY);
  });

  it("dispatches a plain storage event when StorageEvent is unavailable", () => {
    const dispatched: string[] = [];
    vi.stubGlobal("StorageEvent", undefined);
    vi.stubGlobal("window", {
      dispatchEvent: (e: Event) => {
        dispatched.push(e.type);
        return true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    notifyBookmarksChanged();
    expect(dispatched).toContain("storage");
  });

  it("is a no-op when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => notifyBookmarksChanged()).not.toThrow();
  });
});
