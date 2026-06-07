import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  ACTIVE_LOCAL_FOLDER_KEY,
  LOCAL_FOLDER_CHANGED_EVENT,
  MAX_RECENT_FOLDERS,
  RECENT_FOLDERS_KEY,
  addRecentFolder,
  loadActiveLocalFolder,
  loadRecentFolders,
  saveActiveLocalFolder,
  saveRecentFolders,
  summarizeInspection,
  type FolderInspection,
} from "@/lib/local-folder";

describe("addRecentFolder", () => {
  it("prepends a new folder", () => {
    expect(addRecentFolder(["/a"], "/b")).toEqual(["/b", "/a"]);
  });

  it("moves an existing folder to the front instead of duplicating", () => {
    expect(addRecentFolder(["/a", "/b", "/c"], "/c")).toEqual([
      "/c",
      "/a",
      "/b",
    ]);
  });

  it("ignores blank / whitespace-only input", () => {
    expect(addRecentFolder(["/a"], "   ")).toEqual(["/a"]);
    expect(addRecentFolder(["/a"], "")).toEqual(["/a"]);
  });

  it("trims the stored value", () => {
    expect(addRecentFolder([], "  /a  ")).toEqual(["/a"]);
  });

  it("caps the list at the requested maximum", () => {
    const list = ["1", "2", "3", "4", "5", "6"];
    expect(addRecentFolder(list, "7", 6)).toEqual([
      "7",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("does not mutate the input list", () => {
    const list = ["/a"];
    addRecentFolder(list, "/b");
    expect(list).toEqual(["/a"]);
  });
});

describe("summarizeInspection", () => {
  const base: FolderInspection = {
    exists: true,
    isDir: true,
    fileCount: 0,
    samples: [],
  };

  it("reports a missing folder", () => {
    const s = summarizeInspection({ ...base, exists: false, isDir: false });
    expect(s.tone).toBe("missing");
    expect(s.message).toMatch(/does not exist/i);
  });

  it("reports a path that is a file, not a folder", () => {
    const s = summarizeInspection({ ...base, isDir: false });
    expect(s.tone).toBe("missing");
    expect(s.message).toMatch(/not a folder/i);
  });

  it("reports an empty folder", () => {
    const s = summarizeInspection({ ...base, fileCount: 0 });
    expect(s.tone).toBe("empty");
    expect(s.message).toMatch(/no \.mdx or \.md/i);
  });

  it("pluralises the file count", () => {
    expect(summarizeInspection({ ...base, fileCount: 1 }).message).toContain(
      "1 readable file.",
    );
    expect(summarizeInspection({ ...base, fileCount: 3 }).message).toContain(
      "3 readable files.",
    );
  });

  it("uses an ok tone when files are present", () => {
    expect(summarizeInspection({ ...base, fileCount: 2 }).tone).toBe("ok");
  });
});

describe("recent folders persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a list through localStorage", () => {
    saveRecentFolders(["/a", "/b"]);
    expect(loadRecentFolders()).toEqual(["/a", "/b"]);
  });

  it("returns an empty array when nothing is stored", () => {
    expect(loadRecentFolders()).toEqual([]);
  });

  it("caps the persisted list to the maximum", () => {
    const many = Array.from({ length: MAX_RECENT_FOLDERS + 4 }, (_, i) =>
      String(i),
    );
    saveRecentFolders(many);
    expect(loadRecentFolders()).toHaveLength(MAX_RECENT_FOLDERS);
  });

  it("ignores malformed stored JSON", () => {
    window.localStorage.setItem(RECENT_FOLDERS_KEY, "{not json");
    expect(loadRecentFolders()).toEqual([]);
  });

  it("drops non-string and blank entries", () => {
    window.localStorage.setItem(
      RECENT_FOLDERS_KEY,
      JSON.stringify(["/a", 7, "", "/b"]),
    );
    expect(loadRecentFolders()).toEqual(["/a", "/b"]);
  });
});

describe("recent folders without a DOM", () => {
  it("loadRecentFolders returns [] when window is undefined", () => {
    expect(loadRecentFolders()).toEqual([]);
  });

  it("saveRecentFolders is a no-op when window is undefined", () => {
    expect(() => saveRecentFolders(["/a"])).not.toThrow();
  });
});

describe("active local folder persistence", () => {
  let store: Map<string, string>;
  let dispatchEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map<string, string>();
    dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      dispatchEvent,
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the selected folder as the active local source", () => {
    saveActiveLocalFolder("  /Users/me/Notes  ");

    expect(store.get(ACTIVE_LOCAL_FOLDER_KEY)).toBe("/Users/me/Notes");
    expect(loadActiveLocalFolder()).toBe("/Users/me/Notes");
  });

  it("dispatches an event so the Library rail updates in the same document", () => {
    saveActiveLocalFolder("/Users/me/Notes");

    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: LOCAL_FOLDER_CHANGED_EVENT,
    });
  });

  it("clears the active folder when given a blank path", () => {
    saveActiveLocalFolder("/Users/me/Notes");
    saveActiveLocalFolder("   ");

    expect(store.has(ACTIVE_LOCAL_FOLDER_KEY)).toBe(false);
    expect(loadActiveLocalFolder()).toBeNull();
  });
});
