"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bookmark, FileText, Search } from "lucide-react";
import { loadReadingState, readingStatusLabel, type ReadingEntry } from "@/lib/reading-state";
import { loadBookmarks, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";
import type { BookmarkKind } from "@/lib/bookmarks";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import { runtimeEntryToLibraryDoc } from "@/lib/runtime-local-index";

export { runtimeEntryToLibraryDoc };

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

function useRuntimeLocalDocs(): RuntimeLocalDocsState {
  const runtime = useRuntimeLocalIndex();
  if (runtime.status === "idle") return RUNTIME_LOCAL_IDLE;
  if (runtime.status === "loading") {
    return { status: "loading", folder: runtime.folder, docs: EMPTY_LIBRARY_DOCS, error: null };
  }
  if (runtime.status === "error") {
    return {
      status: "error",
      folder: runtime.folder,
      docs: EMPTY_LIBRARY_DOCS,
      error: runtime.error,
    };
  }
  return { status: "ready", folder: runtime.folder, docs: runtime.index.libraryDocs, error: null };
}
function runtimeEmptyMessage(runtimeLocal: RuntimeLocalDocsState): string {
  if (runtimeLocal.status === "loading") return "Loading local library...";
  if (runtimeLocal.status === "error") return "Could not load this local library.";
  if (runtimeLocal.status === "ready") return "No .md or .mdx files found in this folder.";
  return "No documents in this library.";
}

function LibraryRuntimeStatus({ state }: { state: RuntimeLocalDocsState }) {
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return (
      <div className="lib-runtime-status is-loading" role="status">
        Opening local library <span>{state.folder}</span>
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

interface LibraryToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  tag: string;
  onTagChange: (value: string) => void;
  sources: string[];
  tags: string[];
}

function LibraryToolbar({
  query,
  onQueryChange,
  source,
  onSourceChange,
  tag,
  onTagChange,
  sources,
  tags,
}: LibraryToolbarProps) {
  return (
    <div className="lib-toolbar">
      <label className="lib-search">
        <Search aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search documents..."
          aria-label="Search documents"
        />
      </label>
      <select
        className="lib-select"
        value={source}
        onChange={(e) => onSourceChange(e.target.value)}
        aria-label="Filter by source"
      >
        <option value="all">All Sources</option>
        {sources.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select
        className="lib-select"
        value={tag}
        onChange={(e) => onTagChange(e.target.value)}
        aria-label="Filter by tag"
      >
        <option value="all">All Tags</option>
        {tags.map((item) => (
          <option key={item} value={item}>
            #{item}
          </option>
        ))}
      </select>
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
 * In the desktop app, a connected Local Library folder replaces the static
 * build-time list with files read from disk at runtime.
 */
export default function LibraryBrowser({ docs }: { docs: LibraryDoc[] }) {
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [tag, setTag] = useState("all");
  const runtimeLocal = useRuntimeLocalDocs();

  // The Tags page uses a normal Library URL so a tag selected from a runtime
  // local folder still works in the statically exported desktop application.
  // This reads only after hydration, avoiding an SSR mismatch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTag = params.get("tag")?.trim();
    const requestedSource = params.get("source")?.trim();
    if (requestedTag) setTag(requestedTag);
    if (requestedSource) setSource(requestedSource);
  }, []);

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

      <LibraryToolbar
        query={query}
        onQueryChange={setQuery}
        source={source}
        onSourceChange={setSource}
        tag={tag}
        onTagChange={setTag}
        sources={sources}
        tags={tags}
      />

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
