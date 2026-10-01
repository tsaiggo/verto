import {
  draftClaimKey,
  draftStorageRequest,
  notifyDraftChanges,
  readDraftsWithStatus,
  mailDraftVersion,
  withDraftStorage,
  writeDrafts,
  type DraftDeliveryClaim,
  type MailDraft,
} from "./drafts";
import type { MailConnector, MailOutgoing } from "./model";

const MARKER_PREFIX = "verto.mail.delivery.v1:";
const INTERRUPTED_WARNING = "Previous send could not be confirmed. Check Sent before retrying.";
const CONFIRMED_WARNING =
  "This message was sent, but its local draft could not be removed. Do not send it again.";
const LEASE_DURATION = 10 * 60 * 1000;
const pending = new Set<string>();
const listeners = new Set<() => void>();
let expiryTimer: ReturnType<typeof setInterval> | undefined;

function deliveryKey(accountKey: string, id: string): string {
  return draftClaimKey(accountKey, id);
}

function markerKey(accountKey: string, id: string): string {
  return `${MARKER_PREFIX}${encodeURIComponent(deliveryKey(accountKey, id))}`;
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Subscriber errors must not turn a confirmed provider send into a failure.
    }
  }
}

interface DeliveryMarker {
  version: number;
  owner?: string;
  state?: "pending" | "uncertain" | "confirmed";
  leaseUntil?: number;
}

function readDeliveryMarker(accountKey: string, id: string): DeliveryMarker | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(markerKey(accountKey, id));
    return raw === null ? null : (JSON.parse(raw) as DeliveryMarker);
  } catch {
    return null;
  }
}

function markDelivery(
  accountKey: string,
  id: string,
  owner: string,
  state: DeliveryMarker["state"],
  leaseUntil?: number
): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(
      markerKey(accountKey, id),
      JSON.stringify({
        version: 1,
        accountKey,
        draftId: id,
        startedAt: new Date().toISOString(),
        owner,
        state,
        ...(leaseUntil === undefined ? {} : { leaseUntil }),
      })
    );
    return true;
  } catch {
    return false;
  }
}

function clearDeliveryMarker(accountKey: string, id: string, owner: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (readDeliveryMarker(accountKey, id)?.owner !== owner) return false;
    window.localStorage.removeItem(markerKey(accountKey, id));
    return true;
  } catch {
    return false;
  }
}

export function isDraftSending(accountKey: string, id: string): boolean {
  if (pending.has(deliveryKey(accountKey, id))) return true;
  const marker = readDeliveryMarker(accountKey, id);
  return marker?.state === "pending" && (marker.leaseUntil ?? 0) > Date.now();
}

export function subscribeMailDelivery(callback: () => void): () => void {
  listeners.add(callback);
  // A crashed sender emits no settlement event. Wake snapshots so an expired lease exposes recovery.
  if (expiryTimer === undefined) expiryTimer = setInterval(notify, 30_000);
  const changed = (event: StorageEvent) => {
    if (event.key === null || event.key?.startsWith(MARKER_PREFIX)) callback();
  };
  if (typeof window !== "undefined") window.addEventListener?.("storage", changed);
  return () => {
    listeners.delete(callback);
    if (!listeners.size && expiryTimer !== undefined) {
      clearInterval(expiryTimer);
      expiryTimer = undefined;
    }
    if (typeof window !== "undefined") window.removeEventListener?.("storage", changed);
  };
}

/** A persisted marker survives a reload where the previous provider result was lost. */
export function draftDeliveryWarning(accountKey: string, id: string): string | null {
  if (isDraftSending(accountKey, id)) return null;
  const marker = readDeliveryMarker(accountKey, id);
  return marker?.state === "confirmed" ? CONFIRMED_WARNING : marker ? INTERRUPTED_WARNING : null;
}

async function reserveDelivery(draft: MailDraft, owner: string): Promise<void> {
  const { accountKey, id } = draft;
  try {
    await withDraftStorage(async (claims) => {
      const key = deliveryKey(accountKey, id);
      const claim = await draftStorageRequest<DraftDeliveryClaim | undefined>(claims.get(key));
      if (claim?.state === "confirmed")
        throw new Error("This draft was already sent. Do not send it again.");
      if (claim && claim.leaseUntil > Date.now())
        throw new Error(
          "This draft is already being sent in another mail window. Wait for the result."
        );
      const current = readDraftsWithStatus(accountKey);
      if (current.status !== "ok")
        throw new Error(
          "Browser storage is unavailable or damaged. Copy your draft before leaving; sending could not start."
        );
      const saved = current.drafts.find((item) => item.id === id);
      if (!saved)
        throw new Error(
          "This draft was removed or moved to another account. Open its saved copy before sending."
        );
      if (mailDraftVersion(saved) !== mailDraftVersion(draft))
        throw new Error(
          "This draft was updated in another mail window. Load its saved version before sending."
        );
      const leaseUntil = Date.now() + LEASE_DURATION;
      if (!markDelivery(accountKey, id, owner, "pending", leaseUntil))
        throw new Error(
          "Browser storage is unavailable. Copy your draft before leaving; sending could not start."
        );
      await draftStorageRequest(claims.put({ owner, leaseUntil, state: "pending" }, key));
    });
  } catch (error) {
    if (readDeliveryMarker(accountKey, id)?.owner === owner)
      clearDeliveryMarker(accountKey, id, owner);
    throw error;
  }
}

async function renewDelivery(accountKey: string, id: string, owner: string): Promise<void> {
  await withDraftStorage(async (claims) => {
    const key = deliveryKey(accountKey, id);
    const claim = await draftStorageRequest<DraftDeliveryClaim | undefined>(claims.get(key));
    if (claim?.owner !== owner || claim.state !== "pending") return;
    claim.leaseUntil = Date.now() + LEASE_DURATION;
    await draftStorageRequest(claims.put(claim, key));
    markDelivery(accountKey, id, owner, "pending", claim.leaseUntil);
  });
}

async function settleDelivery(
  accountKey: string,
  id: string,
  owner: string,
  confirmed: boolean
): Promise<boolean> {
  try {
    const settled = await withDraftStorage(async (claims) => {
      const key = deliveryKey(accountKey, id);
      const claim = await draftStorageRequest<DraftDeliveryClaim | undefined>(claims.get(key));
      if (claim?.owner !== owner) return false;
      if (!confirmed) {
        await draftStorageRequest(claims.delete(key));
        return true;
      }
      // Keep a durable receipt even if localStorage cleanup fails or another tab has a stale editor.
      await draftStorageRequest(claims.put({ ...claim, state: "confirmed" }, key));
      return true;
    });
    if (!settled) return false;
    // Request success is not transaction commit. Retain the draft and marker
    // until the durable receipt above commits, then perform guarded cleanup.
    markDelivery(accountKey, id, owner, confirmed ? "confirmed" : "uncertain");
    if (!confirmed) return true;
    const saved = await withDraftStorage(async (claims) => {
      const claim = await draftStorageRequest<DraftDeliveryClaim | undefined>(
        claims.get(deliveryKey(accountKey, id))
      );
      if (claim?.owner !== owner || claim.state !== "confirmed") return false;
      const current = readDraftsWithStatus(accountKey);
      const draftSaved =
        current.status === "ok" &&
        writeDrafts(
          accountKey,
          current.drafts.filter((item) => item.id !== id)
        );
      return draftSaved && clearDeliveryMarker(accountKey, id, owner);
    });
    notifyDraftChanges();
    return saved;
  } catch {
    return false;
  }
}

/** Delivery and cleanup belong to the captured account and draft, independently of mounted UI. */
export async function deliverMailDraft(
  connector: MailConnector,
  draft: MailDraft,
  outgoing: MailOutgoing
): Promise<{ storageSaved: boolean }> {
  const { accountKey, id } = draft;
  if (!accountKey.trim() || !id.trim()) throw new Error("This draft has no connected account.");
  if (!connector.sendMessage) throw new Error("Sending is unavailable for this account.");
  const key = deliveryKey(accountKey, id);
  if (pending.has(key)) {
    throw new Error("This draft is already being sent. Wait for the result before trying again.");
  }
  // Claim synchronously, before calling the provider or yielding to another composer.
  pending.add(key);
  notify();
  const owner = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  let reserved = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    await reserveDelivery(draft, owner);
    reserved = true;
    heartbeat = setInterval(() => {
      void renewDelivery(accountKey, id, owner).catch(() => undefined);
    }, 30_000);
    try {
      await connector.sendMessage(outgoing);
    } catch (error) {
      await settleDelivery(accountKey, id, owner, false);
      throw error;
    }
    return { storageSaved: await settleDelivery(accountKey, id, owner, true) };
  } finally {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    // No provider result is inferred from a lease timeout; retries require another explicit send.
    pending.delete(key);
    if (!reserved && readDeliveryMarker(accountKey, id)?.owner === owner)
      clearDeliveryMarker(accountKey, id, owner);
    notify();
  }
}
