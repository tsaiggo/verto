"use client";

import { useMemo, useSyncExternalStore } from "react";
import { annotationsForDoc, loadAnnotations, type Annotation } from "@/lib/annotations";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return JSON.stringify(loadAnnotations().annotations);
}

function getServerSnapshot() {
  return "[]";
}

/** Reactive list of annotations for one document, synced across tabs and panels. */
export function useDocAnnotations(docSlug: string): Annotation[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    try {
      const all = JSON.parse(snapshot) as Annotation[];
      return annotationsForDoc(all, docSlug);
    } catch {
      return [];
    }
  }, [snapshot, docSlug]);
}
