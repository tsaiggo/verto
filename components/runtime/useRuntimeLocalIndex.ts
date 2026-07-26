"use client";

import { useEffect, useState } from "react";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { buildRuntimeLocalIndex, type RuntimeLocalIndex } from "@/lib/runtime-local-index";
import { loadActiveRuntimeLocalFolder } from "@/lib/runtime-local-folder";

export type RuntimeLocalIndexState =
  | { status: "idle"; folder: null; index: null; error: null }
  | { status: "loading"; folder: string; index: null; error: null }
  | { status: "ready"; folder: string; index: RuntimeLocalIndex; error: null }
  | { status: "error"; folder: string; index: null; error: string };

interface RuntimeLocalIndexResult {
  folder: string;
  revision: number;
  index: RuntimeLocalIndex | null;
  error: string | null;
}

interface UseRuntimeLocalIndexOptions {
  /** Avoids touching the active vault while a host supplies a complete index. */
  enabled?: boolean;
}

const IDLE_STATE: RuntimeLocalIndexState = {
  status: "idle",
  folder: null,
  index: null,
  error: null,
};

export function useRuntimeLocalIndex({
  enabled = true,
}: UseRuntimeLocalIndexOptions = {}): RuntimeLocalIndexState {
  const [folder, setFolder] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<RuntimeLocalIndexResult | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const refresh = () => {
      if (!cancelled) {
        setFolder(loadActiveRuntimeLocalFolder());
        // A save inside the same Vault keeps its folder path unchanged. The
        // domain event must still invalidate the runtime index so the page
        // tree, search and tags reflect what is now on disk.
        setRevision((value) => value + 1);
      }
    };
    queueMicrotask(refresh);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !folder) return;

    let cancelled = false;
    buildRuntimeLocalIndex(folder)
      .then((index) => {
        if (!cancelled) setResult({ folder, revision, index, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            folder,
            revision,
            index: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, folder, revision]);

  if (!enabled || !folder) return IDLE_STATE;
  if (!result || result.folder !== folder || result.revision !== revision) {
    return { status: "loading", folder, index: null, error: null };
  }
  if (result.error) return { status: "error", folder, index: null, error: result.error };
  if (result.index) return { status: "ready", folder, index: result.index, error: null };
  return { status: "loading", folder, index: null, error: null };
}
