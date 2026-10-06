"use client";

import { useSyncExternalStore } from "react";

// A manual layout choice survives client-side document navigation. Reloading
// the workspace starts with the reading/editing defaults again.
let manualPreference: boolean | null = null;
const preferenceListeners = new Set<() => void>();
function subscribePreference(callback: () => void) {
  preferenceListeners.add(callback);
  return () => preferenceListeners.delete(callback);
}
const getPreference = () => manualPreference;
const serverPreference = () => null;

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

/** Reading starts focused; editing can use desktop space until a manual choice. */
export function useDocumentNavigation({ defaultOpen = false } = {}) {
  const wide = useSyncExternalStore(subscribe, wideViewport, () => false);
  const preference = useSyncExternalStore(subscribePreference, getPreference, serverPreference);
  const open = preference ?? (defaultOpen && wide);
  return {
    open,
    toggle: () => {
      manualPreference = !open;
      preferenceListeners.forEach((listener) => listener());
    },
  };
}
