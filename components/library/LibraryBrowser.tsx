"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bookmark, FileText, Search } from "lucide-react";
import { loadReadingState, readingStatusLabel, type ReadingEntry } from "@/lib/reading-state";
import { loadBookmarks, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";
import type { BookmarkKind } from "@/lib/bookmarks";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { loadActiveRuntimeLocalFolder, listRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import type { RawFileEntry } from "@/lib/content-source";

export type LibraryKind = "note" | "draft" | "image" | "archive" | "doc";

export interface LibraryDoc {
  title: string;
  ext: string;
  href: string;
  section: string;
  tags: string[];
  updatedLabel: string;
  updatedISO: string;
  kind: LibraryKind;
}

type TabId = "all" | "notes" | "drafts" | "images" | "archives";

type RuntimeLocalDocsState =
  | { status: "idle"; folder: null; docs: LibraryDoc[]; error: null }
  | { status: "loading"; folder: string; docs: LibraryDoc[]; error: null }
  | { status: "ready"; folder: string; docs: LibraryDoc[]; error: null }
  | { status: "error"; folder: string; docs: LibraryDoc[]; error: string };

const TABS: { id: TabId; label: string; match: (d: LibraryDoc) => boolean }[] = [
  { id: "all", label: "All Documents", match: (d) => d.kind !== "archive" },
  { id: "notes", label: "Notes", match: (d) => d.kind === "note" },
  { id: "drafts", label: "Drafts", match: (d) => d.kind === "draft" },
  { id: "images", label: "Images", match: (d) => d.kind === "image" },
  { id: "archives", label: "Archives", match: (d) => d.kind === "archive" },
];

const EMPTY_LIBRARY_DOCS: LibraryDoc[] = [];

const RUNTIME_LOCAL_IDLE: RuntimeLocalDocsState = {
  status: "idle",
  folder: null,
  docs: EMPTY_LIBRARY_DOCS,
  error: null,
};

// ---- Module-level snapshot / subscribe functions (stable references) -------

function subscribeReadingState(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readingSnapshot() {
  return JSON.stringify(loadReadingState());
}

function readingServerSnapshot() {
  return JSON.stringify({ recent: [] });
}

function bmSnapshot(): string {
  return JSON.stringify(loadBookmarks().map((b) => b.href));
}

function bmServerSnapshot(): string {
  return "[]";
}

// ---- Helpers ----------------------------------------------------------------

/** Map each recently-read document's href to its progress (0-100). */
function progressByHref(snapshot: string): Map<string, number> {
  const map = new Map<string, number>();
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (
      parsed &&
      typeof parsed === "object" &&
      "recent" in parsed &&
      Array.isArray(parsed.recent)
    ) {
      for (const e of parsed.recent as ReadingEntry[]) {
        if (e && typeof e.href === "string") map.set(e.href, e.progress);
      }
    }
  } catch {
    return map;
  }
  return map;
}

function toBookmarkKind(kind: LibraryKind): BookmarkKind {
  return kind === "note" ? "note" : "document";
}

function titleize(segment: string): string {
  return segment
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function splitFileName(name: string): { base: string; ext: string } {
  const match = name.match(/^(.*?)(\.(?:mdx|md))$/i);
  if (!match) return { base: name, ext: "" };
  return { base: match[1] || name, ext: match[2].toLowerCase() };
}

function relativeTime(ms: number | undefined): string {
  if (!ms) return "Local file";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function runtimeLocalHref(entry: RawFileEntry, title: string, ext: string): string {
  const params = new URLSearchParams({
    file: entry.id,
    title,
    ext,
  });
  return `/runtime/local?${params.toString()}`;
}

export function runtimeEntryToLibraryDoc(entry: RawFileEntry): LibraryDoc {
  const fileName = entry.path[entry.path.length - 1] ?? entry.id.split(/[\\/]/).pop() ?? entry.id;
  const { base, ext } = splitFileName(fileName);
  const title = titleize(base) || fileName;
  const section = entry.path.length > 1 ? titleize(entry.path[0]) : "Local Files";
  const updatedISO = new Date(entry.mtime ?? 0).toISOString();
  return {
    title,
    ext,
    href: runtimeLocalHref(entry, title, ext),
    section,
    tags: [],
    updatedLabel: relativeTime(entry.mtime),
    updatedISO,
    kind: ext === ".md" ? "note" : "doc",
  };
}

function sortByUpdatedDesc(a: LibraryDoc, b: LibraryDoc): number {
  return Date.parse(b.updatedISO) - Date.parse(a.updatedISO) || a.title.localeCompare(b.title);
}

function useActiveLocalFolder(): string | null {
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setFolder(loadActiveRuntimeLocalFolder());
    };
    queueMicrotask(refresh);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return folder;
}

function useRuntimeLocalDocs(): RuntimeLocalDocsState {
  const folder = useActiveLocalFolder();
  const [result, setResult] = useState<{
    key: string;
    docs: LibraryDoc[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!folder) return;

    let cancelled = false;
    const activeFolder = folder;

    async function load() {
      try {
        const entries = await listRuntimeLocalFolder(activeFolder);
        const docs = entries.map(runtimeEntryToLibraryDoc).sort(sortByUpdatedDesc);
        if (!cancelled) setResult({ key: activeFolder, docs, error: null });
      } catch (err) {
        if (!cancelled) {
          setResult({
            key: activeFolder,
            docs: EMPTY_LIBRARY_DOCS,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [folder]);

  if (!folder) return RUNTIME_LOCAL_IDLE;
  if (!result || result.key !== folder) {
    return { status: "loading", folder, docs: EMPTY_LIBRARY_DOCS, error: null };
  }
  if (result.error) {
    return { status: "error", folder, docs: EMPTY_LIBRARY_DOCS, error: result.error };
  }
  return { status: "ready", folder, docs: result.docs, error: null };
}

function runtimeEmptyMessage(runtimeLocal: RuntimeLocalDocsState): string {
  if (runtimeLocal.status === "loading") return "Loading local files...";
  if (runtimeLocal.status === "error") return "Could not load this local folder.";
  if (runtimeLocal.status === "ready") return "No .md or .mdx files found in this folder.";
  return "No documents in this library.";
}

function LibraryRuntimeStatus({ state }: { state: RuntimeLocalDocsState }) {
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return (
      <div className="lib-runtime-status is-loading" role="status">
        Opening local folder <span>{state.folder}</span>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="lib-runtime-status is-error" role="status">
        Could not open <span>{state.folder}</span>: {state.error}
      </div>
    );
  }
  return (
    <div className="lib-runtime-status is-ready" role="status">
      Reading <span>{state.folder}</span> · {state.docs.length} real local
      {state.docs.length === 1 ? " file" : " files"}
    </div>
  );
}

// ---- Component --------------------------------------------------------------

/**
 * Functional library browser (Library / Browse). Tabbed document set with a live
 * text filter and Source / Tag facets, rendered as the mockup's three-column
 * table (Title, Source, Updated). Every row deep-links into the reader.
 * A hover bookmark button lets readers save documents without leaving the list.
 *
 * In the desktop app, a connected Local Files folder replaces the static
 * build-time list with files read from disk at runtime.
 */
export default function LibraryBrowser({ docs }: { docs: LibraryDoc[] }) {
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [tag, setTag] = useState("all");
  const runtimeLocal = useRuntimeLocalDocs();
  const activeDocs = useMemo(() => {
    if (runtimeLocal.status === "ready") return runtimeLocal.docs;
    if (runtimeLocal.status !== "idle") return EMPTY_LIBRARY_DOCS;
    return docs;
  }, [docs, runtimeLocal.docs, runtimeLocal.status]);

  const readingSnap = useSyncExternalStore(
    subscribeReadingState,
    readingSnapshot,
    readingServerSnapshot
  );
  const progressMap = useMemo(() => progressByHref(readingSnap), [readingSnap]);

  const bmSnap = useSyncExternalStore(subscribeBookmarks, bmSnapshot, bmServerSnapshot);
  const bookmarkedHrefs = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(bmSnap) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [bmSnap]);

  const sources = useMemo(
    () => Array.from(new Set(activeDocs.map((d) => d.section))).sort((a, b) => a.localeCompare(b)),
    [activeDocs]
  );
  const tags = useMemo(
    () => Array.from(new Set(activeDocs.flatMap((d) => d.tags))).sort((a, b) => a.localeCompare(b)),
    [activeDocs]
  );

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: 0, notes: 0, drafts: 0, images: 0, archives: 0 };
    for (const tabDef of TABS) c[tabDef.id] = activeDocs.filter(tabDef.match).length;
    return c;
  }, [activeDocs]);

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return activeDocs.filter((d) => {
      if (!activeTab.match(d)) return false;
      if (source !== "all" && d.section !== source) return false;
      if (tag !== "all" && !d.tags.includes(tag)) return false;
      if (q) {
        const hay = `${d.title} ${d.section} ${d.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeDocs, activeTab, source, tag, q]);

  return (
    <div className="v-page lib">
      <LibraryRuntimeStatus state={runtimeLocal} />

      <div className="v-tabs lib-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`v-tab${t.id === tab ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="lib-tab-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="lib-toolbar">
        <label className="lib-search">
          <Search aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents..."
            aria-label="Search documents"
          />
        </label>
        <select
          className="lib-select"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Filter by source"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="lib-select"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          aria-label="Filter by tag"
        >
          <option value="all">All Tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      </div>

      {rows.length > 0 ? (
        <div className="lib-table" role="table" aria-label="Documents">
          <div className="lib-thead" role="row">
            <span role="columnheader">Title</span>
            <span role="columnheader">Source</span>
            <span role="columnheader">Updated</span>
          </div>
          {rows.map((d) => {
            const progress = progressMap.get(d.href);
            const status = progress === undefined ? "" : readingStatusLabel(progress);
            const meta = d.tags.length ? d.tags.map((t) => `#${t}`).join(" ") : "Document";
            const bmed = bookmarkedHrefs.has(d.href);
            return (
              <div key={`${d.href}:${d.title}`} className="lib-row-wrap">
                <Link href={d.href} className="lib-row" role="row">
                  <span className="lib-cell-title" role="cell">
                    <FileText className="lib-row-icon" aria-hidden />
                    <span className="lib-title-text">
                      <strong>
                        {d.title}
                        <span className="lib-ext">{d.ext}</span>
                      </strong>
                      <small>{status ? `${status} - ${meta}` : meta}</small>
                    </span>
                  </span>
                  <span className="lib-cell-source" role="cell">
                    {d.section}
                  </span>
                  <span className="lib-cell-updated" role="cell">
                    {d.updatedLabel}
                  </span>
                </Link>
                <button
                  type="button"
                  className={`lib-bm-btn${bmed ? " is-active" : ""}`}
                  onClick={() =>
                    toggleBookmark({
                      href: d.href,
                      title: d.title,
                      kind: toBookmarkKind(d.kind),
                      addedAt: new Date().toISOString(),
                    })
                  }
                  aria-label={`${bmed ? "Remove bookmark" : "Bookmark"}: ${d.title}`}
                  aria-pressed={bmed}
                >
                  <Bookmark size={13} aria-hidden fill={bmed ? "currentColor" : "none"} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lib-empty">
          <FileText aria-hidden />
          <p>{runtimeEmptyMessage(runtimeLocal)}</p>
        </div>
      )}
    </div>
  );
}
