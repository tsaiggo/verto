// State-store unit tests. The local-folder adapter is injected so these tests
// exercise hydration and durable mirroring without a Tauri runtime.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  isTauri: vi.fn(() => false),
  getActiveLocalLibrary: vi.fn(async () => null),
  readVaultStateVersioned: vi.fn(async () => ({ json: "{}", revision: "native-1" })),
  writeVaultStateIfRevision: vi.fn(async () => ({ revision: "native-2" })),
}));
vi.mock("@/lib/local-folder", () => ({
  ACTIVE_LOCAL_FOLDER_KEY: "verto:active-local-folder",
  LOCAL_FOLDER_CHANGED_EVENT: "verto:local-folder-changed",
  loadActiveLocalFolder: vi.fn(() => null),
  saveActiveLocalFolder: vi.fn(),
}));

import {
  getActiveLocalLibrary,
  isTauri,
  readVaultStateVersioned,
  writeVaultStateIfRevision,
} from "@/lib/tauri";
import {
  LOCAL_FOLDER_CHANGED_EVENT,
  loadActiveLocalFolder,
  saveActiveLocalFolder,
} from "@/lib/local-folder";
import { getStateStore } from "@/lib/state-store";
import {
  beginLocalFolderSwitch,
  cancelLocalFolderSwitch,
  createLocalFolderStore,
  flushLocalFolderState,
  reconcileNativeLocalFolder,
  STATE_STORE_ERROR_EVENT,
} from "@/lib/state-store/local-folder";
import { createWebStore } from "@/lib/state-store/web";

function versioned(json: string | null, revision = json === null ? null : "disk-1") {
  return { json, revision };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function portableConflict(
  expectedRevision: string | null,
  actualRevision: string | null,
  conflictPath = "/vault/.verto/conflicts/bookmarks.json"
) {
  return Object.assign(new Error("portable state changed on disk"), {
    code: "PORTABLE_STATE_CONFLICT" as const,
    expectedRevision,
    actualRevision,
    conflictPath,
  });
}

const readState = vi.fn(async () => versioned(null));
const writeState = vi.fn(async () => ({ revision: "disk-2" }));
const testFileSystem = { read: readState, write: writeState };

let store: Map<string, string>;
let listeners: Array<{ type: string; listener: (event: Event) => void }>;

function makeWindowStub() {
  store = new Map();
  listeners = [];
  return {
    localStorage: {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
    addEventListener: (type: string, listener: (event: Event) => void) => {
      listeners.push({ type, listener });
    },
    removeEventListener: (type: string, listener: (event: Event) => void) => {
      const index = listeners.findIndex(
        (candidate) => candidate.type === type && candidate.listener === listener
      );
      if (index >= 0) listeners.splice(index, 1);
    },
    dispatchEvent: (event: Event) => {
      listeners
        .filter((candidate) => candidate.type === event.type)
        .forEach((candidate) => candidate.listener(event));
      return true;
    },
  };
}

describe("WebStore", () => {
  beforeEach(() => {
    vi.stubGlobal("window", makeWindowStub());
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/home/user/vault");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("round-trips values", () => {
    const state = createWebStore();
    state.write("prefs", { theme: "dark" });
    expect(state.read("prefs", {})).toEqual({ theme: "dark" });
  });

  it("returns fallback for missing and malformed values", () => {
    const state = createWebStore();
    expect(state.read("missing", [1, 2, 3])).toEqual([1, 2, 3]);
    store.set("verto:bad", "not-json{");
    expect(state.read("bad", "fallback")).toBe("fallback");
  });

  it("returns fallback when localStorage is unavailable", () => {
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    expect(createWebStore().read("x", 99)).toBe(99);
  });

  it("updates atomically against the synchronous cache", async () => {
    const state = createWebStore();
    state.write("items", ["a"]);
    await expect(state.update<string[]>("items", [], (items) => [...items, "b"])).resolves.toEqual([
      "a",
      "b",
    ]);
    expect(state.read("items", [])).toEqual(["a", "b"]);
  });

  it("subscribes and cleans up same-tab listeners", () => {
    const state = createWebStore();
    const callback = vi.fn();
    const unsubscribe = state.subscribe(callback);
    state.write("x", "a");
    expect(callback).toHaveBeenCalledOnce();
    unsubscribe();
    state.write("x", "b");
    expect(callback).toHaveBeenCalledOnce();
  });
});

describe("LocalFolderStore", () => {
  beforeEach(() => {
    vi.stubGlobal("window", makeWindowStub());
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/home/user/vault");
    readState.mockReset().mockResolvedValue(versioned(null));
    writeState.mockReset().mockResolvedValue({ revision: "disk-2" });
    vi.mocked(readVaultStateVersioned).mockReset().mockResolvedValue(versioned("{}", "native-1"));
    vi.mocked(writeVaultStateIfRevision).mockReset().mockResolvedValue({ revision: "native-2" });
    vi.mocked(getActiveLocalLibrary).mockReset().mockResolvedValue({
      folder: "/home/user/vault",
      available: true,
      rendererMatchesActive: true,
    });
    vi.mocked(saveActiveLocalFolder).mockReset().mockReturnValue(true);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uses the web cache when there is no active folder", () => {
    vi.mocked(loadActiveLocalFolder).mockReturnValue(null);
    const state = createLocalFolderStore(null, testFileSystem);
    state.write("items", [1, 2, 3]);
    expect(state.read("items", [])).toEqual([1, 2, 3]);
  });

  it("refreshes externally replaced portable state and observes an external deletion", async () => {
    const folder = "/synced-refresh-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    let disk = versioned(JSON.stringify([{ href: "/read/first" }]), "disk-1");
    const state = createLocalFolderStore(folder, {
      read: vi.fn(async () => disk),
      write: writeState,
    });

    await state.hydrate?.("bookmarks");
    expect(state.read("bookmarks", [])).toEqual([{ href: "/read/first" }]);

    disk = versioned(JSON.stringify([{ href: "/read/remote" }]), "disk-2");
    await state.refresh?.(["bookmarks"]);
    expect(state.read("bookmarks", [])).toEqual([{ href: "/read/remote" }]);

    disk = versioned(null);
    await state.refresh?.(["bookmarks"]);
    expect(state.read("bookmarks", [])).toEqual([]);
    expect(store.has("verto:bookmarks")).toBe(false);
  });

  it("discards an old vault hydrate after an A to B to A activation cycle", async () => {
    const folder = "/aba-hydrate-vault";
    let activeFolder = folder;
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => activeFolder);
    const staleDisk = deferred<ReturnType<typeof versioned>>();
    const staleRead = vi.fn(() => staleDisk.promise);
    const staleState = createLocalFolderStore(folder, {
      read: staleRead,
      write: writeState,
    });

    const staleHydration = staleState.hydrate?.("bookmarks");
    await vi.waitFor(() => expect(staleRead).toHaveBeenCalledOnce());

    activeFolder = "/aba-other-vault";
    window.dispatchEvent(new Event(LOCAL_FOLDER_CHANGED_EVENT));
    activeFolder = folder;
    window.dispatchEvent(new Event(LOCAL_FOLDER_CHANGED_EVENT));

    const write = vi.fn(async () => ({ revision: "hydrate-current-2" }));
    const currentState = createLocalFolderStore(folder, {
      read: vi.fn(async () => versioned(JSON.stringify(["current"]), "hydrate-current-1")),
      write,
    });
    await currentState.hydrate?.("bookmarks");

    staleDisk.resolve(versioned(JSON.stringify(["stale"]), "hydrate-stale-1"));
    await staleHydration;

    expect(currentState.read("bookmarks", [])).toEqual(["current"]);
    await expect(
      currentState.update<string[]>("bookmarks", [], (items) => [...items, "local"])
    ).resolves.toEqual(["current", "local"]);
    expect(write).toHaveBeenCalledWith(
      folder,
      "bookmarks",
      JSON.stringify(["current", "local"]),
      expect.objectContaining({ expectedRevision: "hydrate-current-1" })
    );
  });

  it("discards an old vault refresh after an A to B to A activation cycle", async () => {
    const folder = "/aba-refresh-vault";
    let activeFolder = folder;
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => activeFolder);
    const staleDisk = deferred<ReturnType<typeof versioned>>();
    const staleRead = vi
      .fn()
      .mockResolvedValueOnce(versioned(JSON.stringify(["base"]), "refresh-base-1"))
      .mockImplementationOnce(() => staleDisk.promise);
    const staleState = createLocalFolderStore(folder, {
      read: staleRead,
      write: writeState,
    });

    await staleState.hydrate?.("bookmarks");
    const staleRefresh = staleState.refresh?.(["bookmarks"]);
    await vi.waitFor(() => expect(staleRead).toHaveBeenCalledTimes(2));

    activeFolder = "/aba-other-vault";
    window.dispatchEvent(new Event(LOCAL_FOLDER_CHANGED_EVENT));
    activeFolder = folder;
    window.dispatchEvent(new Event(LOCAL_FOLDER_CHANGED_EVENT));

    const write = vi.fn(async () => ({ revision: "refresh-current-2" }));
    const currentState = createLocalFolderStore(folder, {
      read: vi.fn(async () => versioned(JSON.stringify(["current"]), "refresh-current-1")),
      write,
    });
    await currentState.hydrate?.("bookmarks");

    staleDisk.resolve(versioned(JSON.stringify(["stale"]), "refresh-stale-1"));
    await staleRefresh;

    expect(currentState.read("bookmarks", [])).toEqual(["current"]);
    await expect(
      currentState.update<string[]>("bookmarks", [], (items) => [...items, "local"])
    ).resolves.toEqual(["current", "local"]);
    expect(write).toHaveBeenCalledWith(
      folder,
      "bookmarks",
      JSON.stringify(["current", "local"]),
      expect.objectContaining({ expectedRevision: "refresh-current-1" })
    );
  });

  it("never confirms an external revision when the replacement cannot enter the cache", async () => {
    const folder = "/quota-refresh-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    let disk = versioned(JSON.stringify(["base"]), "disk-1");
    const write = vi.fn(async () => ({ revision: "disk-3" }));
    const state = createLocalFolderStore(folder, {
      read: vi.fn(async () => disk),
      write,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await state.hydrate?.("bookmarks");
    disk = versioned(JSON.stringify(["remote"]), "disk-2");

    const setItem = window.localStorage.setItem.bind(window.localStorage);
    const setItemSpy = vi.spyOn(window.localStorage, "setItem").mockImplementation((key, value) => {
      if (key === "verto:bookmarks") throw new Error("quota exceeded");
      setItem(key, value);
    });

    await expect(state.refresh?.(["bookmarks"])).rejects.toThrow(
      'Could not update the local cache for "bookmarks".'
    );
    expect(store.get("verto:bookmarks")).toBe(JSON.stringify(["base"]));
    await expect(
      state.update<string[]>("bookmarks", [], (current) => [...current, "local"])
    ).rejects.toThrow('Could not update the local cache for "bookmarks".');
    expect(write).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
    await expect(
      state.update<string[]>("bookmarks", [], (current) => [...current, "local"])
    ).resolves.toEqual(["remote", "local"]);
    expect(write).toHaveBeenCalledWith(
      folder,
      "bookmarks",
      JSON.stringify(["remote", "local"]),
      expect.objectContaining({ expectedRevision: "disk-2" })
    );
    errorSpy.mockRestore();
  });

  it("never revives an external deletion when cache removal fails", async () => {
    const folder = "/quota-delete-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    let disk = versioned(JSON.stringify(["base"]), "disk-1");
    const write = vi.fn(async () => ({ revision: "disk-2" }));
    const state = createLocalFolderStore(folder, {
      read: vi.fn(async () => disk),
      write,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await state.hydrate?.("bookmarks");
    disk = versioned(null);

    const removeItem = window.localStorage.removeItem.bind(window.localStorage);
    const removeItemSpy = vi.spyOn(window.localStorage, "removeItem").mockImplementation((key) => {
      if (key === "verto:bookmarks") throw new Error("storage unavailable");
      removeItem(key);
    });

    await expect(state.refresh?.(["bookmarks"])).rejects.toThrow(
      'Could not update the local cache for "bookmarks".'
    );
    expect(store.get("verto:bookmarks")).toBe(JSON.stringify(["base"]));
    await expect(
      state.update<string[]>("bookmarks", [], (current) => [...current, "local"])
    ).rejects.toThrow('Could not update the local cache for "bookmarks".');
    expect(write).not.toHaveBeenCalled();

    removeItemSpy.mockRestore();
    await expect(
      state.update<string[]>("bookmarks", [], (current) => [...current, "local"])
    ).resolves.toEqual(["local"]);
    expect(write).toHaveBeenCalledWith(
      folder,
      "bookmarks",
      JSON.stringify(["local"]),
      expect.objectContaining({ expectedRevision: null })
    );
    errorSpy.mockRestore();
  });

  it("continues refreshing independent names after one portable read fails", async () => {
    const folder = "/partial-refresh-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    const failure = new Error("annotations is temporarily unreadable");
    const read = vi.fn(async (_folder: string, name: string) => {
      if (name === "annotations") throw failure;
      return versioned(JSON.stringify([{ href: "/read/remote" }]), "remote-2");
    });
    const state = createLocalFolderStore(folder, { read, write: writeState });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(state.refresh?.(["annotations", "bookmarks"])).rejects.toBe(failure);

    expect(read.mock.calls.map((call) => call[1])).toEqual(["annotations", "bookmarks"]);
    expect(state.read("bookmarks", [])).toEqual([{ href: "/read/remote" }]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not hydrate "annotations"'),
      failure
    );
    errorSpy.mockRestore();
  });

  it("ignores external state names that collide with application control keys", async () => {
    const folder = "/state-name-boundary-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    store.set("verto:active-local-folder", folder);
    store.set("verto:state-store-dirty-index", JSON.stringify(["bookmarks"]));
    const read = vi.fn(async (_folder: string, name: string) =>
      versioned(
        name === "bookmarks"
          ? JSON.stringify(["remote-bookmark"])
          : JSON.stringify("/attacker-vault"),
        `${name}-remote`
      )
    );
    const state = createLocalFolderStore(folder, { read, write: writeState });

    await state.refresh?.(["active-local-folder", "state-store-dirty-index", "bookmarks"]);

    expect(read.mock.calls.map((call) => call[1])).toEqual(["bookmarks"]);
    expect(store.get("verto:active-local-folder")).toBe(folder);
    expect(store.get("verto:state-store-dirty-index")).toBe(JSON.stringify(["bookmarks"]));
    expect(state.read("bookmarks", [])).toEqual(["remote-bookmark"]);
  });

  it("refreshes one name despite another name's failed mirror and fails closed for the dirty name", async () => {
    const folder = "/cross-name-refresh-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    const disk = new Map([
      ["annotations", versioned(JSON.stringify(["base-note"]), "annotations-1")],
      ["bookmarks", versioned(JSON.stringify(["base-bookmark"]), "bookmarks-1")],
    ]);
    const conflict = portableConflict("annotations-1", "annotations-remote");
    const read = vi.fn(async (_folder: string, name: string) => disk.get(name) ?? versioned(null));
    const write = vi.fn(async (_folder: string, name: string) => {
      if (name === "annotations") throw conflict;
      return { revision: `${name}-2` };
    });
    const state = createLocalFolderStore(folder, { read, write });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await state.hydrate?.("annotations");
    await state.hydrate?.("bookmarks");
    state.write("annotations", ["local-note"]);
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());

    disk.set("bookmarks", versioned(JSON.stringify(["remote-bookmark"]), "bookmarks-2"));
    await expect(state.refresh?.(["bookmarks"])).resolves.toBeUndefined();
    expect(state.read("bookmarks", [])).toEqual(["remote-bookmark"]);
    expect(state.read("annotations", [])).toEqual(["local-note"]);

    await expect(state.refresh?.(["annotations"])).rejects.toThrow("Could not safely refresh");
    expect(state.read("annotations", [])).toEqual(["local-note"]);
    errorSpy.mockRestore();
  });

  it("disconnects a stale upgrade root while preserving legacy cache ownership", async () => {
    let current: string | null = "/legacy-vault";
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => current);
    vi.mocked(getActiveLocalLibrary).mockResolvedValue({
      folder: null,
      available: false,
      rendererMatchesActive: false,
    });
    vi.mocked(saveActiveLocalFolder).mockImplementation((folder) => {
      current = folder || null;
      return true;
    });
    store.set("verto:summaries", JSON.stringify({ summaries: [{ href: "/read/a" }] }));

    await expect(reconcileNativeLocalFolder()).resolves.toEqual({
      folder: null,
      available: false,
    });

    expect(saveActiveLocalFolder).toHaveBeenCalledWith("");
    expect(store.get("verto:state-store-origin:summaries")).toBe("/legacy-vault");
    expect(store.get("verto:state-store-recovery:%2Flegacy-vault:summaries")).toContain("/read/a");
    expect(current).toBeNull();
  });

  it("uses native active state after a crash without mirroring the stale vault cache", async () => {
    let current: string | null = "/vault-a";
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => current);
    vi.mocked(getActiveLocalLibrary).mockResolvedValue({
      folder: "/vault-b",
      available: true,
      rendererMatchesActive: false,
    });
    vi.mocked(saveActiveLocalFolder).mockImplementation((folder) => {
      current = folder || null;
      return true;
    });
    const stale = JSON.stringify([{ href: "/read/a" }]);
    const portable = JSON.stringify([{ href: "/read/b" }]);
    store.set("verto:bookmarks", stale);

    await expect(reconcileNativeLocalFolder()).resolves.toEqual({
      folder: "/vault-b",
      available: true,
    });
    expect(store.get("verto:state-store-origin:bookmarks")).toBe("/vault-a");
    expect(current).toBe("/vault-b");

    readState.mockResolvedValue(versioned(portable, "vault-b-1"));
    const state = createLocalFolderStore("/vault-b", testFileSystem);
    await state.hydrate?.("bookmarks");

    expect(state.read("bookmarks", [])).toEqual([{ href: "/read/b" }]);
    expect(writeState).not.toHaveBeenCalledWith("/vault-b", "bookmarks", stale);
  });

  it("mirrors writes through the native vault-state boundary", async () => {
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);
    state.write("bookmarks", { items: [] });

    await vi.waitFor(() => expect(writeState).toHaveBeenCalledOnce());
    expect(writeState).toHaveBeenCalledWith(
      "/home/user/vault",
      "bookmarks",
      JSON.stringify({ items: [] }),
      expect.objectContaining({ expectedRevision: null })
    );
  });

  it("serializes mirrors so a slow old write cannot overwrite a newer value", async () => {
    let releaseFirst!: () => void;
    writeState
      .mockImplementationOnce(
        () =>
          new Promise<{ revision: string }>((resolve) => {
            releaseFirst = () => resolve({ revision: "reading-1" });
          })
      )
      .mockResolvedValueOnce({ revision: "reading-2" });
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);
    await state.hydrate?.("reading-state");

    state.write("reading-state", { revision: 1 });
    state.write("reading-state", { revision: 2 });

    await vi.waitFor(() => expect(writeState).toHaveBeenCalledTimes(1));
    releaseFirst();
    await vi.waitFor(() => expect(writeState).toHaveBeenCalledTimes(2));
    expect(writeState).toHaveBeenNthCalledWith(
      2,
      "/home/user/vault",
      "reading-state",
      JSON.stringify({ revision: 2 }),
      expect.objectContaining({ expectedRevision: "reading-1" })
    );
  });

  it("hydrates portable JSON into the synchronous cache", async () => {
    readState.mockResolvedValue(versioned(JSON.stringify({ items: ["portable"] })));
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    expect(state.read("bookmarks", { items: [] })).toEqual({ items: [] });
    await state.hydrate?.("bookmarks");

    expect(readState).toHaveBeenCalledWith("/home/user/vault", "bookmarks");
    expect(state.read("bookmarks", { items: [] })).toEqual({ items: ["portable"] });
    expect(store.get("verto:bookmarks")).toBe(JSON.stringify({ items: ["portable"] }));
  });

  it("does not expose another vault's cache while hydration is pending", async () => {
    store.set("verto:state-store-origin:bookmarks", "/home/user/other-vault");
    store.set("verto:bookmarks", JSON.stringify({ items: ["other"] }));
    readState.mockResolvedValue(versioned(JSON.stringify({ items: ["active"] })));
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    expect(state.read("bookmarks", { items: [] })).toEqual({ items: [] });
    await state.hydrate?.("bookmarks");
    expect(state.read("bookmarks", { items: [] })).toEqual({ items: ["active"] });
  });

  it("never seeds one vault from another vault's cache with a stale legacy marker", async () => {
    const folder = "/home/user/vault-a";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    store.set("verto:state-store-origin:bookmarks", "/home/user/vault-b");
    store.set("verto:bookmarks", JSON.stringify({ items: ["vault-b"] }));
    store.set("verto:state-store-dirty:bookmarks", JSON.stringify({ folder, revision: 1 }));
    const state = createLocalFolderStore(folder, testFileSystem);

    await state.hydrate?.("bookmarks");

    expect(writeState).not.toHaveBeenCalled();
    expect(state.read("bookmarks", { items: [] })).toEqual({ items: [] });
    expect(store.get("verto:bookmarks")).toBe(JSON.stringify({ items: ["vault-b"] }));
    expect(store.get("verto:state-store-origin:bookmarks")).toBe("/home/user/vault-b");
  });

  it("seeds a missing portable file from unowned legacy localStorage once", async () => {
    const legacy = JSON.stringify({ items: ["legacy"] });
    store.set("verto:bookmarks", legacy);
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    await state.hydrate?.("bookmarks");

    expect(writeState).toHaveBeenCalledWith(
      "/home/user/vault",
      "bookmarks",
      legacy,
      expect.objectContaining({ expectedRevision: null })
    );
    expect(store.get("verto:state-store-origin:bookmarks")).toBe("/home/user/vault");
  });

  it("repairs a missing portable file left by the legacy desktop mirror", async () => {
    const legacy = JSON.stringify({ items: ["outside-home"] });
    store.set("verto:state-store-origin:bookmarks", "/home/user/vault");
    store.set("verto:bookmarks", legacy);
    store.set(
      "verto:state-store-dirty:bookmarks",
      JSON.stringify({ folder: "/home/user/vault", revision: 1 })
    );
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    await state.hydrate?.("bookmarks");

    expect(writeState).toHaveBeenCalledWith(
      "/home/user/vault",
      "bookmarks",
      legacy,
      expect.objectContaining({ expectedRevision: null })
    );
    expect(state.read("bookmarks", { items: [] })).toEqual({ items: ["outside-home"] });
  });

  it("reports mirror failures and blocks a library hand-off", async () => {
    const failure = new Error("disk is read-only");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    writeState.mockRejectedValueOnce(failure);
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/read-only-vault");
    const state = createLocalFolderStore("/read-only-vault", testFileSystem);

    state.write("bookmarks", { items: [] });
    await expect(flushLocalFolderState("/read-only-vault")).rejects.toThrow(
      "Could not finish saving"
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not mirror "bookmarks"'),
      failure
    );
    errorSpy.mockRestore();
  });

  it("keeps the v2 journal and original baseline when a CAS write conflicts", async () => {
    const folder = "/cas-conflict-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    const conflict = portableConflict(
      "cas-base",
      "cas-external",
      "/cas-conflict-vault/.verto/conflicts/bookmarks.external.json"
    );
    const write = vi.fn().mockRejectedValue(conflict);
    const state = createLocalFolderStore(folder, {
      read: vi.fn().mockResolvedValue(versioned(JSON.stringify(["base"]), "cas-base")),
      write,
    });
    const details: unknown[] = [];
    window.addEventListener(STATE_STORE_ERROR_EVENT, (event) => {
      details.push((event as CustomEvent<unknown>).detail);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await state.hydrate?.("bookmarks");
    state.write("bookmarks", ["local"]);
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    await expect(flushLocalFolderState(folder)).rejects.toThrow("Could not finish saving");

    const journalKey = "verto:state-store-recovery:%2Fcas-conflict-vault:bookmarks";
    const journal = JSON.parse(store.get(journalKey) ?? "{}");
    expect(journal).toMatchObject({
      version: 2,
      folder,
      name: "bookmarks",
      json: JSON.stringify(["local"]),
      expectedRevision: "cas-base",
      expectedKnown: true,
    });
    expect(journal.createdAt).toEqual(expect.any(Number));
    expect(store.get("verto:bookmarks")).toBe(JSON.stringify(["local"]));
    expect(store.get("verto:state-store-dirty-index")).toContain("bookmarks");
    expect(details).toContainEqual(
      expect.objectContaining({
        operation: "mirror",
        code: "PORTABLE_STATE_CONFLICT",
        expectedRevision: "cas-base",
        actualRevision: "cas-external",
        conflictPath: conflict.conflictPath,
      })
    );
    await expect(beginLocalFolderSwitch(folder)).rejects.toThrow("Could not finish saving");

    // A retry must keep the last confirmed baseline. Treating the conflicting
    // actual revision as confirmed would silently overwrite that external edit.
    state.write("bookmarks", ["local", "retry"]);
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write.mock.calls.map((call) => call[3].expectedRevision)).toEqual([
      "cas-base",
      "cas-base",
    ]);
    expect(JSON.parse(store.get(journalKey) ?? "{}")).toMatchObject({
      json: JSON.stringify(["local", "retry"]),
      expectedRevision: "cas-base",
      expectedKnown: true,
    });
    errorSpy.mockRestore();
  });

  it("upgrades a legacy recovery entry and safely seeds a still-missing state file", async () => {
    const folder = "/legacy-journal-vault";
    const journalKey = "verto:state-store-recovery:%2Flegacy-journal-vault:reading-state";
    const json = JSON.stringify({ position: 42 });
    store.set(
      journalKey,
      JSON.stringify({
        folder,
        name: "reading-state",
        json,
        token: "legacy-token",
      })
    );
    store.set(
      "verto:state-store-dirty-index",
      JSON.stringify([{ folder, names: ["reading-state"] }])
    );
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    const write = vi.fn().mockResolvedValue({ revision: "legacy-seeded" });
    const state = createLocalFolderStore(folder, {
      read: vi.fn().mockResolvedValue(versioned(null)),
      write,
    });

    await state.hydrate?.("reading-state");

    expect(write).toHaveBeenCalledWith(
      folder,
      "reading-state",
      json,
      expect.objectContaining({
        expectedRevision: null,
        recoveryToken: "legacy-token",
      })
    );
    expect(state.read("reading-state", {})).toEqual({ position: 42 });
    expect(store.get(journalKey)).toBeUndefined();
    expect(store.get("verto:state-store-dirty-index")).toBeUndefined();
  });

  it("never adopts a retry-time remote revision as the baseline for an earlier local edit", async () => {
    const folder = "/failed-baseline-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    const remote = JSON.stringify({ value: "remote-r2" });
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("first versioned read failed"))
      .mockResolvedValue(versioned(remote, "remote-r2"));
    const write = vi.fn(
      async (
        _folder: string,
        _name: string,
        _json: string,
        options: { expectedRevision: string | null }
      ) => {
        throw portableConflict(options.expectedRevision, "remote-r2");
      }
    );
    const state = createLocalFolderStore(folder, { read, write });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    state.write("bookmarks", { value: "local-before-read" });
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(store.get("verto:state-store-recovery:%2Ffailed-baseline-vault:bookmarks")).toContain(
        "local-before-read"
      )
    );

    await expect(state.hydrate?.("bookmarks")).rejects.toMatchObject({
      code: "PORTABLE_STATE_CONFLICT",
      actualRevision: "remote-r2",
    });
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[3].expectedRevision).toBeNull();
    expect(JSON.parse(store.get("verto:bookmarks") ?? "{}")).toEqual({
      value: "local-before-read",
    });
    expect(store.get("verto:state-store-recovery:%2Ffailed-baseline-vault:bookmarks")).toContain(
      "local-before-read"
    );
    errorSpy.mockRestore();
  });

  it("keeps confirmed revisions isolated by folder and reuses one device writer id", async () => {
    let current = "/revision-vault-a";
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => current);
    const writeA = vi.fn().mockResolvedValue({ revision: "a-next" });
    const a = createLocalFolderStore(current, {
      read: vi.fn().mockResolvedValue(versioned(JSON.stringify([]), "a-base")),
      write: writeA,
    });
    await a.hydrate?.("bookmarks");
    await a.update<string[]>("bookmarks", [], (items) => [...items, "a"]);

    current = "/revision-vault-b";
    const writeB = vi.fn().mockResolvedValue({ revision: "b-next" });
    const b = createLocalFolderStore(current, {
      read: vi.fn().mockResolvedValue(versioned(JSON.stringify([]), "b-base")),
      write: writeB,
    });
    await b.hydrate?.("bookmarks");
    await b.update<string[]>("bookmarks", [], (items) => [...items, "b"]);

    expect(writeA.mock.calls[0]?.[3]).toMatchObject({ expectedRevision: "a-base" });
    expect(writeB.mock.calls[0]?.[3]).toMatchObject({ expectedRevision: "b-base" });
    expect(writeA.mock.calls[0]?.[3].writerId).toBe(writeB.mock.calls[0]?.[3].writerId);
    expect(store.get("verto:state-store-writer-id")).toBe(writeA.mock.calls[0]?.[3].writerId);
  });

  it("retries a failed portable hydrate instead of caching the failure", async () => {
    const failure = new Error("vault is temporarily unavailable");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    readState
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(versioned(JSON.stringify({ items: ["restored"] })));
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    await expect(state.hydrate?.("bookmarks")).rejects.toThrow(failure.message);
    await state.hydrate?.("bookmarks");

    expect(readState).toHaveBeenCalledTimes(2);
    expect(state.read("bookmarks", { items: [] })).toEqual({ items: ["restored"] });
    errorSpy.mockRestore();
  });

  it("blocks a library switch while any portable hydrate is unreadable", async () => {
    const failure = new Error("portable JSON is malformed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    readState.mockRejectedValueOnce(failure);
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);
    void state.read("summaries", { summaries: [] });

    await expect(beginLocalFolderSwitch("/home/user/vault")).rejects.toThrow(failure.message);

    errorSpy.mockRestore();
  });

  it("does not let a slow old-vault hydrate overwrite the active vault cache", async () => {
    let activeFolder = "/vault-a";
    let releaseVaultA!: (value: { json: string | null; revision: string | null }) => void;
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => activeFolder);
    const readVaultA = vi.fn(
      () =>
        new Promise<{ json: string | null; revision: string | null }>((resolve) => {
          releaseVaultA = resolve;
        })
    );
    const vaultA = createLocalFolderStore("/vault-a", {
      read: readVaultA,
      write: vi.fn().mockResolvedValue({ revision: "vault-a-2" }),
    });
    const vaultB = createLocalFolderStore("/vault-b", {
      read: vi
        .fn()
        .mockResolvedValue(versioned(JSON.stringify({ items: ["vault-b"] }), "vault-b-1")),
      write: vi.fn().mockResolvedValue({ revision: "vault-b-2" }),
    });

    void vaultA.read("bookmarks", { items: [] });
    await vi.waitFor(() => expect(readVaultA).toHaveBeenCalledOnce());
    activeFolder = "/vault-b";
    void vaultB.read("bookmarks", { items: [] });
    await vaultB.hydrate?.("bookmarks");
    releaseVaultA(versioned(JSON.stringify({ items: ["vault-a"] }), "vault-a-1"));
    await vaultA.hydrate?.("bookmarks");

    expect(store.get("verto:state-store-origin:bookmarks")).toBe("/vault-b");
    expect(vaultB.read("bookmarks", { items: [] })).toEqual({ items: ["vault-b"] });
  });

  it("waits for hydration before applying a read-modify-write", async () => {
    let releaseRead!: (value: { json: string | null; revision: string | null }) => void;
    readState.mockImplementationOnce(
      () =>
        new Promise<{ json: string | null; revision: string | null }>((resolve) => {
          releaseRead = resolve;
        })
    );
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    const updating = state.update<string[]>("bookmarks", [], (items) => [...items, "new"]);
    expect(writeState).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(readState).toHaveBeenCalledOnce());
    releaseRead(versioned(JSON.stringify(["portable"])));

    await expect(updating).resolves.toEqual(["portable", "new"]);
    await vi.waitFor(() =>
      expect(writeState).toHaveBeenCalledWith(
        "/home/user/vault",
        "bookmarks",
        JSON.stringify(["portable", "new"]),
        expect.objectContaining({ expectedRevision: "disk-1" })
      )
    );
  });

  it("serializes concurrent updates against the latest cache value", async () => {
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    const first = state.update<string[]>("bookmarks", [], (items) => [...items, "a"]);
    const second = state.update<string[]>("bookmarks", [], (items) => [...items, "b"]);

    await expect(first).resolves.toEqual(["a"]);
    await expect(second).resolves.toEqual(["a", "b"]);
    expect(state.read("bookmarks", [])).toEqual(["a", "b"]);
  });

  it("does not merge vault A cache into a missing vault B file", async () => {
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/vault-b");
    store.set("verto:state-store-origin:bookmarks", "/vault-a");
    store.set("verto:bookmarks", JSON.stringify(["a"]));
    const state = createLocalFolderStore("/vault-b", testFileSystem);

    await expect(
      state.update<string[]>("bookmarks", [], (items) => [...items, "b"])
    ).resolves.toEqual(["b"]);
    expect(state.read("bookmarks", [])).toEqual(["b"]);
    expect(writeState).toHaveBeenCalledWith(
      "/vault-b",
      "bookmarks",
      JSON.stringify(["b"]),
      expect.objectContaining({ expectedRevision: null })
    );
  });

  it("rejects an update after hydrate failure without overwriting portable state", async () => {
    const failure = new Error("malformed portable JSON");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    readState.mockRejectedValueOnce(failure);
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    await expect(
      state.update<string[]>("bookmarks", [], (items) => [...items, "new"])
    ).rejects.toThrow(failure.message);
    expect(writeState).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("flushes the newest A state before the caller activates vault B", async () => {
    let activeFolder = "/vault-a";
    let releaseFirst!: () => void;
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => activeFolder);
    const writes: string[] = [];
    const writeA = vi
      .fn()
      .mockImplementationOnce(
        (_folder: string, _name: string, json: string) =>
          new Promise<{ revision: string }>((resolve) => {
            writes.push(json);
            releaseFirst = () => resolve({ revision: "vault-a-1" });
          })
      )
      .mockImplementationOnce(async (_folder: string, _name: string, json: string) => {
        writes.push(json);
        return { revision: "vault-a-2" };
      });
    const state = createLocalFolderStore("/vault-a", {
      read: vi.fn().mockResolvedValue(versioned(null)),
      write: writeA,
    });
    await state.hydrate?.("reading-state");
    state.write("reading-state", { revision: 1 });
    state.write("reading-state", { revision: 2 });

    const handoff = beginLocalFolderSwitch("/vault-a");
    state.write("reading-state", { revision: 3 });
    await vi.waitFor(() => expect(writeA).toHaveBeenCalledTimes(1));
    expect(activeFolder).toBe("/vault-a");
    releaseFirst();
    await handoff;
    activeFolder = "/vault-b";

    expect(writeA).toHaveBeenCalledTimes(2);
    expect(writes.at(-1)).toBe(JSON.stringify({ revision: 2 }));
    expect(activeFolder).toBe("/vault-b");
  });

  it("coalesces queued mirrors to the latest payload", async () => {
    let releaseFirst!: () => void;
    const mirror = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ revision: string }>((resolve) => {
            releaseFirst = () => resolve({ revision: "coalesce-1" });
          })
      )
      .mockResolvedValue({ revision: "coalesce-2" });
    const state = createLocalFolderStore("/coalesce-vault", {
      read: vi.fn().mockResolvedValue(versioned(null)),
      write: mirror,
    });
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/coalesce-vault");
    await state.hydrate?.("reading-state");

    state.write("reading-state", { revision: 1 });
    state.write("reading-state", { revision: 2 });
    state.write("reading-state", { revision: 3 });
    await vi.waitFor(() => expect(mirror).toHaveBeenCalledOnce());
    releaseFirst();
    await flushLocalFolderState("/coalesce-vault");

    expect(mirror).toHaveBeenCalledTimes(2);
    expect(mirror).toHaveBeenLastCalledWith(
      "/coalesce-vault",
      "reading-state",
      JSON.stringify({ revision: 3 }),
      expect.objectContaining({ expectedRevision: "coalesce-1" })
    );
  });

  it("recovers a dirty synchronous cache after termination before mirror completion", async () => {
    const neverFinishes = new Promise<{ revision: string }>(() => {});
    const firstWrite = vi.fn(() => neverFinishes);
    const firstProcess = createLocalFolderStore("/crash-vault", {
      read: vi.fn().mockResolvedValue(versioned(JSON.stringify({ revision: 1 }), "crash-1")),
      write: firstWrite,
    });
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/crash-vault");
    await firstProcess.hydrate?.("reading-state");
    firstProcess.write("reading-state", { revision: 2 });
    await vi.waitFor(() => expect(firstWrite).toHaveBeenCalledOnce());

    expect(store.get("verto:state-store-recovery:%2Fcrash-vault:reading-state")).toBeTruthy();
    const recoveryWrite = vi.fn().mockResolvedValue({ revision: "crash-2" });
    const restarted = createLocalFolderStore("/crash-vault", {
      read: vi.fn().mockResolvedValue(versioned(JSON.stringify({ revision: 1 }), "crash-1")),
      write: recoveryWrite,
    });

    await restarted.hydrate?.("reading-state");

    expect(recoveryWrite).toHaveBeenCalledWith(
      "/crash-vault",
      "reading-state",
      JSON.stringify({ revision: 2 }),
      expect.objectContaining({ expectedRevision: "crash-1" })
    );
    expect(restarted.read("reading-state", { revision: 0 })).toEqual({ revision: 2 });
    expect(store.get("verto:state-store-recovery:%2Fcrash-vault:reading-state")).toBeUndefined();
  });

  it("preserves a legacy recovery journal instead of overwriting newer portable state", async () => {
    const vaultA = "/legacy-conflict-vault-a";
    const vaultB = "/legacy-conflict-vault-b";
    let current: string | null = vaultA;
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => current);
    vi.mocked(saveActiveLocalFolder).mockImplementation((folder) => {
      current = folder || null;
      return true;
    });
    vi.mocked(getActiveLocalLibrary).mockResolvedValue({
      folder: null,
      available: false,
      rendererMatchesActive: false,
    });
    const exactA = JSON.stringify([{ href: "/a/exact" }]);
    const valueB = [{ href: "/b/new" }];
    const disk = new Map<string, { json: string; revision: string }>([
      [
        `${vaultA}:bookmarks`,
        { json: JSON.stringify([{ href: "/a/old" }]), revision: "vault-a-newer" },
      ],
    ]);
    const fileSystem = {
      read: vi.fn(async (folder: string, name: string) => {
        const current = disk.get(`${folder}:${name}`);
        return current ? versioned(current.json, current.revision) : versioned(null);
      }),
      write: vi.fn(
        async (
          folder: string,
          name: string,
          json: string,
          options: { expectedRevision: string | null }
        ) => {
          const current = disk.get(`${folder}:${name}`);
          if ((current?.revision ?? null) !== options.expectedRevision) {
            throw portableConflict(options.expectedRevision, current?.revision ?? null);
          }
          disk.set(`${folder}:${name}`, { json, revision: `${folder}-${name}-next` });
          return { revision: `${folder}-${name}-next` };
        }
      ),
    };
    store.set("verto:bookmarks", exactA);

    await reconcileNativeLocalFolder();
    expect(current).toBeNull();

    current = vaultB;
    const b = createLocalFolderStore(vaultB, fileSystem);
    await b.hydrate?.("bookmarks");
    await b.update("bookmarks", [], () => valueB);
    expect(store.get("verto:bookmarks")).toBe(JSON.stringify(valueB));

    current = vaultA;
    const recoveredA = createLocalFolderStore(vaultA, fileSystem);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recoveredA.hydrate?.("bookmarks")).rejects.toMatchObject({
      code: "PORTABLE_STATE_CONFLICT",
    });
    expect(disk.get(`${vaultA}:bookmarks`)?.json).toBe(JSON.stringify([{ href: "/a/old" }]));
    expect(fileSystem.write).toHaveBeenLastCalledWith(
      vaultA,
      "bookmarks",
      exactA,
      expect.objectContaining({ expectedRevision: null })
    );
    expect(
      JSON.parse(
        store.get("verto:state-store-recovery:%2Flegacy-conflict-vault-a:bookmarks") ?? "{}"
      ).json
    ).toBe(exactA);
    expect(store.get("verto:state-store-dirty-index")).toContain("bookmarks");
    errorSpy.mockRestore();
  });

  it("recovers indexed dirty state before switching even when its store never mounts", async () => {
    const folder = "/restart-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    store.set("verto:state-store-origin:reading-state", folder);
    store.set("verto:reading-state", JSON.stringify({ revision: 9 }));
    store.set("verto:state-store-dirty:reading-state", JSON.stringify({ folder, revision: 9 }));
    store.set(
      "verto:state-store-dirty-index",
      JSON.stringify([{ folder, names: ["reading-state"] }])
    );
    vi.mocked(readVaultStateVersioned).mockImplementation(async (_folder: string, name: string) =>
      name === "reading-state" ? versioned(null) : versioned("{}")
    );

    await beginLocalFolderSwitch(folder);

    expect(writeVaultStateIfRevision).toHaveBeenCalledWith(
      folder,
      "reading-state",
      JSON.stringify({ revision: 9 }),
      expect.objectContaining({ expectedRevision: null })
    );
    expect(store.get("verto:state-store-dirty:reading-state")).toBeUndefined();
    cancelLocalFolderSwitch(folder);
  });

  it("claims every known unowned legacy cache before switching vaults", async () => {
    const folder = "/legacy-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    const cached = JSON.stringify({ summaries: [{ href: "/read/a" }] });
    store.set("verto:summaries", cached);
    vi.mocked(readVaultStateVersioned).mockImplementation(async (_folder: string, name: string) =>
      name === "summaries" ? versioned(null) : versioned("{}")
    );

    await beginLocalFolderSwitch(folder);

    expect(writeVaultStateIfRevision).toHaveBeenCalledWith(
      folder,
      "summaries",
      cached,
      expect.objectContaining({ expectedRevision: null })
    );
    expect(store.get("verto:state-store-origin:summaries")).toBe(folder);
    cancelLocalFolderSwitch(folder);
  });

  it("never overwrites existing portable state with an unowned legacy cache", async () => {
    const folder = "/shared-vault";
    const portable = JSON.stringify([{ href: "/read/portable" }]);
    const legacy = JSON.stringify([{ href: "/read/legacy" }]);
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    store.set("verto:bookmarks", legacy);
    vi.mocked(readVaultStateVersioned).mockImplementation(async (_folder: string, name: string) =>
      name === "bookmarks" ? versioned(portable) : versioned("{}")
    );

    await beginLocalFolderSwitch(folder);

    expect(writeVaultStateIfRevision).not.toHaveBeenCalledWith(
      folder,
      "bookmarks",
      legacy,
      expect.anything()
    );
    expect(store.get("verto:bookmarks")).toBe(portable);
    expect(store.get("verto:state-store-origin:bookmarks")).toBe(folder);
    cancelLocalFolderSwitch(folder);
  });
});

describe("getStateStore factory", () => {
  beforeEach(() => vi.stubGlobal("window", makeWindowStub()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns a web store outside Tauri", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(loadActiveLocalFolder).mockReturnValue(null);
    const state = getStateStore();
    state.write("check", true);
    expect(state.read("check", false)).toBe(true);
  });

  it("returns a web store in Tauri when no folder is active", () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(loadActiveLocalFolder).mockReturnValue(null);
    const state = getStateStore();
    state.write("check", true);
    expect(state.read("check", false)).toBe(true);
  });

  it("returns a null store during SSR", () => {
    vi.stubGlobal("window", undefined);
    const state = getStateStore();
    expect(state.read("x", "fallback")).toBe("fallback");
    expect(() => state.write("x", 1)).not.toThrow();
  });
});
