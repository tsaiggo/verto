import type { LibraryTabId } from "@/components/library/LibraryTabs";

interface LibraryRouteFilters {
  tab: LibraryTabId;
  query: string;
  source: string;
  tag: string;
}

type LibraryFilterKey = "tab" | "q" | "source" | "tag";

const LIBRARY_FILTER_KEYS: LibraryFilterKey[] = ["tab", "q", "source", "tag"];
const LIBRARY_TABS: LibraryTabId[] = ["all", "notes", "drafts", "images", "archives"];

function isLibraryTabId(value: string | null): value is LibraryTabId {
  return value !== null && LIBRARY_TABS.includes(value as LibraryTabId);
}

export function routeFilters(search: string): LibraryRouteFilters {
  const params = new URLSearchParams(search);
  const requestedTab = params.get("tab");
  return {
    tab: isLibraryTabId(requestedTab) ? requestedTab : "all",
    query: params.get("q") ?? "",
    source: params.get("source")?.trim() || "all",
    tag: params.get("tag")?.trim() || "all",
  };
}

function notifyLocationChanged(): void {
  window.dispatchEvent(new Event("popstate"));
}

export function updateRouteFilter(
  key: LibraryFilterKey,
  value: string,
  options: { replace?: boolean } = {}
): void {
  const url = new URL(window.location.href);
  if (!value || value === "all") url.searchParams.delete(key);
  else url.searchParams.set(key, value);

  const next = url.pathname + url.search + url.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next === current) return;

  const method = options.replace ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", next);
  notifyLocationChanged();
}

export function clearRouteFilters(): void {
  const url = new URL(window.location.href);
  for (const key of LIBRARY_FILTER_KEYS) url.searchParams.delete(key);

  const next = url.pathname + url.search + url.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next === current) return;

  window.history.pushState(window.history.state, "", next);
  notifyLocationChanged();
}
