"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderOpen, Search } from "lucide-react";
import { loadReadingState, type ReadingEntry } from "@/lib/reading-state";
import { loadBookmarks, subscribeBookmarks } from "@/lib/bookmarks";
import LibraryDocumentResults from "@/components/library/LibraryDocumentResults";
import LibraryPageHeader from "@/components/library/LibraryPageHeader";
import LibraryTabs, { libraryTabId, type LibraryTabId } from "@/components/library/LibraryTabs";
import {
  clearRouteFilters,
  routeFilters,
  updateRouteFilter,
} from "@/components/library/library-route-state";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";
import { runtimeEntryToLibraryDoc } from "@/lib/runtime-local-index";
import { loadOnboardingState, updateOnboardingState } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { ContentStatus } from "@/components/ui/content-primitives";
import { ContentBody, ContentPage } from "@/components/layout/ContentPage";

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

type TabId = LibraryTabId;

type RuntimeLocalDocsState =
  | { status: "idle"; folder: null; docs: LibraryDoc[]; error: null }
  | { status: "loading"; folder: string; docs: LibraryDoc[]; error: null }
  | { status: "ready"; folder: string; docs: LibraryDoc[]; error: null }
  | { status: "error"; folder: string; docs: LibraryDoc[]; error: string };

const TABS: { id: TabId; label: string; match: (d: LibraryDoc) => boolean }[] = [
  { id: "all", label: "All Documents", match: (d) => d.kind !== "archive" },
  { id: "notes", label: "Notes", match: (d) => d.kind === "note" },
  { id: "drafts", label: "Drafts", match: (d) => d.kind === "draft" },
  { id: "images", label: "With Covers", match: (d) => d.kind === "image" },
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

function documentCountLabel(count: number): string {
  return `${count} included ${count === 1 ? "document" : "documents"}`;
}

/**
 * Makes the active source explicit before a reader starts filtering or saving
 * documents. The bundled demo is useful, but it must never look like the
 * user's connected library.
 */
function LibrarySourceContext({
  state,
  bundledDocumentCount,
}: {
  state: RuntimeLocalDocsState;
  bundledDocumentCount: number;
}) {
  const canManage = state.status === "idle" || state.status === "error" || state.status === "ready";
  const isEmptyLocal = state.status === "ready" && state.docs.length === 0;
  const actionLabel =
    state.status === "idle"
      ? "Connect a folder"
      : state.status === "error"
        ? "Choose another folder"
        : "Manage source";

  let eyebrow = "Included demo";
  let title = "Verto demo workspace";
  let copy = `You are viewing ${documentCountLabel(bundledDocumentCount)}. Connect a local folder to browse your own Markdown and MDX files.`;

  if (state.status === "loading") {
    eyebrow = "Local library";
    title = "Opening your folder";
    copy = `Reading ${state.folder}…`;
  } else if (state.status === "error") {
    eyebrow = "Local library";
    title = "Your folder needs attention";
    copy = `Verto could not read ${state.folder}. Check the folder and choose it again to continue browsing.`;
  } else if (state.status === "ready") {
    eyebrow = "Local library";
    title = isEmptyLocal ? "No Markdown files found" : "Your local library is connected";
    copy = isEmptyLocal
      ? `${state.folder} has no .md or .mdx files yet. Add one, then return here to browse it.`
      : `Reading ${state.folder} · ${state.docs.length} real local ${state.docs.length === 1 ? "file is" : "files are"} ready to browse.`;
  }

  return (
    <section
      className={`lib-source-context${state.status === "error" ? " is-error" : ""}`}
      aria-label="Library source"
      aria-busy={state.status === "loading"}
    >
      <span className="lib-source-context-icon" aria-hidden>
        <FolderOpen />
      </span>
      <div className="lib-source-context-copy">
        <p>{eyebrow}</p>
        <strong>{title}</strong>
        <span>{copy}</span>
      </div>
      {canManage ? (
        <Link
          href="/integrations#local-files"
          className="v-btn v-btn--sm lib-source-context-action"
        >
          {actionLabel}
          <ArrowUpRight aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

function LibraryRuntimeStatus({ state }: { state: RuntimeLocalDocsState }) {
  if (state.status === "loading") {
    return (
      <ContentStatus
        status="loading"
        title="Loading local library"
        description={`Documents will appear after Verto finishes reading ${state.folder}.`}
      />
    );
  }

  if (state.status === "error") {
    return (
      <ContentStatus
        status="error"
        title="Could not load the local library"
        description={`Verto could not read ${state.folder}. Reconnect the folder or choose another source.`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations#local-files">Manage sources</Link>
          </Button>
        }
      />
    );
  }

  return null;
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
    <div className="content-toolbar lib-toolbar">
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
        aria-label="Filter by folder"
      >
        <option value="all">All Folders</option>
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
export default function LibraryBrowser({
  docs,
  bundledSectionCount,
}: {
  docs: LibraryDoc[];
  bundledSectionCount: number;
}) {
  useEffect(() => {
    if (!loadOnboardingState().libraryOpened) {
      updateOnboardingState({ libraryOpened: true });
    }
  }, []);

  const runtime = useRuntimeLocalIndex();
  const runtimeLocal = runtimeLocalDocs(runtime);

  // URL state is the canonical, shareable filter state. Popstate handles
  // browser back/forward, while local changes notify the same subscription.
  const search = useSyncExternalStore(subscribeLocation, locationSearch, () => "");
  const filters = useMemo(() => routeFilters(search), [search]);
  const { tab, query, source, tag } = filters;

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
  const emptyMessage =
    activeDocs.length > 0
      ? "No documents match the current filters."
      : runtimeEmptyMessage(runtimeLocal);
  const hasActiveFilters =
    tab !== "all" || query.trim() !== "" || source !== "all" || tag !== "all";

  return (
    <ContentPage width="standard" className="library-content-page">
      <LibraryPageHeader
        runtime={runtime}
        bundledDocumentCount={docs.length}
        bundledSectionCount={bundledSectionCount}
      />
      <LibraryTabs
        tabs={TABS}
        value={tab}
        counts={counts}
        onValueChange={(value) => updateRouteFilter("tab", value)}
      />

      <ContentBody
        className="lib-workbench"
        aside={
          <div className="lib-context-panel" aria-label="Library context" data-context-panel>
            <LibrarySourceContext state={runtimeLocal} bundledDocumentCount={docs.length} />
          </div>
        }
      >
        <div
          className="lib-main"
          id="library-documents"
          role="tabpanel"
          aria-labelledby={libraryTabId(activeTab.id)}
        >
          <LibraryToolbar
            query={query}
            onQueryChange={(value) => updateRouteFilter("q", value, { replace: true })}
            source={source}
            onSourceChange={(value) => updateRouteFilter("source", value)}
            tag={tag}
            onTagChange={(value) => updateRouteFilter("tag", value)}
            sources={sources}
            tags={tags}
          />

          {runtimeLocal.status === "loading" || runtimeLocal.status === "error" ? (
            <LibraryRuntimeStatus state={runtimeLocal} />
          ) : (
            <LibraryDocumentResults
              rows={rows}
              progressMap={progressMap}
              bookmarkedHrefs={bookmarkedHrefs}
              emptyMessage={emptyMessage}
              onClearFilters={hasActiveFilters ? clearRouteFilters : undefined}
            />
          )}
        </div>
      </ContentBody>
    </ContentPage>
  );
}
