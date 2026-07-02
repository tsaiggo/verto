"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

/**
 * Obsidian-style open-document tabs. Each document route the reader visits
 * becomes a persistent tab (recorded in localStorage) so switching between
 * open notes is one click. The band renders only on document routes, sits
 * under the top bar and above the scroll region, and never scrolls with the
 * article, mirroring the prototype .tabs strip inside .center.
 *
 * Tabs are a real, functional feature (not a decorative strip): click a tab to
 * navigate, the close control removes it and falls back to a neighbour, and the
 * add control opens search so another note can be found and opened. Labels are
 * derived from the document slug, which is the note's filename, matching how a
 * file-based workspace names its tabs.
 */

interface DocTab {
  path: string;
  title: string;
}

const STORAGE_KEY = "verto:open-tabs";

function prettifyTitle(segment: string): string {
  const spaced = segment.replace(/[-_]+/g, " ").trim();
  if (!spaced) return segment;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Resolve a pathname to an open-document tab, or null when the route is not a
 * single readable document (home, search, tag/status list views, section roots
 * with no file segment).
 */
function docTabForPath(pathname: string): DocTab | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const head = segments[0];
  const second = segments[1];
  const isHelpDoc = head === "help";
  const isReadDoc = head === "read" && second !== "tags" && second !== "status";
  if (!isHelpDoc && !isReadDoc) return null;

  const last = segments[segments.length - 1];
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    decoded = last;
  }
  return { path: pathname, title: prettifyTitle(decoded) };
}

function parseTabs(raw: string): DocTab[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DocTab =>
        !!item &&
        typeof (item as DocTab).path === "string" &&
        typeof (item as DocTab).title === "string",
    );
  } catch {
    return [];
  }
}

// External-store integration. localStorage is the source of truth; the app
// follows the same useSyncExternalStore pattern as ThemeToggle and
// ReadingSettings so reads stay SSR-safe and writes never call setState inside
// an effect. getServerSnapshot is also used for the first hydration render, so
// server and client agree before the real stored tabs are read.

function getServerSnapshot(): string {
  return "[]";
}

function getClientSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readStoredTabs(): DocTab[] {
  return parseTabs(getClientSnapshot());
}

function writeStoredTabs(tabs: DocTab[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    // The native storage event only fires in other tabs, so dispatch a
    // synthetic one to re-render this tab through useSyncExternalStore.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    // Storage can be unavailable (private mode, quota); the tab bar still
    // reflects the current route for this session.
  }
}

export default function DocumentTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const snapshot = useSyncExternalStore(
    subscribeStorage,
    getClientSnapshot,
    getServerSnapshot,
  );
  const storedTabs = useMemo(() => parseTabs(snapshot), [snapshot]);

  const current = docTabForPath(pathname);
  const currentPath = current?.path ?? null;
  const currentTitle = current?.title ?? null;

  useEffect(() => {
    if (!currentPath || !currentTitle) return;
    // Read fresh storage (not the render snapshot) so a stale value never
    // clobbers tabs recorded in another tab, then append the current note.
    const stored = readStoredTabs();
    if (stored.some((tab) => tab.path === currentPath)) return;
    writeStoredTabs([...stored, { path: currentPath, title: currentTitle }]);
  }, [currentPath, currentTitle]);

  const closeTab = useCallback(
    (path: string) => {
      const stored = readStoredTabs();
      const index = stored.findIndex((tab) => tab.path === path);
      if (index === -1) return;
      const next = stored.filter((tab) => tab.path !== path);
      writeStoredTabs(next);
      if (path === pathname) {
        const fallback = next[index - 1] ?? next[index] ?? null;
        router.push(fallback ? fallback.path : "/");
      }
    },
    [pathname, router],
  );

  if (!current) return null;

  const displayTabs = storedTabs.some((tab) => tab.path === current.path)
    ? storedTabs
    : [...storedTabs, current];

  return (
    <div className="app-tabs" role="tablist" aria-label="Open documents">
      {displayTabs.map((tab) => {
        const active = tab.path === pathname;
        return (
          <div key={tab.path} className={`app-tab${active ? " is-on" : ""}`}>
            <button
              type="button"
              className="app-tab-open"
              onClick={() => router.push(tab.path)}
              aria-current={active ? "page" : undefined}
            >
              <span className="app-tab-label">{tab.title}</span>
            </button>
            <button
              type="button"
              className="app-tab-close"
              aria-label={`Close ${tab.title}`}
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.path);
              }}
            >
              <X size={13} strokeWidth={2} aria-hidden />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="app-tab-add"
        aria-label="Open another note"
        onClick={() => router.push("/search")}
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
