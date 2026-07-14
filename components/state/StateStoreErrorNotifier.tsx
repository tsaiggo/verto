"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { STATE_STORE_ERROR_EVENT, type StateStoreErrorDetail } from "@/lib/state-store";

function isStateStoreErrorDetail(value: unknown): value is StateStoreErrorDetail {
  if (typeof value !== "object" || value === null) return false;
  const detail = value as Partial<StateStoreErrorDetail>;
  return (
    (detail.operation === "hydrate" ||
      detail.operation === "mirror" ||
      detail.operation === "update") &&
    typeof detail.name === "string" &&
    typeof detail.message === "string"
  );
}

function stateLabel(name: string): string {
  const labels: Record<string, string> = {
    annotations: "notes and highlights",
    bookmarks: "bookmarks",
    collections: "collections",
    "agent-threads": "Agent threads",
    "reading-state": "reading progress",
    summaries: "saved summaries",
  };
  return labels[name] ?? "library state";
}

/** Surfaces portable-vault failures that would otherwise only appear in logs. */
export default function StateStoreErrorNotifier() {
  useEffect(() => {
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isStateStoreErrorDetail(detail)) return;

      const restoring = detail.operation === "hydrate";
      const switchedLibrary = detail.operation === "update";
      const label = stateLabel(detail.name);
      toast.error(
        switchedLibrary
          ? "Library changed before state was saved"
          : restoring
            ? "Couldn’t restore portable library state"
            : "Couldn’t save portable library state",
        {
          id: `state-store-${detail.operation}-${detail.name}`,
          description: switchedLibrary
            ? `The ${label} change was cancelled to protect both libraries. Try it again in the active library.`
            : restoring
              ? `Verto is using locally cached ${label}. Check the vault’s .verto files, then reload to retry.`
              : `This session still has the latest ${label}. Check vault permissions; the next change will retry.`,
          duration: 8000,
        }
      );
    };

    window.addEventListener(STATE_STORE_ERROR_EVENT, onError);
    return () => window.removeEventListener(STATE_STORE_ERROR_EVENT, onError);
  }, []);

  return null;
}
