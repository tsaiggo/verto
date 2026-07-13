// Collections unit tests.
//
// vitest environment: "node" — no real localStorage or window.
// @/lib/state-store is mocked with a simple in-memory Map so the tests are
// completely self-contained.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Collection } from "@/lib/collections";

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
  COLLECTIONS_KEY,
  addDocToCollection,
  createCollection,
  deleteCollection,
  loadCollections,
  notifyCollectionsChanged,
  removeDocFromCollection,
  renameCollection,
} from "@/lib/collections";

// --- Helpers ----------------------------------------------------------------

const baseCollection: Collection = {
  id: "test-id-1",
  name: "My Notes",
  docHrefs: ["/read/docs/intro"],
  createdAt: "2026-07-01T00:00:00.000Z",
};

function col(overrides: Partial<Collection>): Collection {
  return { ...baseCollection, ...overrides };
}

// --- loadCollections --------------------------------------------------------

describe("loadCollections", () => {
  beforeEach(() => mockMap.clear());

  it("returns [] when the store is empty", () => {
    expect(loadCollections()).toEqual([]);
  });

  it("returns normalized collections from the store", () => {
    mockMap.set("collections", [baseCollection]);
    expect(loadCollections()).toEqual([baseCollection]);
  });

  it("keeps a stable snapshot until persisted collections change", () => {
    mockMap.set("collections", [baseCollection]);
    const first = loadCollections();
    expect(loadCollections()).toBe(first);

    mockMap.set("collections", [col({ name: "Updated Notes" })]);
    expect(loadCollections()).not.toBe(first);
  });

  it("drops items with a missing or blank id", () => {
    mockMap.set("collections", [{ ...baseCollection, id: "" }]);
    expect(loadCollections()).toEqual([]);
  });

  it("drops items with a missing or blank name", () => {
    mockMap.set("collections", [{ ...baseCollection, name: "  " }]);
    expect(loadCollections()).toEqual([]);
  });

  it("returns [] when the stored value is not an array", () => {
    mockMap.set("collections", { id: "x", name: "Foo" });
    expect(loadCollections()).toEqual([]);
  });

  it("returns [] when stored value is null", () => {
    mockMap.set("collections", null);
    expect(loadCollections()).toEqual([]);
  });

  it("filters out null / invalid entries within a valid array", () => {
    mockMap.set("collections", [null, undefined, { invalid: true }, baseCollection]);
    expect(loadCollections()).toEqual([baseCollection]);
  });

  it("trims whitespace from id and name", () => {
    mockMap.set("collections", [{ ...baseCollection, id: "  test-id-1  ", name: "  My Notes  " }]);
    const loaded = loadCollections();
    expect(loaded[0].id).toBe("test-id-1");
    expect(loaded[0].name).toBe("My Notes");
  });

  it("falls back to [] for docHrefs if not an array", () => {
    mockMap.set("collections", [{ ...baseCollection, docHrefs: null }]);
    const loaded = loadCollections();
    expect(loaded[0].docHrefs).toEqual([]);
  });

  it("filters blank strings from docHrefs", () => {
    mockMap.set("collections", [{ ...baseCollection, docHrefs: ["", "/read/foo", "  "] }]);
    const loaded = loadCollections();
    expect(loaded[0].docHrefs).toEqual(["/read/foo"]);
  });

  it("keeps valid saved document titles", () => {
    mockMap.set("collections", [
      {
        ...baseCollection,
        docTitles: { "/read/docs/intro": "  Intro  ", "/read/bad": 3, "": "Untitled" },
      },
    ]);
    expect(loadCollections()[0].docTitles).toEqual({ "/read/docs/intro": "Intro" });
  });

  it("falls back createdAt to epoch when missing", () => {
    mockMap.set("collections", [{ id: "x", name: "Foo", docHrefs: [] }]);
    const loaded = loadCollections();
    expect(loaded[0].createdAt).toBe(new Date(0).toISOString());
  });
});

// --- createCollection -------------------------------------------------------

describe("createCollection", () => {
  beforeEach(() => mockMap.clear());

  it("creates a new collection and prepends it to the list", () => {
    const result = createCollection("Research");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Research");
    expect(result[0].docHrefs).toEqual([]);
    expect(typeof result[0].id).toBe("string");
    expect(result[0].id).not.toBe("");
  });

  it("persists the new collection", () => {
    createCollection("Research");
    expect(loadCollections()[0].name).toBe("Research");
  });

  it("prepends the new collection before existing ones", () => {
    mockMap.set("collections", [baseCollection]);
    const result = createCollection("Newer");
    expect(result.map((c) => c.name)).toEqual(["Newer", baseCollection.name]);
  });

  it("is a no-op for a blank name", () => {
    const result = createCollection("   ");
    expect(result).toEqual([]);
  });

  it("trims the name", () => {
    const result = createCollection("  Trimmed  ");
    expect(result[0].name).toBe("Trimmed");
  });

  it("assigns a unique id each time", () => {
    createCollection("A");
    createCollection("B");
    const [a, b] = loadCollections().slice(0, 2);
    expect(a.id).not.toBe(b.id);
  });

  it("sets createdAt to an ISO-8601 string", () => {
    const result = createCollection("Test");
    expect(() => new Date(result[0].createdAt)).not.toThrow();
    expect(result[0].createdAt).toMatch(/^\d{4}-/);
  });
});

// --- renameCollection -------------------------------------------------------

describe("renameCollection", () => {
  beforeEach(() => mockMap.clear());

  it("renames a collection by id", () => {
    mockMap.set("collections", [baseCollection]);
    const result = renameCollection(baseCollection.id, "Updated Name");
    expect(result[0].name).toBe("Updated Name");
  });

  it("persists the rename", () => {
    mockMap.set("collections", [baseCollection]);
    renameCollection(baseCollection.id, "Updated Name");
    expect(loadCollections()[0].name).toBe("Updated Name");
  });

  it("is a no-op for a blank name", () => {
    mockMap.set("collections", [baseCollection]);
    const result = renameCollection(baseCollection.id, "   ");
    expect(result[0].name).toBe(baseCollection.name);
  });

  it("is a no-op for an unknown id", () => {
    mockMap.set("collections", [baseCollection]);
    const result = renameCollection("nonexistent", "New Name");
    expect(result[0].name).toBe(baseCollection.name);
  });

  it("trims the new name", () => {
    mockMap.set("collections", [baseCollection]);
    const result = renameCollection(baseCollection.id, "  Trimmed  ");
    expect(result[0].name).toBe("Trimmed");
  });

  it("does not affect other collections", () => {
    const other = col({ id: "other-id", name: "Other" });
    mockMap.set("collections", [baseCollection, other]);
    const result = renameCollection(baseCollection.id, "New Name");
    expect(result[1].name).toBe("Other");
  });
});

// --- deleteCollection -------------------------------------------------------

describe("deleteCollection", () => {
  beforeEach(() => mockMap.clear());

  it("removes a collection by id", () => {
    mockMap.set("collections", [baseCollection]);
    const result = deleteCollection(baseCollection.id);
    expect(result).toEqual([]);
  });

  it("persists the deletion", () => {
    mockMap.set("collections", [baseCollection]);
    deleteCollection(baseCollection.id);
    expect(loadCollections()).toEqual([]);
  });

  it("is a no-op for an unknown id", () => {
    mockMap.set("collections", [baseCollection]);
    const result = deleteCollection("nonexistent");
    expect(result).toEqual([baseCollection]);
  });

  it("removes only the matching collection, leaving others intact", () => {
    const other = col({ id: "other-id", name: "Other" });
    mockMap.set("collections", [baseCollection, other]);
    const result = deleteCollection(baseCollection.id);
    expect(result).toEqual([other]);
  });
});

// --- addDocToCollection -----------------------------------------------------

describe("addDocToCollection", () => {
  beforeEach(() => mockMap.clear());

  it("adds a doc href to a collection", () => {
    mockMap.set("collections", [col({ docHrefs: [] })]);
    const result = addDocToCollection(baseCollection.id, "/read/new-doc");
    expect(result[0].docHrefs).toContain("/read/new-doc");
  });

  it("does not duplicate hrefs", () => {
    mockMap.set("collections", [col({ docHrefs: ["/read/new-doc"] })]);
    const result = addDocToCollection(baseCollection.id, "/read/new-doc");
    expect(result[0].docHrefs).toEqual(["/read/new-doc"]);
  });

  it("is a no-op for an unknown collection id", () => {
    mockMap.set("collections", [baseCollection]);
    const result = addDocToCollection("nonexistent", "/read/foo");
    expect(result).toEqual([baseCollection]);
  });

  it("persists the addition", () => {
    mockMap.set("collections", [col({ docHrefs: [] })]);
    addDocToCollection(baseCollection.id, "/read/foo");
    expect(loadCollections()[0].docHrefs).toContain("/read/foo");
  });

  it("stores a supplied document title", () => {
    mockMap.set("collections", [col({ docHrefs: [] })]);
    addDocToCollection(baseCollection.id, "/read/foo", "  Foo  ");
    expect(loadCollections()[0].docTitles).toEqual({ "/read/foo": "Foo" });
  });

  it("does not affect other collections", () => {
    const other = col({ id: "other-id", name: "Other", docHrefs: [] });
    mockMap.set("collections", [baseCollection, other]);
    addDocToCollection(baseCollection.id, "/read/new");
    expect(loadCollections()[1].docHrefs).toEqual([]);
  });
});

// --- removeDocFromCollection ------------------------------------------------

describe("removeDocFromCollection", () => {
  beforeEach(() => mockMap.clear());

  it("removes a doc href from a collection", () => {
    mockMap.set("collections", [col({ docHrefs: ["/read/intro", "/read/other"] })]);
    const result = removeDocFromCollection(baseCollection.id, "/read/intro");
    expect(result[0].docHrefs).toEqual(["/read/other"]);
  });

  it("is a no-op if href not present", () => {
    mockMap.set("collections", [col({ docHrefs: ["/read/intro"] })]);
    const result = removeDocFromCollection(baseCollection.id, "/read/nonexistent");
    expect(result[0].docHrefs).toEqual(["/read/intro"]);
  });

  it("is a no-op for an unknown collection id", () => {
    mockMap.set("collections", [baseCollection]);
    const result = removeDocFromCollection("nonexistent", "/read/docs/intro");
    expect(result).toEqual([baseCollection]);
  });

  it("persists the removal", () => {
    mockMap.set("collections", [col({ docHrefs: ["/read/intro"] })]);
    removeDocFromCollection(baseCollection.id, "/read/intro");
    expect(loadCollections()[0].docHrefs).toEqual([]);
  });

  it("removes a saved title with its document", () => {
    mockMap.set("collections", [
      col({ docHrefs: ["/read/intro"], docTitles: { "/read/intro": "Intro" } }),
    ]);
    removeDocFromCollection(baseCollection.id, "/read/intro");
    expect(loadCollections()[0].docTitles).toBeUndefined();
  });

  it("does not affect other collections", () => {
    const other = col({ id: "other-id", name: "Other", docHrefs: ["/read/intro"] });
    mockMap.set("collections", [baseCollection, other]);
    removeDocFromCollection(baseCollection.id, "/read/docs/intro");
    expect(loadCollections()[1].docHrefs).toEqual(["/read/intro"]);
  });
});

// --- notifyCollectionsChanged -----------------------------------------------

describe("notifyCollectionsChanged", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dispatches a storage event with the collections key", () => {
    const dispatched: string[] = [];
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
    notifyCollectionsChanged();
    expect(dispatched).toContain(COLLECTIONS_KEY);
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
    notifyCollectionsChanged();
    expect(dispatched).toContain("storage");
  });

  it("is a no-op when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => notifyCollectionsChanged()).not.toThrow();
  });
});
