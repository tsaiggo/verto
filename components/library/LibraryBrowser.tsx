"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { loadReadingState, type ReadingEntry } from "@/lib/reading-state";
import { loadBookmarks, subscribeBookmarks } from "@/lib/bookmarks";
import LibraryDocumentResults from "@/components/library/LibraryDocumentResults";
import styles from "@/components/library/Library.module.css";
import LibraryPageHeader from "@/components/library/LibraryPageHeader";
import LibrarySourceContext from "@/components/library/LibrarySourceContext";
import LibraryToolbar from "@/components/library/LibraryToolbar";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export type LibraryViewId = "all" | "notes" | "drafts" | "archives";
type TabId = LibraryViewId;

export type RuntimeLocalDocsState =
  | { status: "idle"; folder: null; docs: LibraryDoc[]; error: null }
  | { status: "loading"; folder: string; docs: LibraryDoc[]; error: null }
  | { status: "ready"; folder: string; docs: LibraryDoc[]; error: null }
  | { status: "error"; folder: string; docs: LibraryDoc[]; error: string };

const TABS: { id: TabId; label: string; match: (d: LibraryDoc) => boolean }[] = [
  { id: "all", label: "All Documents", match: (d) => d.kind !== "archive" },
  { id: "notes", label: "Notes", match: (d) => d.kind === "note" },
  { id: "drafts", label: "Drafts", match: (d) => d.kind === "draft" },
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

function subscribeLocation(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function locationSearch(): string {
  return window.location.search;
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

function routeFilters(search: string): { source: string | null; tag: string | null } {
  const params = new URLSearchParams(search);
  return {
    source: params.get("source")?.trim() || null,
    tag: params.get("tag")?.trim() || null,
  };
}

function routeWithoutFilters(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("source");
  params.delete("tag");
  const nextSearch = params.toString();
  return nextSearch ? `/library?${nextSearch}` : "/library";
}

function runtimeLocalDocs(runtime: RuntimeLocalIndexState): RuntimeLocalDocsState {
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

function resultCountLabel(status: RuntimeLocalDocsState["status"], count: number): string {
  if (status === "loading") return "Loading documents";
  if (status === "error") return "Documents unavailable";
  return `${count} ${count === 1 ? "document" : "documents"}`;
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
export default function LibraryBrowser({
  docs,
  bundledSectionCount,
}: {
  docs: LibraryDoc[];
  bundledSectionCount: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const runtime = useRuntimeLocalIndex();
  const runtimeLocal = runtimeLocalDocs(runtime);

  const search = useSyncExternalStore(subscribeLocation, locationSearch, () => "");
  const requestedFilters = useMemo(() => routeFilters(search), [search]);
  const section = selectedSection ?? requestedFilters.source ?? "all";
  const tag = selectedTag ?? requestedFilters.tag ?? "all";

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

  const sections = useMemo(
    () => Array.from(new Set(activeDocs.map((d) => d.section))).sort((a, b) => a.localeCompare(b)),
    [activeDocs]
  );
  const tags = useMemo(
    () => Array.from(new Set(activeDocs.flatMap((d) => d.tags))).sort((a, b) => a.localeCompare(b)),
    [activeDocs]
  );

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: 0, notes: 0, drafts: 0, archives: 0 };
    for (const tabDef of TABS) c[tabDef.id] = activeDocs.filter(tabDef.match).length;
    return c;
  }, [activeDocs]);

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    return activeDocs.filter((d) => {
      if (!activeTab.match(d)) return false;
      if (section !== "all" && d.section !== section) return false;
      if (tag !== "all" && !d.tags.includes(tag)) return false;
      if (q) {
        const hay = `${d.title} ${d.section} ${d.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeDocs, activeTab, section, tag, q]);

  const hasActiveFilters = q.length > 0 || section !== "all" || tag !== "all";
  const resultLabel = resultCountLabel(runtimeLocal.status, rows.length);
  const clearFilters = () => {
    setQuery("");
    setSelectedSection("all");
    setSelectedTag("all");
    router.replace(routeWithoutFilters(search), { scroll: false });
  };

  return (
    <>
      <LibraryPageHeader
        runtime={runtime}
        bundledDocumentCount={docs.length}
        bundledSectionCount={bundledSectionCount}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TabId)}
        className={styles.browser}
      >
        <TabsList className={styles.tabs} aria-label="Library views" data-page-tabs>
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className={styles.tab}
              tabIndex={t.id === tab ? 0 : -1}
            >
              {t.label}
              {counts[t.id] > 0 ? <span className={styles.tabCount}>{counts[t.id]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className={styles.panel} aria-label={activeTab.label}>
          <div className={styles.scroll} data-page-scroll>
            <div className={styles.workbench}>
              <div className={`lib-main ${styles.main}`}>
                <LibraryToolbar
                  query={query}
                  onQueryChange={setQuery}
                  section={section}
                  onSectionChange={setSelectedSection}
                  tag={tag}
                  onTagChange={setSelectedTag}
                  sections={sections}
                  tags={tags}
                />

                <div className={styles.resultBar}>
                  <p aria-live="polite">{resultLabel}</p>
                  {hasActiveFilters && rows.length > 0 ? (
                    <button type="button" className={styles.resetFilters} onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : null}
                </div>

                <LibraryDocumentResults
                  rows={rows}
                  progressMap={progressMap}
                  bookmarkedHrefs={bookmarkedHrefs}
                  emptyMessage={runtimeEmptyMessage(runtimeLocal)}
                  state={runtimeLocal.status}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearFilters}
                  activeView={tab}
                  libraryDocumentCount={activeDocs.length}
                />
              </div>

              <aside
                className={styles.contextPanel}
                aria-label="Library context"
                data-context-panel
              >
                <LibrarySourceContext state={runtimeLocal} bundledDocumentCount={docs.length} />
              </aside>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
