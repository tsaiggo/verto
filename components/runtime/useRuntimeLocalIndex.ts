"use client";

import { useEffect, useState } from "react";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import {
  applyRuntimeLocalIndexBatch,
  buildRuntimeLocalIndex,
  type RuntimeLocalIndex,
} from "@/lib/runtime-local-index";
import { loadActiveRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import { isTauri, isVaultWatchBatch, type VaultWatchBatch } from "@/lib/tauri";
import {
  acceptVaultWatchBatch,
  RUNTIME_VAULT_RESCAN_EVENT,
  RUNTIME_VAULT_WATCH_EVENT,
  type RuntimeVaultRescanDetail,
  type VaultWatchCursor,
} from "@/lib/vault-watch";

export type RuntimeLocalIndexState =
  | { status: "idle"; folder: null; index: null; error: null }
  | { status: "loading"; folder: string; index: null; error: null }
  | { status: "ready"; folder: string; index: RuntimeLocalIndex; error: null }
  | { status: "error"; folder: string; index: null; error: string };

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

function normalizeWatchBatch(
  batch: VaultWatchBatch,
  generationChanged: boolean
): VaultWatchBatch | null {
  const normalized = generationChanged ? { ...batch, rescan: true, changes: [] } : batch;
  return normalized.rescan || normalized.changes.length > 0 ? normalized : null;
}

// eslint-disable-next-line max-lines-per-function -- One effect intentionally owns the generation token, serialized event queue, and rescan coalescing boundary.
export function useRuntimeLocalIndex({
  enabled = true,
}: UseRuntimeLocalIndexOptions = {}): RuntimeLocalIndexState {
  const [state, setState] = useState<RuntimeLocalIndexState>(IDLE_STATE);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let currentFolder: string | null = null;
    let currentIndex: RuntimeLocalIndex | null = null;
    let cursor: VaultWatchCursor | null = null;
    let rootToken = 0;
    let queue: Promise<void> = Promise.resolve();
    let requiresFullIndex = false;
    let fullIndexPending = false;
    let fullIndexDirty = false;

    const reportError = (folder: string, token: number, error: unknown) => {
      if (cancelled || token !== rootToken || folder !== currentFolder) return;
      setState({
        status: "error",
        folder,
        index: null,
        error: error instanceof Error ? error.message : String(error),
      });
    };

    const scheduleFullIndex = (folder: string) => {
      const token = rootToken;
      requiresFullIndex = true;
      if (fullIndexPending) {
        // Keep at most one authoritative follow-up behind the current scan.
        // The follow-up is appended only when the current task settles, so it
        // lands after any watcher batches that arrived in the meantime.
        fullIndexDirty = true;
        return;
      }
      fullIndexPending = true;
      if (!currentIndex) {
        setState({ status: "loading", folder, index: null, error: null });
      }
      queue = queue
        .catch(() => undefined)
        .then(async () => {
          const previous = currentIndex?.folder === folder ? currentIndex : null;
          const index = await buildRuntimeLocalIndex(folder, previous);
          if (cancelled || token !== rootToken || folder !== currentFolder) return;
          currentIndex = index;
          requiresFullIndex = fullIndexDirty;
          setState({ status: "ready", folder, index, error: null });
        })
        .catch((error: unknown) => {
          if (token === rootToken && folder === currentFolder) requiresFullIndex = true;
          reportError(folder, token, error);
        })
        .finally(() => {
          if (cancelled || token !== rootToken || folder !== currentFolder) return;
          fullIndexPending = false;
          if (!fullIndexDirty) return;
          fullIndexDirty = false;
          scheduleFullIndex(folder);
        });
    };

    const setActiveFolder = (folder: string | null, refreshSameBrowserFolder = false) => {
      if (folder === currentFolder) {
        if (folder && refreshSameBrowserFolder) scheduleFullIndex(folder);
        return;
      }

      currentFolder = folder;
      currentIndex = null;
      cursor = null;
      requiresFullIndex = false;
      fullIndexPending = false;
      fullIndexDirty = false;
      rootToken += 1;
      // Old-root work may finish, but its token prevents publication. The new
      // Vault does not wait behind a large scan from the discarded root.
      queue = Promise.resolve();
      if (!folder) {
        setState(IDLE_STATE);
        return;
      }
      scheduleFullIndex(folder);
    };

    const refreshFolder = () => {
      setActiveFolder(loadActiveRuntimeLocalFolder(), !isTauri());
    };

    const onWatchBatch = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (!isVaultWatchBatch(value) || value.root !== currentFolder) return;

      let generationChanged = false;
      if (!cursor) {
        cursor = {
          root: value.root,
          generation: value.generation,
          sequence: 0,
        };
      } else if (value.generation !== cursor.generation) {
        if (value.generation < cursor.generation) return;
        generationChanged = true;
        cursor = {
          root: value.root,
          generation: value.generation,
          sequence: 0,
        };
      }
      const accepted = acceptVaultWatchBatch(cursor, value);
      if (!accepted) {
        return;
      }
      cursor = accepted.cursor;

      const folder = value.root;
      const token = rootToken;
      const batch = normalizeWatchBatch(accepted.batch, generationChanged);
      if (!batch) return;
      queue = queue
        .catch(() => undefined)
        .then(async () => {
          const previous = currentIndex;
          let index: RuntimeLocalIndex;
          if (!previous || requiresFullIndex || batch.rescan) {
            // A coalesced authoritative scan is already queued after this
            // batch. Do not turn every event in a long burst into another
            // full-vault read.
            if (requiresFullIndex && fullIndexPending) return;
            index = await buildRuntimeLocalIndex(folder, previous);
          } else {
            try {
              index = await applyRuntimeLocalIndexBatch(previous, batch);
            } catch {
              // Never advance past a failed targeted batch using stale state.
              // The full listing includes that batch and every event queued
              // behind it, and future batches remain in this promise chain.
              requiresFullIndex = true;
              index = await buildRuntimeLocalIndex(folder, previous);
            }
          }
          if (cancelled || token !== rootToken || folder !== currentFolder) return;
          currentIndex = index;
          requiresFullIndex = false;
          setState({ status: "ready", folder, index, error: null });
        })
        .catch((error: unknown) => {
          if (token === rootToken && folder === currentFolder) requiresFullIndex = true;
          reportError(folder, token, error);
        });
    };

    const onForcedRescan = (event: Event) => {
      const detail = (event as CustomEvent<RuntimeVaultRescanDetail>).detail;
      if (!detail || typeof detail.root !== "string" || detail.root !== currentFolder) {
        return;
      }
      scheduleFullIndex(detail.root);
    };

    queueMicrotask(refreshFolder);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refreshFolder);
    window.addEventListener("storage", refreshFolder);
    window.addEventListener(RUNTIME_VAULT_WATCH_EVENT, onWatchBatch);
    window.addEventListener(RUNTIME_VAULT_RESCAN_EVENT, onForcedRescan);
    return () => {
      cancelled = true;
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refreshFolder);
      window.removeEventListener("storage", refreshFolder);
      window.removeEventListener(RUNTIME_VAULT_WATCH_EVENT, onWatchBatch);
      window.removeEventListener(RUNTIME_VAULT_RESCAN_EVENT, onForcedRescan);
    };
  }, [enabled]);

  return enabled ? state : IDLE_STATE;
}
