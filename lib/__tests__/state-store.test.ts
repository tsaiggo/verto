// State-store unit tests. The local-folder adapter is injected so these tests
// exercise hydration and durable mirroring without a Tauri runtime.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", () => ({
  isTauri: vi.fn(() => false),
  getActiveLocalLibrary: vi.fn(async () => null),
  readVaultState: vi.fn(async () => "{}"),
  writeVaultState: vi.fn(async () => {}),
}));
vi.mock("@/lib/local-folder", () => ({
  loadActiveLocalFolder: vi.fn(() => null),
  saveActiveLocalFolder: vi.fn(),
}));

import { getActiveLocalLibrary, isTauri, readVaultState, writeVaultState } from "@/lib/tauri";
import { loadActiveLocalFolder, saveActiveLocalFolder } from "@/lib/local-folder";
import { getStateStore } from "@/lib/state-store";
import {
  beginLocalFolderSwitch,
  cancelLocalFolderSwitch,
  createLocalFolderStore,
  flushLocalFolderState,
  reconcileNativeLocalFolder,
} from "@/lib/state-store/local-folder";
import { createWebStore } from "@/lib/state-store/web";

const readState = vi.fn(async (): Promise<string | null> => null);
const writeState = vi.fn(async (): Promise<void> => {});
const testFileSystem = { read: readState, write: writeState };

let store: Map<string, string>;
let listeners: Array<(event: Event) => void>;

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
      if (type === "storage") listeners.push(listener);
    },
    removeEventListener: (_type: string, listener: (event: Event) => void) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    dispatchEvent: (event: Event) => {
      listeners.forEach((listener) => listener(event));
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
    readState.mockReset().mockResolvedValue(null);
    writeState.mockReset().mockResolvedValue(undefined);
    vi.mocked(readVaultState).mockReset().mockResolvedValue("{}");
    vi.mocked(writeVaultState).mockReset().mockResolvedValue(undefined);
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

    readState.mockResolvedValue(portable);
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
      JSON.stringify({ items: [] })
    );
  });

  it("serializes mirrors so a slow old write cannot overwrite a newer value", async () => {
    let releaseFirst!: () => void;
    writeState
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          })
      )
      .mockResolvedValueOnce(undefined);
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    state.write("reading-state", { revision: 1 });
    state.write("reading-state", { revision: 2 });

    await vi.waitFor(() => expect(writeState).toHaveBeenCalledTimes(1));
    releaseFirst();
    await vi.waitFor(() => expect(writeState).toHaveBeenCalledTimes(2));
    expect(writeState).toHaveBeenNthCalledWith(
      2,
      "/home/user/vault",
      "reading-state",
      JSON.stringify({ revision: 2 })
    );
  });

  it("hydrates portable JSON into the synchronous cache", async () => {
    readState.mockResolvedValue(JSON.stringify({ items: ["portable"] }));
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
    readState.mockResolvedValue(JSON.stringify({ items: ["active"] }));
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    expect(state.read("bookmarks", { items: [] })).toEqual({ items: [] });
    await state.hydrate?.("bookmarks");
    expect(state.read("bookmarks", { items: [] })).toEqual({ items: ["active"] });
  });

  it("seeds a missing portable file from unowned legacy localStorage once", async () => {
    const legacy = JSON.stringify({ items: ["legacy"] });
    store.set("verto:bookmarks", legacy);
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    await state.hydrate?.("bookmarks");

    expect(writeState).toHaveBeenCalledWith("/home/user/vault", "bookmarks", legacy);
    expect(store.get("verto:state-store-origin:bookmarks")).toBe("/home/user/vault");
  });

  it("repairs a missing portable file left by the legacy desktop mirror", async () => {
    const legacy = JSON.stringify({ items: ["outside-home"] });
    store.set("verto:state-store-origin:bookmarks", "/home/user/vault");
    store.set("verto:bookmarks", legacy);
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    await state.hydrate?.("bookmarks");

    expect(writeState).toHaveBeenCalledWith("/home/user/vault", "bookmarks", legacy);
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

  it("retries a failed portable hydrate instead of caching the failure", async () => {
    const failure = new Error("vault is temporarily unavailable");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    readState
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(JSON.stringify({ items: ["restored"] }));
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
    let releaseVaultA!: (value: string) => void;
    vi.mocked(loadActiveLocalFolder).mockImplementation(() => activeFolder);
    const readVaultA = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          releaseVaultA = resolve;
        })
    );
    const vaultA = createLocalFolderStore("/vault-a", {
      read: readVaultA,
      write: vi.fn().mockResolvedValue(undefined),
    });
    const vaultB = createLocalFolderStore("/vault-b", {
      read: vi.fn().mockResolvedValue(JSON.stringify({ items: ["vault-b"] })),
      write: vi.fn().mockResolvedValue(undefined),
    });

    void vaultA.read("bookmarks", { items: [] });
    await vi.waitFor(() => expect(readVaultA).toHaveBeenCalledOnce());
    activeFolder = "/vault-b";
    void vaultB.read("bookmarks", { items: [] });
    await vaultB.hydrate?.("bookmarks");
    releaseVaultA(JSON.stringify({ items: ["vault-a"] }));
    await vaultA.hydrate?.("bookmarks");

    expect(store.get("verto:state-store-origin:bookmarks")).toBe("/vault-b");
    expect(vaultB.read("bookmarks", { items: [] })).toEqual({ items: ["vault-b"] });
  });

  it("waits for hydration before applying a read-modify-write", async () => {
    let releaseRead!: (value: string) => void;
    readState.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          releaseRead = resolve;
        })
    );
    const state = createLocalFolderStore("/home/user/vault", testFileSystem);

    const updating = state.update<string[]>("bookmarks", [], (items) => [...items, "new"]);
    expect(writeState).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(readState).toHaveBeenCalledOnce());
    releaseRead(JSON.stringify(["portable"]));

    await expect(updating).resolves.toEqual(["portable", "new"]);
    await vi.waitFor(() =>
      expect(writeState).toHaveBeenCalledWith(
        "/home/user/vault",
        "bookmarks",
        JSON.stringify(["portable", "new"])
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
    expect(writeState).toHaveBeenCalledWith("/vault-b", "bookmarks", JSON.stringify(["b"]));
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
          new Promise<void>((resolve) => {
            writes.push(json);
            releaseFirst = resolve;
          })
      )
      .mockImplementationOnce(async (_folder: string, _name: string, json: string) => {
        writes.push(json);
      });
    const state = createLocalFolderStore("/vault-a", {
      read: vi.fn().mockResolvedValue(null),
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
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const state = createLocalFolderStore("/coalesce-vault", {
      read: vi.fn().mockResolvedValue(null),
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
      JSON.stringify({ revision: 3 })
    );
  });

  it("recovers a dirty synchronous cache after termination before mirror completion", async () => {
    const neverFinishes = new Promise<void>(() => {});
    const firstWrite = vi.fn(() => neverFinishes);
    const firstProcess = createLocalFolderStore("/crash-vault", {
      read: vi.fn().mockResolvedValue(null),
      write: firstWrite,
    });
    vi.mocked(loadActiveLocalFolder).mockReturnValue("/crash-vault");
    await firstProcess.hydrate?.("reading-state");
    firstProcess.write("reading-state", { revision: 2 });
    await vi.waitFor(() => expect(firstWrite).toHaveBeenCalledOnce());

    expect(store.get("verto:state-store-recovery:%2Fcrash-vault:reading-state")).toBeTruthy();
    const recoveryWrite = vi.fn().mockResolvedValue(undefined);
    const restarted = createLocalFolderStore("/crash-vault", {
      read: vi.fn().mockResolvedValue(JSON.stringify({ revision: 1 })),
      write: recoveryWrite,
    });

    await restarted.hydrate?.("reading-state");

    expect(recoveryWrite).toHaveBeenCalledWith(
      "/crash-vault",
      "reading-state",
      JSON.stringify({ revision: 2 })
    );
    expect(restarted.read("reading-state", { revision: 0 })).toEqual({ revision: 2 });
    expect(store.get("verto:state-store-recovery:%2Fcrash-vault:reading-state")).toBeUndefined();
  });

  it("preserves stale A exactly across B writes and recovers A over an older portable file", async () => {
    let current: string | null = "/vault-a";
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
    const disk = new Map<string, string>([
      ["/vault-a:bookmarks", JSON.stringify([{ href: "/a/old" }])],
    ]);
    const fileSystem = {
      read: vi.fn(async (folder: string, name: string) => disk.get(`${folder}:${name}`) ?? null),
      write: vi.fn(async (folder: string, name: string, json: string) => {
        disk.set(`${folder}:${name}`, json);
      }),
    };
    store.set("verto:bookmarks", exactA);

    await reconcileNativeLocalFolder();
    expect(current).toBeNull();

    current = "/vault-b";
    const b = createLocalFolderStore("/vault-b", fileSystem);
    await b.hydrate?.("bookmarks");
    await b.update("bookmarks", [], () => valueB);
    expect(store.get("verto:bookmarks")).toBe(JSON.stringify(valueB));

    current = "/vault-a";
    const recoveredA = createLocalFolderStore("/vault-a", fileSystem);
    await recoveredA.hydrate?.("bookmarks");
    expect(recoveredA.read("bookmarks", [])).toEqual([{ href: "/a/exact" }]);
    expect(disk.get("/vault-a:bookmarks")).toBe(exactA);

    const restartedA = createLocalFolderStore("/vault-a", fileSystem);
    await restartedA.hydrate?.("bookmarks");
    expect(restartedA.read("bookmarks", [])).toEqual([{ href: "/a/exact" }]);
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

    await beginLocalFolderSwitch(folder);

    expect(writeVaultState).toHaveBeenCalledWith(
      folder,
      "reading-state",
      JSON.stringify({ revision: 9 })
    );
    expect(store.get("verto:state-store-dirty:reading-state")).toBeUndefined();
    cancelLocalFolderSwitch(folder);
  });

  it("claims every known unowned legacy cache before switching vaults", async () => {
    const folder = "/legacy-vault";
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    const cached = JSON.stringify({ summaries: [{ href: "/read/a" }] });
    store.set("verto:summaries", cached);
    vi.mocked(readVaultState).mockImplementation(async (_folder, name) =>
      name === "summaries" ? null : "{}"
    );

    await beginLocalFolderSwitch(folder);

    expect(writeVaultState).toHaveBeenCalledWith(folder, "summaries", cached);
    expect(store.get("verto:state-store-origin:summaries")).toBe(folder);
    cancelLocalFolderSwitch(folder);
  });

  it("never overwrites existing portable state with an unowned legacy cache", async () => {
    const folder = "/shared-vault";
    const portable = JSON.stringify([{ href: "/read/portable" }]);
    const legacy = JSON.stringify([{ href: "/read/legacy" }]);
    vi.mocked(loadActiveLocalFolder).mockReturnValue(folder);
    store.set("verto:bookmarks", legacy);
    vi.mocked(readVaultState).mockImplementation(async (_folder, name) =>
      name === "bookmarks" ? portable : "{}"
    );

    await beginLocalFolderSwitch(folder);

    expect(writeVaultState).not.toHaveBeenCalledWith(folder, "bookmarks", legacy);
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
