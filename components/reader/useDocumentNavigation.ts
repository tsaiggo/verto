"use client";

import { useState, useSyncExternalStore } from "react";

const QUERY = "(min-width: 1051px)";
function subscribe(callback: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function wideViewport() {
  return typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** Follow available desktop space until the reader chooses their own layout. */
export function useDocumentNavigation() {
  const wide = useSyncExternalStore(subscribe, wideViewport, () => false);
  const [preference, setPreference] = useState<boolean | null>(null);
  const open = preference ?? wide;
  return { open, toggle: () => setPreference(!open) };
}
