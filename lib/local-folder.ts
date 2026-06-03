// Helpers for the "Local Files" connect flow.
//
// These are intentionally pure / framework-free so they can be unit-tested
// without a DOM or the Tauri runtime. Two concerns live here:
//
//   1. A small "recent folders" list, persisted in `localStorage`, so the
//      picker can remember the folders a reader has opened and offer one-click
//      re-opening — both on the desktop app and in the browser fallback where
//      paths are typed by hand.
//   2. A summary of a folder *inspection* (does it exist, how many readable
//      `.md` / `.mdx` files does it hold) so the panel can give real feedback
//      after a folder is chosen instead of silently accepting any string.
//
// The actual filesystem scan is performed by the desktop shell (see the
// `inspect_local_dir` Tauri command and `inspectFolder` in `lib/tauri.ts`);
// this module only models and summarises its result.

/** Maximum number of recently-opened folders to remember. */
export const MAX_RECENT_FOLDERS = 6;

/** `localStorage` key under which the recent-folder list is persisted. */
export const RECENT_FOLDERS_KEY = "verto:recent-local-folders";

/**
 * Result of scanning a candidate content folder for readable files. Produced
 * by the desktop `inspect_local_dir` command; modelled here so the (browser)
 * UI and tests can reason about it without the Tauri runtime.
 */
export interface FolderInspection {
  /** Whether the path exists on disk. */
  exists: boolean;
  /** Whether the path is a directory (false for a file or missing path). */
  isDir: boolean;
  /** Count of readable `.md` / `.mdx` files found beneath the folder. */
  fileCount: number;
  /** A few sample relative paths (for a friendly preview), newest-first. */
  samples: string[];
}

/**
 * Add `folder` to the front of a recent-folders list, removing any existing
 * occurrence (so it moves to the top) and capping the list at `max` entries.
 * Blank / whitespace-only inputs are ignored and the list is returned
 * unchanged. Paths are compared after trimming but otherwise verbatim, since
 * filesystem case-sensitivity varies by platform.
 */
export function addRecentFolder(
  list: readonly string[],
  folder: string,
  max: number = MAX_RECENT_FOLDERS,
): string[] {
  const trimmed = folder.trim();
  if (!trimmed) return [...list];
  const deduped = list.filter((f) => f !== trimmed);
  return [trimmed, ...deduped].slice(0, Math.max(0, max));
}

/** Tone of an inspection summary, used to pick an icon / colour in the UI. */
export type InspectionTone = "ok" | "empty" | "missing";

export interface InspectionSummary {
  tone: InspectionTone;
  message: string;
}

/**
 * Turn a {@link FolderInspection} into a short, human-readable status the
 * panel can render. Pure so it can be unit-tested independently of the UI.
 */
export function summarizeInspection(
  inspection: FolderInspection,
): InspectionSummary {
  if (!inspection.exists) {
    return { tone: "missing", message: "That folder does not exist." };
  }
  if (!inspection.isDir) {
    return { tone: "missing", message: "That path is a file, not a folder." };
  }
  if (inspection.fileCount === 0) {
    return {
      tone: "empty",
      message: "No .mdx or .md files found in this folder.",
    };
  }
  const noun = inspection.fileCount === 1 ? "file" : "files";
  return {
    tone: "ok",
    message: `Found ${inspection.fileCount} readable ${noun}.`,
  };
}

/**
 * Read the persisted recent-folders list from `localStorage`. Returns an empty
 * array when storage is unavailable (SSR / private mode) or the stored value
 * is malformed, so callers never need to guard.
 */
export function loadRecentFolders(): string[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FOLDERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is string => typeof f === "string" && f.trim() !== "")
      .slice(0, MAX_RECENT_FOLDERS);
  } catch {
    return [];
  }
}

/**
 * Persist the recent-folders list to `localStorage`. A no-op (swallowing any
 * error) when storage is unavailable, so it is always safe to call.
 */
export function saveRecentFolders(list: readonly string[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      RECENT_FOLDERS_KEY,
      JSON.stringify(list.slice(0, MAX_RECENT_FOLDERS)),
    );
  } catch {
    // Ignore quota / disabled-storage errors — remembering folders is a
    // convenience, never a requirement.
  }
}
