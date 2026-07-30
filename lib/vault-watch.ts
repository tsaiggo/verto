import {
  isVaultWatchBatch,
  isVaultWatchStatus,
  type VaultWatchBatch,
  type VaultWatchSession,
  type VaultWatchStatus,
} from "./tauri";

export const RUNTIME_VAULT_WATCH_EVENT = "verto:runtime-vault-watch";
export const RUNTIME_VAULT_RESCAN_EVENT = "verto:runtime-vault-rescan";
export const RUNTIME_VAULT_WATCH_STATUS_EVENT = "verto:runtime-vault-watch-status";
export const VAULT_WATCH_FALLBACK_POLL_MS = 10_000;

export interface RuntimeVaultRescanDetail {
  root: string;
  reason: "watch-started" | "watch-unavailable" | "fallback-poll" | "fallback-wake";
}

export type RuntimeVaultWatchStatus =
  | { root: string; status: "active" }
  | { root: string; status: "degraded"; error: string };

export interface VaultWatchCursor {
  root: string;
  generation: number;
  sequence: number;
}

export function cursorFromSession(session: VaultWatchSession): VaultWatchCursor {
  return {
    root: session.root,
    generation: session.generation,
    sequence: session.sequence,
  };
}

/**
 * Reject malformed, cross-Vault, old-generation, and replayed batches before
 * they can invalidate renderer state. A skipped sequence cannot be applied
 * incrementally, so the first batch after a gap is converted to a full rescan
 * boundary while still advancing the cursor.
 */
export function acceptVaultWatchBatch(
  cursor: VaultWatchCursor,
  value: unknown
): { cursor: VaultWatchCursor; batch: VaultWatchBatch } | null {
  if (!isVaultWatchBatch(value)) return null;
  const batch = value;
  if (
    batch.root !== cursor.root ||
    batch.generation !== cursor.generation ||
    batch.sequence <= cursor.sequence
  ) {
    return null;
  }
  const consecutive = batch.sequence === cursor.sequence + 1;
  const requiresContentRescan = !consecutive || batch.rescan || hasConflictingRenameSource(batch);
  const requiresPortableStateRescan = !consecutive || batch.portableStateRescan;
  return {
    cursor: {
      root: batch.root,
      generation: batch.generation,
      sequence: batch.sequence,
    },
    batch:
      requiresContentRescan || requiresPortableStateRescan
        ? {
            ...batch,
            ...(requiresContentRescan ? { rescan: true, changes: [] } : {}),
            ...(requiresPortableStateRescan
              ? { portableStateRescan: true, portableStateNames: [] }
              : {}),
          }
        : batch,
  };
}

/** Reject health events for stale roots or generations before changing fallback state. */
export function acceptVaultWatchStatus(
  cursor: VaultWatchCursor,
  value: unknown
): VaultWatchStatus | null {
  if (!isVaultWatchStatus(value)) return null;
  if (value.root !== cursor.root || value.generation !== cursor.generation) return null;
  return value;
}

function hasConflictingRenameSource(batch: VaultWatchBatch): boolean {
  const changedIds = new Set(
    batch.changes.map((change) => {
      if (change.kind === "remove") return change.id;
      return change.entry.id;
    })
  );
  return batch.changes.some((change) => change.kind === "rename" && changedIds.has(change.fromId));
}
