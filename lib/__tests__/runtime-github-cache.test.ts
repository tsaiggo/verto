import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRuntimeGitHubFileCache,
  loadRuntimeGitHubFile,
  readCachedRuntimeGitHubFile,
  runtimeGitHubCacheKey,
  saveCachedRuntimeGitHubFile,
} from "@/lib/runtime-github-cache";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const cacheKey = {
  repo: "octocat/demo",
  branch: "main",
  path: "content",
  file: "sha-readme",
};

describe("runtime GitHub file cache", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds a stable cache key without including tokens", () => {
    expect(runtimeGitHubCacheKey(cacheKey)).toBe(
      "verto:runtime-github-file:v1:octocat/demo:main:content:sha-readme"
    );
  });

  it("round-trips cached Markdown text", () => {
    saveCachedRuntimeGitHubFile(cacheKey, "# README");

    expect(readCachedRuntimeGitHubFile(cacheKey)).toBe("# README");
  });

  it("ignores malformed cached values", () => {
    storage.setItem(runtimeGitHubCacheKey(cacheKey), "{not json");

    expect(readCachedRuntimeGitHubFile(cacheKey)).toBeNull();
  });

  it("loads cached text without calling the remote reader", async () => {
    saveCachedRuntimeGitHubFile(cacheKey, "# Cached");
    const readRemote = vi.fn(async () => "# Remote");

    await expect(loadRuntimeGitHubFile(cacheKey, readRemote)).resolves.toBe("# Cached");
    expect(readRemote).not.toHaveBeenCalled();
  });

  it("fetches and stores remote text on a cache miss", async () => {
    const readRemote = vi.fn(async () => "# Remote");

    await expect(loadRuntimeGitHubFile(cacheKey, readRemote)).resolves.toBe("# Remote");

    expect(readRemote).toHaveBeenCalledOnce();
    expect(readCachedRuntimeGitHubFile(cacheKey)).toBe("# Remote");
  });

  it("still returns remote text when localStorage writes fail", async () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const readRemote = vi.fn(async () => "# Remote");

    await expect(loadRuntimeGitHubFile(cacheKey, readRemote)).resolves.toBe("# Remote");
  });

  it("still returns remote text when localStorage access is blocked", async () => {
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      })
    );
    const readRemote = vi.fn(async () => "# Remote");

    await expect(loadRuntimeGitHubFile(cacheKey, readRemote)).resolves.toBe("# Remote");
    expect(readRemote).toHaveBeenCalledOnce();
  });

  it("clears only runtime GitHub cache entries", () => {
    saveCachedRuntimeGitHubFile(cacheKey, "# README");
    storage.setItem("verto:unrelated", "keep");

    clearRuntimeGitHubFileCache();

    expect(readCachedRuntimeGitHubFile(cacheKey)).toBeNull();
    expect(storage.getItem("verto:unrelated")).toBe("keep");
  });
});
