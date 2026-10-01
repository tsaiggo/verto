import { readDraftsWithStatus, writeDrafts, type MailDraft } from "./drafts";
import type { MailConnector, MailOutgoing } from "./model";

const MARKER_PREFIX = "verto.mail.delivery.v1:";
const INTERRUPTED_WARNING = "Previous send could not be confirmed. Check Sent before retrying.";
const pending = new Set<string>();
const listeners = new Set<() => void>();

function deliveryKey(accountKey: string, id: string): string {
  return JSON.stringify([accountKey.trim().toLowerCase(), id]);
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

function markDelivery(accountKey: string, id: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(
      markerKey(accountKey, id),
      JSON.stringify({ version: 1, accountKey, draftId: id, startedAt: new Date().toISOString() })
    );
    return true;
  } catch {
    return false;
  }
}

function clearDeliveryMarker(accountKey: string, id: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.removeItem(markerKey(accountKey, id));
    return true;
  } catch {
    return false;
  }
}

export function isDraftSending(accountKey: string, id: string): boolean {
  return pending.has(deliveryKey(accountKey, id));
}

export function subscribeMailDelivery(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** A persisted marker survives a reload where the previous provider result was lost. */
export function draftDeliveryWarning(accountKey: string, id: string): string | null {
  if (isDraftSending(accountKey, id)) return null;
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(markerKey(accountKey, id)) !== null
      ? INTERRUPTED_WARNING
      : null;
  } catch {
    return null;
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
  const markerSaved = markDelivery(accountKey, id);
  notify();
  try {
    await connector.sendMessage(outgoing);
    const saved = readDraftsWithStatus(accountKey);
    const draftSaved =
      saved.status === "ok" &&
      writeDrafts(
        accountKey,
        saved.drafts.filter((item) => item.id !== id)
      );
    const markerCleared = clearDeliveryMarker(accountKey, id);
    return { storageSaved: markerSaved && draftSaved && markerCleared };
  } finally {
    // A rejected request keeps its persisted marker and draft; retry is always explicit.
    pending.delete(key);
    notify();
  }
}
