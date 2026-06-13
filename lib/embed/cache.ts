import fs from "node:fs";
import path from "node:path";
import type { EmbedMeta } from "./types";

/**
 * Simple two-tier cache for embed metadata.
 *
 * • **In-memory `Map`** (`memo`) — deduplicates concurrent `resolveEmbed`
 *   calls within a single Node process. The stored value is a `Promise`,
 *   so callers awaiting the same URL share a single network round-trip.
 *
 * • **On-disk JSON** (`CACHE_FILE`) — persists successful resolutions
 *   between `next dev` HMR reloads and CI runs so we don't hammer GitHub
 *   / YouTube on every rebuild. TTL is 7 days; expired entries are simply
 *   ignored on read and overwritten on next resolve.
 *
 * The cache is best-effort: any disk I/O error degrades silently to an
 * in-memory-only cache. We deliberately do **not** treat the cache as a
 * security boundary — provider-fetched values are sanitized at render
 * time, not on the way in.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CACHE_DIR = path.join(process.cwd(), "node_modules", ".cache", "verto");
const CACHE_FILE = path.join(CACHE_DIR, "embeds.json");

interface CacheEntry {
  fetchedAt: number;
  meta: EmbedMeta;
}

type DiskCache = Record<string, CacheEntry>;

let disk: DiskCache | null = null;
const memo = new Map<string, Promise<EmbedMeta>>();

function loadDisk(): DiskCache {
  if (disk) return disk;
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      disk = parsed as DiskCache;
      return disk;
    }
  } catch {
    // Missing or unreadable cache file — start empty.
  }
  disk = {};
  return disk;
}

function persist(): void {
  if (!disk) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(disk));
  } catch {
    // Disk is read-only or full — keep the in-memory cache and move on.
  }
}

export function readCached(url: string): EmbedMeta | null {
  const d = loadDisk();
  const entry = d[url];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) return null;
  return entry.meta;
}

export function writeCached(url: string, meta: EmbedMeta): void {
  const d = loadDisk();
  d[url] = { fetchedAt: Date.now(), meta };
  persist();
}

/**
 * Memoize an in-flight resolution so concurrent renders of the same URL
 * share one Promise. Caller is responsible for providing the actual
 * fetcher; this helper just dedups by URL.
 */
export function memoizeResolve(
  url: string,
  resolver: () => Promise<EmbedMeta>
): Promise<EmbedMeta> {
  const cached = memo.get(url);
  if (cached) return cached;
  const p = resolver().catch((err) => {
    // Drop failed promises from memo so the next render can retry.
    memo.delete(url);
    throw err;
  });
  memo.set(url, p);
  return p;
}

/** Test-only — clear both layers. Not exported via index. */
export function _clearCache(): void {
  memo.clear();
  disk = {};
  try {
    fs.unlinkSync(CACHE_FILE);
  } catch {
    // ignore
  }
}
