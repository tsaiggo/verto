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
  index: RuntimeLocalIndex | null;
  error: string | null;
}

const IDLE_STATE: RuntimeLocalIndexState = {
  status: "idle",
  folder: null,
  index: null,
  error: null,
};

export function useRuntimeLocalIndex(): RuntimeLocalIndexState {
  const [folder, setFolder] = useState<string | null>(null);
  const [result, setResult] = useState<RuntimeLocalIndexResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setFolder(loadActiveRuntimeLocalFolder());
    };
    queueMicrotask(refresh);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!folder) return;

    let cancelled = false;
    buildRuntimeLocalIndex(folder)
      .then((index) => {
        if (!cancelled) setResult({ folder, index, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            folder,
            index: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [folder]);

  if (!folder) return IDLE_STATE;
  if (!result || result.folder !== folder) {
    return { status: "loading", folder, index: null, error: null };
  }
  if (result.error) return { status: "error", folder, index: null, error: result.error };
  if (result.index) return { status: "ready", folder, index: result.index, error: null };
  return { status: "loading", folder, index: null, error: null };
}
