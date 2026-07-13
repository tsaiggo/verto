"use client";

import { useSyncExternalStore } from "react";

function subscribeLocation(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function onboardingReturnSnapshot(): boolean {
  return new URLSearchParams(window.location.search).get("from") === "onboarding";
}

function onboardingReturnServerSnapshot(): boolean {
  return false;
}

/**
 * Preserve optional onboarding handoffs without making a route dynamic. This
 * lets the same screens work in Next.js and Tauri's file-based static export.
 */
export function useOnboardingReturn(): boolean {
  return useSyncExternalStore(
    subscribeLocation,
    onboardingReturnSnapshot,
    onboardingReturnServerSnapshot
  );
}
