import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INBOX_KEY,
  INBOX_STATUSES,
  MAX_INBOX_CONTENT_LENGTH,
  MAX_INBOX_ITEMS,
  deleteInboxItem,
  findInboxItem,
  getInboxAttentionCount,
  loadInbox,
  normalizeInboxStatus,
  removeInboxItem,
  saveInbox,
  saveInboxItem,
  setInboxItemStatus,
  setInboxStatus,
  upsertInboxItem,
  type InboxItem,
  type InboxState,
} from "@/lib/inbox";

const baseItem: InboxItem = {
  id: "guid-1",
  feedUrl: "https://blog.example.com/feed.xml",
  sourceName: "Example Blog",
  title: "Hello World",
  url: "https://blog.example.com/hello",
  author: "Jane Doe",
  publishedAt: "2026-06-01T00:00:00.000Z",
  summary: "An introduction.",
  content: "A longer article body.",
  status: "unread",
  createdAt: "2026-06-05T00:00:00.000Z",
};

function item(overrides: Partial<InboxItem>): InboxItem {
  return { ...baseItem, ...overrides };
}

describe("normalizeInboxStatus", () => {
  it("accepts every known status", () => {
    for (const status of INBOX_STATUSES) {
      expect(normalizeInboxStatus(status)).toBe(status);
    }
  });

  it("falls back to unread for unknown or missing values", () => {
    expect(normalizeInboxStatus("nonsense")).toBe("unread");
    expect(normalizeInboxStatus(undefined)).toBe("unread");
    expect(normalizeInboxStatus(42)).toBe("unread");
  });
});

describe("upsertInboxItem", () => {
  it("prepends a new item", () => {
    const previous = item({ id: "guid-0", url: "https://blog.example.com/prev" });
    const next = upsertInboxItem([previous], baseItem);

    expect(next).toEqual([baseItem, previous]);
  });

  it("updates an existing item in place, keeping its status, createdAt, and position", () => {
    const a = item({ id: "a", url: "https://e.example/a", title: "A" });
    const b = item({
      id: "b",
      url: "https://e.example/b",
      title: "B",
      status: "read",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const c = item({ id: "c", url: "https://e.example/c", title: "C" });
    const bRefetched = item({
      id: "b",
      url: "https://e.example/b-updated",
      title: "B (updated)",
      status: "unread",
      createdAt: "2099-12-31T00:00:00.000Z",
    });

    const next = upsertInboxItem([a, b, c], bRefetched);

    expect(next.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(next[1].title).toBe("B (updated)");
    expect(next[1].url).toBe("https://e.example/b-updated");
    expect(next[1].status).toBe("read");
    expect(next[1].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("caps the list at the requested maximum when adding new items", () => {
    const existing = Array.from({ length: 3 }, (_, index) =>
      item({ id: `old-${index}`, url: `https://e.example/${index}` })
    );

    const next = upsertInboxItem(existing, baseItem, 3);

    expect(next).toHaveLength(3);
    expect(next[0]).toEqual(baseItem);
  });

  it("rejects items missing an id, a valid feedUrl, a valid url, or a title", () => {
    expect(upsertInboxItem([], item({ id: "" }))).toEqual([]);
    expect(upsertInboxItem([], item({ feedUrl: "not-a-url" }))).toEqual([]);
    expect(upsertInboxItem([], item({ url: "javascript:alert(1)" }))).toEqual([]);
    expect(upsertInboxItem([], item({ url: "//evil.example" }))).toEqual([]);
    expect(upsertInboxItem([], item({ title: "   " }))).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const list = [item({ id: "a", url: "https://e.example/a" })];
    upsertInboxItem(list, baseItem);

    expect(list).toEqual([item({ id: "a", url: "https://e.example/a" })]);
  });
});

describe("setInboxItemStatus", () => {
  it("changes the status of one item without reordering", () => {
    const a = item({ id: "a", url: "https://e.example/a" });
    const b = item({ id: "b", url: "https://e.example/b" });

    const next = setInboxItemStatus([a, b], "a", "archived");

    expect(next.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(next[0].status).toBe("archived");
    expect(next[1].status).toBe("unread");
  });

  it("leaves the list unchanged for an unknown id", () => {
    const list = [baseItem];
    expect(setInboxItemStatus(list, "missing", "read")).toEqual([baseItem]);
  });
});

describe("getInboxAttentionCount", () => {
  it("counts unread and in-progress items, not completed or archived items", () => {
    expect(
      getInboxAttentionCount([
        baseItem,
        item({ id: "reading", url: "https://e.example/reading", status: "reading" }),
        item({ id: "read", url: "https://e.example/read", status: "read" }),
        item({ id: "archived", url: "https://e.example/archived", status: "archived" }),
      ])
    ).toBe(2);
  });
});

describe("removeInboxItem / findInboxItem", () => {
  it("removes items by id", () => {
    const other = item({ id: "other", url: "https://e.example/other" });
    expect(removeInboxItem([baseItem, other], baseItem.id)).toEqual([other]);
  });

  it("finds an item by id, or returns null", () => {
    expect(findInboxItem([baseItem], baseItem.id)).toEqual(baseItem);
    expect(findInboxItem([baseItem], "missing")).toBeNull();
  });
});

describe("inbox persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      addEventListener: () => {},
      dispatchEvent: () => true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips items through localStorage", () => {
    const state: InboxState = { items: [baseItem] };

    saveInbox(state);

    expect(loadInbox()).toEqual(state);
  });

  it("returns an empty state when nothing is stored", () => {
    expect(loadInbox()).toEqual({ items: [] });
  });

  it("ignores malformed stored JSON", () => {
    window.localStorage.setItem(INBOX_KEY, "{not json");

    expect(loadInbox()).toEqual({ items: [] });
  });

  it("drops invalid items and caps persisted entries", () => {
    const many = Array.from({ length: MAX_INBOX_ITEMS + 3 }, (_, index) =>
      item({ id: `id-${index}`, url: `https://e.example/${index}` })
    );
    window.localStorage.setItem(
      INBOX_KEY,
      JSON.stringify({
        items: [null, { id: "x" }, { title: "no id" }, ...many],
      })
    );

    const loaded = loadInbox();

    expect(loaded.items).toHaveLength(MAX_INBOX_ITEMS);
    expect(loaded.items[0].id).toBe("id-0");
  });

  it("bounds persisted article previews to protect localStorage", () => {
    const oversized = item({ content: "x".repeat(MAX_INBOX_CONTENT_LENGTH + 100) });

    saveInboxItem(oversized);

    expect(loadInbox().items[0].content?.length).toBeLessThanOrEqual(MAX_INBOX_CONTENT_LENGTH);
  });

  it("saves one item and notifies same-tab subscribers without StorageEvent", () => {
    const events: string[] = [];
    vi.stubGlobal("StorageEvent", undefined);
    window.addEventListener = (type: string) => void events.push(`listen:${type}`);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    expect(() => saveInboxItem(baseItem)).not.toThrow();
    expect(loadInbox()).toEqual({ items: [baseItem] });
    expect(events).toContain("storage");
  });

  it("deletes one item and notifies same-tab subscribers", () => {
    const other = item({ id: "other", url: "https://e.example/other" });
    const events: string[] = [];
    saveInbox({ items: [baseItem, other] });
    vi.stubGlobal("StorageEvent", undefined);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    expect(deleteInboxItem(baseItem.id)).toEqual({ items: [other] });
    expect(loadInbox()).toEqual({ items: [other] });
    expect(events).toContain("storage");
  });

  it("persists a status change through setInboxStatus", () => {
    saveInbox({ items: [baseItem] });

    setInboxStatus(baseItem.id, "read");

    expect(loadInbox().items[0].status).toBe("read");
  });

  it("preserves triage status when a feed re-fetch updates the item", () => {
    saveInboxItem(baseItem);
    setInboxStatus(baseItem.id, "read");

    saveInboxItem(item({ title: "Hello World (edited)" }));

    const loaded = loadInbox();
    expect(loaded.items[0].title).toBe("Hello World (edited)");
    expect(loaded.items[0].status).toBe("read");
  });
});

describe("inbox without a DOM", () => {
  it("loadInbox returns an empty state when window is undefined", () => {
    expect(loadInbox()).toEqual({ items: [] });
  });

  it("saveInbox is a no-op when window is undefined", () => {
    expect(() => saveInbox({ items: [baseItem] })).not.toThrow();
  });
});
