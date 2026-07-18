"use client";

import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { requestAppNavigation } from "@/lib/app-navigation";
import { Plus, X } from "lucide-react";
import { resolveDocumentTab, type DocumentTab } from "@/lib/document-tabs";

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

const STORAGE_KEY = "verto:open-tabs";

function parseTabs(raw: string): DocumentTab[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DocumentTab =>
        !!item &&
        typeof (item as DocumentTab).path === "string" &&
        typeof (item as DocumentTab).title === "string"
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
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readStoredTabs(): DocumentTab[] {
  return parseTabs(getClientSnapshot());
}

function writeStoredTabs(tabs: DocumentTab[]): void {
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
  return (
    <Suspense fallback={<div className="app-tabs" aria-hidden />}>
      <DocumentTabsContent />
    </Suspense>
  );
}

function DocumentTabsContent() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const snapshot = useSyncExternalStore(subscribeStorage, getClientSnapshot, getServerSnapshot);
  const storedTabs = useMemo(() => parseTabs(snapshot), [snapshot]);

  const current = resolveDocumentTab(pathname, searchParams?.toString() ?? "");
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

  const closeTab = (path: string) => {
    const stored = readStoredTabs();
    // The current route is rendered immediately, before its persistence
    // effect runs. Keep its close action real even when storage is blocked.
    const available =
      current && !stored.some((tab) => tab.path === current.path) ? [...stored, current] : stored;
    const index = available.findIndex((tab) => tab.path === path);
    if (index === -1) return;
    const next = available.filter((tab) => tab.path !== path);
    if (path === currentPath && !requestAppNavigation()) return;
    writeStoredTabs(next);
    if (path === currentPath) {
      const fallback = next[index - 1] ?? next[index] ?? null;
      router.push(fallback ? fallback.path : "/");
    }
  };

  if (!current) return null;

  const displayTabs = storedTabs.some((tab) => tab.path === current.path)
    ? storedTabs
    : [...storedTabs, current];

  const focusTab = (path: string) => {
    if (path !== currentPath && !requestAppNavigation()) return;
    router.push(path);
    requestAnimationFrame(() => tabRefs.current.get(path)?.focus());
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let targetIndex: number | null = null;
    if (event.key === "ArrowLeft")
      targetIndex = (index - 1 + displayTabs.length) % displayTabs.length;
    if (event.key === "ArrowRight") targetIndex = (index + 1) % displayTabs.length;
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = displayTabs.length - 1;
    if (event.key === "Delete") {
      event.preventDefault();
      closeTab(displayTabs[index].path);
      return;
    }
    if (targetIndex == null) return;
    event.preventDefault();
    focusTab(displayTabs[targetIndex].path);
  };

  return (
    <div className="app-tabs" role="tablist" aria-label="Open documents">
      {displayTabs.map((tab, index) => {
        const active = tab.path === current.path;
        return (
          <div key={tab.path} className={`app-tab${active ? " is-on" : ""}`} role="presentation">
            <button
              type="button"
              className="app-tab-open"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.path, node);
                else tabRefs.current.delete(tab.path);
              }}
              onClick={() => focusTab(tab.path)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span className="app-tab-label">{tab.title}</span>
            </button>
            <button
              type="button"
              className="app-tab-close"
              aria-label={`Close ${tab.title}`}
              tabIndex={-1}
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
        onClick={() => {
          if (requestAppNavigation()) router.push("/search");
        }}
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
