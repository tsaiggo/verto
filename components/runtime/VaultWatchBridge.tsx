"use client";

import { useEffect, useState } from "react";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { loadActiveRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import { refreshLocalFolderState } from "@/lib/state-store";
import {
  isTauri,
  listenVaultWatch,
  listenVaultWatchStatus,
  startVaultWatch,
  stopVaultWatch,
  type VaultWatchBatch,
  type VaultWatchSession,
  type VaultWatchUnlisten,
} from "@/lib/tauri";
import {
  acceptVaultWatchBatch,
  acceptVaultWatchStatus,
  cursorFromSession,
  RUNTIME_VAULT_RESCAN_EVENT,
  RUNTIME_VAULT_WATCH_EVENT,
  RUNTIME_VAULT_WATCH_STATUS_EVENT,
  VAULT_WATCH_FALLBACK_POLL_MS,
  type RuntimeVaultRescanDetail,
  type RuntimeVaultWatchStatus,
  type VaultWatchCursor,
} from "@/lib/vault-watch";

function dispatchRescan(root: string, reason: RuntimeVaultRescanDetail["reason"]) {
  window.dispatchEvent(
    new CustomEvent<RuntimeVaultRescanDetail>(RUNTIME_VAULT_RESCAN_EVENT, {
      detail: { root, reason },
    })
  );
}

function dispatchStatus(detail: RuntimeVaultWatchStatus) {
  window.dispatchEvent(
    new CustomEvent<RuntimeVaultWatchStatus>(RUNTIME_VAULT_WATCH_STATUS_EVENT, {
      detail,
    })
  );
}

interface PortableStateRefreshRequest {
  names?: readonly string[];
}

function createPortableStateRefresher(root: string, isCancelled: () => boolean) {
  let running = false;
  let dirtyAll = false;
  const dirtyNames = new Set<string>();

  const mergeDirty = ({ names }: PortableStateRefreshRequest) => {
    if (names === undefined) {
      dirtyAll = true;
      dirtyNames.clear();
      return;
    }
    if (!dirtyAll) names.forEach((name) => dirtyNames.add(name));
  };

  const execute = async ({ names }: PortableStateRefreshRequest) => {
    try {
      if (!isCancelled()) {
        if (names === undefined) await refreshLocalFolderState(root);
        else await refreshLocalFolderState(root, names);
      }
    } catch {
      // StateStore reports a structured error and keeps its last safe value.
    }

    if (isCancelled()) {
      running = false;
      dirtyAll = false;
      dirtyNames.clear();
      return;
    }

    const next = dirtyAll ? {} : dirtyNames.size > 0 ? { names: [...dirtyNames] } : null;
    dirtyAll = false;
    dirtyNames.clear();
    if (next) {
      void execute(next);
    } else {
      running = false;
    }
  };

  const request = (names?: readonly string[]) => {
    if (isCancelled() || names?.length === 0) return;
    const next = names === undefined ? {} : { names };
    if (running) {
      mergeDirty(next);
      return;
    }
    running = true;
    void execute(next);
  };

  return { request };
}

function createWatchFallback(
  root: string,
  isCancelled: () => boolean,
  refreshPortableState: () => void
) {
  let poll: number | null = null;
  let listenersInstalled = false;
  const rescan = (reason: RuntimeVaultRescanDetail["reason"]) => {
    dispatchRescan(root, reason);
    refreshPortableState();
  };
  const wake = () => rescan("fallback-wake");
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") wake();
  };
  const stop = () => {
    if (poll !== null) {
      window.clearInterval(poll);
      poll = null;
    }
    if (listenersInstalled) {
      listenersInstalled = false;
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
  const start = (error: unknown) => {
    if (isCancelled()) return;
    const message = error instanceof Error ? error.message : String(error);
    dispatchStatus({ root, status: "degraded", error: message });
    if (poll !== null) return;
    rescan("watch-unavailable");
    poll = window.setInterval(() => rescan("fallback-poll"), VAULT_WATCH_FALLBACK_POLL_MS);
    listenersInstalled = true;
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", onVisibilityChange);
  };
  return { start, stop };
}

/**
 * Owns the single native watcher subscription for the application shell.
 * Index consumers use a DOM event so mounting multiple pages can never create
 * competing native generations.
 */
export default function VaultWatchBridge() {
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
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
    if (!folder || !isTauri()) return;

    let cancelled = false;
    let unlistenBatches: VaultWatchUnlisten | null = null;
    let unlistenStatus: VaultWatchUnlisten | null = null;
    let session: VaultWatchSession | null = null;
    let cursor: VaultWatchCursor | null = null;
    const portableState = createPortableStateRefresher(folder, () => cancelled);
    const fallback = createWatchFallback(
      folder,
      () => cancelled,
      () => portableState.request()
    );
    const buffered: Array<{ kind: "batch"; value: unknown } | { kind: "status"; value: unknown }> =
      [];

    const publishBatch = (value: unknown) => {
      if (cancelled) return;
      if (!cursor) {
        if (value && typeof value === "object") buffered.push({ kind: "batch", value });
        return;
      }
      const accepted = acceptVaultWatchBatch(cursor, value);
      if (!accepted) return;
      cursor = accepted.cursor;
      if (accepted.batch.portableStateRescan) portableState.request();
      else portableState.request(accepted.batch.portableStateNames);
      window.dispatchEvent(
        new CustomEvent<VaultWatchBatch>(RUNTIME_VAULT_WATCH_EVENT, {
          detail: accepted.batch,
        })
      );
      if (accepted.batch.rescan || accepted.batch.changes.length > 0) {
        // Existing source-grounded Agent surfaces invalidate their captured
        // context only when Markdown/MDX changed.
        window.dispatchEvent(new CustomEvent(LOCAL_FOLDER_CHANGED_EVENT));
      }
    };

    const publishStatus = (value: unknown) => {
      if (cancelled) return;
      if (!cursor) {
        if (value && typeof value === "object") buffered.push({ kind: "status", value });
        return;
      }
      const accepted = acceptVaultWatchStatus(cursor, value);
      if (!accepted) return;
      if (accepted.status === "degraded") {
        fallback.start(accepted.error);
        return;
      }
      fallback.stop();
      dispatchStatus({ root: folder, status: "active" });
    };

    void (async () => {
      const disposeBatches = await listenVaultWatch(publishBatch);
      if (cancelled) {
        disposeBatches();
        return;
      }
      unlistenBatches = disposeBatches;

      const disposeStatus = await listenVaultWatchStatus(publishStatus);
      if (cancelled) {
        disposeStatus();
        unlistenBatches?.();
        unlistenBatches = null;
        return;
      }
      unlistenStatus = disposeStatus;

      const started = await startVaultWatch(folder);
      session = started;
      if (cancelled) {
        unlistenBatches?.();
        unlistenBatches = null;
        unlistenStatus?.();
        unlistenStatus = null;
        await stopVaultWatch(started.generation);
        return;
      }
      cursor = cursorFromSession(started);
      dispatchStatus({ root: folder, status: "active" });
      portableState.request();
      // The watcher is now established. Relisting after this point closes the
      // race with any initial index build that completed before native watch
      // registration; subsequent native events are queued behind this boundary.
      dispatchRescan(folder, "watch-started");
      for (const event of buffered.splice(0)) {
        if (event.kind === "batch") publishBatch(event.value);
        else publishStatus(event.value);
      }
    })().catch((error: unknown) => {
      unlistenBatches?.();
      unlistenBatches = null;
      unlistenStatus?.();
      unlistenStatus = null;
      if (session) {
        void stopVaultWatch(session.generation).catch(() => undefined);
      }
      if (!cancelled) {
        console.error("Could not start the active Vault watcher.", error);
        fallback.start(error);
      }
    });

    return () => {
      cancelled = true;
      fallback.stop();
      unlistenBatches?.();
      unlistenBatches = null;
      unlistenStatus?.();
      unlistenStatus = null;
      if (session) {
        void stopVaultWatch(session.generation).catch(() => {
          // A newer Vault generation may already own the watcher.
        });
      }
    };
  }, [folder]);

  return null;
}
