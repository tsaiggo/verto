"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bookmark, FileText, Search } from "lucide-react";
import { loadReadingState, readingStatusLabel, type ReadingEntry } from "@/lib/reading-state";
import { loadBookmarks, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";
import type { BookmarkKind } from "@/lib/bookmarks";

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

const TABS: { id: TabId; label: string; match: (d: LibraryDoc) => boolean }[] = [
  { id: "all", label: "All Documents", match: (d) => d.kind !== "archive" },
  { id: "notes", label: "Notes", match: (d) => d.kind === "note" },
  { id: "drafts", label: "Drafts", match: (d) => d.kind === "draft" },
  { id: "images", label: "Images", match: (d) => d.kind === "image" },
  { id: "archives", label: "Archives", match: (d) => d.kind === "archive" },
];

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

// ---- Component --------------------------------------------------------------

/**
 * Functional library browser (Library / Browse). Tabbed document set with a live
 * text filter and Source / Tag facets, rendered as the mockup's three-column
 * table (Title · Source · Updated). Every row deep-links into the reader.
 * A hover bookmark button lets readers save documents without leaving the list.
 */
export default function LibraryBrowser({ docs }: { docs: LibraryDoc[] }) {
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [tag, setTag] = useState("all");

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
    () => Array.from(new Set(docs.map((d) => d.section))).sort((a, b) => a.localeCompare(b)),
    [docs]
  );
  const tags = useMemo(
    () => Array.from(new Set(docs.flatMap((d) => d.tags))).sort((a, b) => a.localeCompare(b)),
    [docs]
  );

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: 0, notes: 0, drafts: 0, images: 0, archives: 0 };
    for (const tabDef of TABS) c[tabDef.id] = docs.filter(tabDef.match).length;
    return c;
  }, [docs]);

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return docs.filter((d) => {
      if (!activeTab.match(d)) return false;
      if (source !== "all" && d.section !== source) return false;
      if (tag !== "all" && !d.tags.includes(tag)) return false;
      if (q) {
        const hay = `${d.title} ${d.section} ${d.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, activeTab, source, tag, q]);

  return (
    <div className="v-page lib">
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
            placeholder="Search documents…"
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
                      <small>{status ? `${status} · ${meta}` : meta}</small>
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
          <p>No documents match this view.</p>
        </div>
      )}
    </div>
  );
}
