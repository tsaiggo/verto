"use client";

import { useSyncExternalStore } from "react";

// A manual layout choice survives client-side document navigation. Reloading
// the workspace starts with its focused default again.
let manualPreference: boolean | null = null;
const preferenceListeners = new Set<() => void>();
function subscribePreference(callback: () => void) {
  preferenceListeners.add(callback);
  return () => preferenceListeners.delete(callback);
}
const getPreference = () => manualPreference;
const serverPreference = () => null;

/** Reader, Source and Preview share one focused default and manual choice. */
export function useDocumentNavigation() {
  const preference = useSyncExternalStore(subscribePreference, getPreference, serverPreference);
  const open = preference ?? false;
  return {
    open,
    toggle: () => {
      manualPreference = !open;
      preferenceListeners.forEach((listener) => listener());
    },
  };
}
