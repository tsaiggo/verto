interface RuntimeGitHubCacheKey {
  repo: string;
  branch: string;
  path: string;
  file: string;
}

interface RuntimeGitHubCacheEntry {
  source: string;
  cachedAt: number;
}

const CACHE_PREFIX = "verto:runtime-github-file:v1";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function normalizeSegment(value: string): string {
  return value.trim();
}

export function runtimeGitHubCacheKey({ repo, branch, path, file }: RuntimeGitHubCacheKey): string {
  return [
    CACHE_PREFIX,
    normalizeSegment(repo),
    normalizeSegment(branch),
    normalizeSegment(path),
    normalizeSegment(file),
  ].join(":");
}

export function readCachedRuntimeGitHubFile(key: RuntimeGitHubCacheKey): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(runtimeGitHubCacheKey(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("source" in parsed) ||
      typeof parsed.source !== "string"
    ) {
      return null;
    }
    return parsed.source;
  } catch {
    return null;
  }
}

export function saveCachedRuntimeGitHubFile(key: RuntimeGitHubCacheKey, source: string): void {
  const store = storage();
  if (!store) return;
  const entry: RuntimeGitHubCacheEntry = {
    source,
    cachedAt: Date.now(),
  };
  try {
    store.setItem(runtimeGitHubCacheKey(key), JSON.stringify(entry));
  } catch {
    // Cache writes are best-effort; opening the document must not depend on them.
  }
}

export function clearRuntimeGitHubFileCache(): void {
  const store = storage();
  if (!store) return;
  try {
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter(
      (key): key is string => key?.startsWith(CACHE_PREFIX) ?? false
    );
    for (const key of keys) {
      store.removeItem(key);
    }
  } catch {
    // Clearing cached runtime files is best-effort and should not block sign-out.
  }
}

export async function loadRuntimeGitHubFile(
  key: RuntimeGitHubCacheKey,
  readRemote: () => Promise<string>
): Promise<string> {
  const cached = readCachedRuntimeGitHubFile(key);
  if (cached !== null) return cached;
  const source = await readRemote();
  saveCachedRuntimeGitHubFile(key, source);
  return source;
}
