import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWebKey, loadWebKey, notifyWebKeyChanged, saveWebKey } from "@/lib/ai/key-store";

const STORAGE_KEY = "verto:assistant:token";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

function installWindow(localStorage: ReturnType<typeof memoryStorage>) {
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { localStorage, dispatchEvent });
  return dispatchEvent;
}

class FakeStorageEvent {
  readonly type: string;
  readonly key: string | null;

  constructor(type: string, init?: { key?: string | null }) {
    this.type = type;
    this.key = init?.key ?? null;
  }
}

describe("assistant web key store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is unavailable during server rendering", () => {
    expect(loadWebKey()).toBeNull();
    expect(saveWebKey("token")).toBe(false);
    expect(clearWebKey()).toBe(false);
    expect(() => notifyWebKeyChanged()).not.toThrow();
  });

  it("loads a trimmed token and rejects missing or blank values", () => {
    const store = memoryStorage({ [STORAGE_KEY]: "  secret-token  " });
    installWindow(store);

    expect(loadWebKey()).toBe("secret-token");
    store.getItem.mockReturnValueOnce("   ");
    expect(loadWebKey()).toBeNull();
    store.getItem.mockReturnValueOnce(null);
    expect(loadWebKey()).toBeNull();
  });

  it("treats inaccessible local storage as unavailable", () => {
    const browserWindow = {};
    Object.defineProperty(browserWindow, "localStorage", {
      get() {
        throw new Error("sandboxed");
      },
    });
    vi.stubGlobal("window", browserWindow);

    expect(loadWebKey()).toBeNull();
    expect(saveWebKey("token")).toBe(false);
  });

  it("saves a trimmed token and dispatches a keyed storage event", () => {
    const store = memoryStorage();
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", FakeStorageEvent);

    expect(saveWebKey("  secret-token  ")).toBe(true);

    expect(store.setItem).toHaveBeenCalledWith(STORAGE_KEY, "secret-token");
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage", key: STORAGE_KEY })
    );
  });

  it("removes blank and explicitly cleared tokens", () => {
    const store = memoryStorage({ [STORAGE_KEY]: "secret-token" });
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", FakeStorageEvent);

    expect(saveWebKey("   ")).toBe(true);
    expect(clearWebKey()).toBe(true);

    expect(store.removeItem).toHaveBeenCalledTimes(2);
    expect(store.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it("reports failed writes without notifying same-tab listeners", () => {
    const store = memoryStorage();
    store.setItem.mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", FakeStorageEvent);

    expect(saveWebKey("secret-token")).toBe(false);
    expect(loadWebKey()).toBeNull();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("falls back to a generic storage event when StorageEvent is unavailable", () => {
    const store = memoryStorage();
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", undefined);

    notifyWebKeyChanged();

    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "storage" }));
  });

  it("accepts a mutation that applied locally before the adapter reported an error", () => {
    const store = memoryStorage({ [STORAGE_KEY]: "old-token" });
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", FakeStorageEvent);
    const applySet = store.setItem.getMockImplementation();
    const applyRemove = store.removeItem.getMockImplementation();
    store.setItem.mockImplementationOnce((key, value) => {
      applySet?.(key, value);
      throw new Error("mirror failed");
    });

    expect(saveWebKey("new-token")).toBe(true);
    expect(loadWebKey()).toBe("new-token");

    store.removeItem.mockImplementationOnce((key) => {
      applyRemove?.(key);
      throw new Error("mirror failed");
    });
    expect(clearWebKey()).toBe(true);
    expect(loadWebKey()).toBeNull();
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it("rejects a silent write that did not reach durable storage", () => {
    const store = memoryStorage();
    store.setItem.mockImplementationOnce(() => new Map());
    const dispatchEvent = installWindow(store);

    expect(saveWebKey("secret-token")).toBe(false);
    expect(loadWebKey()).toBeNull();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("does not turn a durable write into a false failure when notification fails", () => {
    const store = memoryStorage();
    const dispatchEvent = installWindow(store);
    dispatchEvent.mockImplementation(() => {
      throw new Error("event target unavailable");
    });

    expect(saveWebKey("secret-token")).toBe(true);
    expect(loadWebKey()).toBe("secret-token");
  });
});
