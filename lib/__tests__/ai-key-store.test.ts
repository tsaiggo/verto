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
    expect(() => saveWebKey("token")).not.toThrow();
    expect(() => clearWebKey()).not.toThrow();
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
    expect(() => saveWebKey("token")).not.toThrow();
  });

  it("saves a trimmed token and dispatches a keyed storage event", () => {
    const store = memoryStorage();
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", FakeStorageEvent);

    saveWebKey("  secret-token  ");

    expect(store.setItem).toHaveBeenCalledWith(STORAGE_KEY, "secret-token");
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "storage", key: STORAGE_KEY })
    );
  });

  it("removes blank and explicitly cleared tokens", () => {
    const store = memoryStorage({ [STORAGE_KEY]: "secret-token" });
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", FakeStorageEvent);

    saveWebKey("   ");
    clearWebKey();

    expect(store.removeItem).toHaveBeenCalledTimes(2);
    expect(store.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it("falls back to a generic storage event when StorageEvent is unavailable", () => {
    const store = memoryStorage();
    const dispatchEvent = installWindow(store);
    vi.stubGlobal("StorageEvent", undefined);

    notifyWebKeyChanged();

    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "storage" }));
  });
});
