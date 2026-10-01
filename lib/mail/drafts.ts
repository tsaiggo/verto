import { parseMailRecipients } from "./addresses";
import type { MailAccount, MailMessage } from "./model";

export type DraftMode = "compose" | "reply" | "replyAll" | "forward";

export interface MailDraft {
  id: string;
  accountKey: string;
  mode: DraftMode;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyText: string;
  replyToMessageId?: string;
  internetMessageId?: string;
  updatedAt: string;
  /** Monotonic per-draft revision; older v1/v2 records start at revision zero. */
  revision?: number;
}

export type DraftSaveResult =
  | { status: "saved"; draft: MailDraft }
  | { status: "conflict"; draft: MailDraft }
  | { status: "unavailable" | "missing" };

/** Includes legacy content so an unversioned external write cannot bypass conflict checks. */
export function mailDraftVersion(draft: MailDraft): string {
  return JSON.stringify([
    draft.accountKey,
    draft.id,
    draft.revision ?? 0,
    draft.mode,
    draft.to,
    draft.cc,
    draft.bcc,
    draft.subject,
    draft.bodyText,
    draft.replyToMessageId ?? null,
    draft.internetMessageId ?? null,
    draft.updatedAt,
  ]);
}

export interface DraftReadResult {
  drafts: MailDraft[];
  status: "ok" | "corrupt" | "unavailable";
}

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "verto.mail.drafts.v1:";
const ATOMIC_STORAGE_KEY = "verto.mail.drafts.v2";
interface DraftEnvelope {
  version: number;
  accountKey: string;
  drafts: unknown[];
}
interface AtomicDrafts {
  version: 2;
  accounts: Record<string, DraftEnvelope>;
}
const MODES = new Set<DraftMode>(["compose", "reply", "replyAll", "forward"]);
let fallbackId = 0;

export function mailAccountKey(account: Pick<MailAccount, "provider" | "address">): string {
  return `${account.provider}:${account.address.trim().toLowerCase()}`;
}

function normalizedAccountKey(value: string): string | null {
  const key = value.trim().toLowerCase();
  const separator = key.indexOf(":");
  const provider = key.slice(0, separator);
  const address = key.slice(separator + 1);
  if (!/^[a-z][a-z0-9-]*$/.test(provider)) return null;
  try {
    const recipients = parseMailRecipients(address);
    return recipients.length === 1 && recipients[0] === address ? key : null;
  } catch {
    return null;
  }
}

function draftStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function atomicDrafts(storage: Storage): AtomicDrafts {
  const raw = storage.getItem(ATOMIC_STORAGE_KEY);
  if (raw === null) return { version: 2, accounts: {} };
  const value = JSON.parse(raw) as AtomicDrafts | null;
  if (
    !value ||
    value.version !== 2 ||
    !value.accounts ||
    typeof value.accounts !== "object" ||
    Array.isArray(value.accounts)
  )
    throw new SyntaxError("Saved draft storage is damaged.");
  return value;
}

type DraftStringFields = Pick<
  MailDraft,
  "id" | "to" | "cc" | "bcc" | "subject" | "bodyText" | "updatedAt"
>;

function hasDraftStrings(
  value: Record<string, unknown>
): value is Record<string, unknown> & DraftStringFields {
  return ["id", "to", "cc", "bcc", "subject", "bodyText", "updatedAt"].every(
    (field) => typeof value[field] === "string"
  );
}

function validDraftTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validatedDraft(value: unknown, accountKey: string): MailDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  if (
    !hasDraftStrings(draft) ||
    !draft.id.trim() ||
    draft.accountKey !== accountKey ||
    !MODES.has(draft.mode as DraftMode) ||
    !validDraftTimestamp(draft.updatedAt) ||
    (draft.replyToMessageId !== undefined && typeof draft.replyToMessageId !== "string") ||
    (draft.internetMessageId !== undefined && typeof draft.internetMessageId !== "string") ||
    (draft.revision !== undefined &&
      (!Number.isSafeInteger(draft.revision) || (draft.revision as number) < 0))
  ) {
    return null;
  }
  // Only draft content is serialized, even if a caller passes an object with extra fields.
  return {
    id: draft.id,
    accountKey,
    mode: draft.mode as DraftMode,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    bodyText: draft.bodyText,
    ...(draft.replyToMessageId !== undefined ? { replyToMessageId: draft.replyToMessageId } : {}),
    ...(draft.internetMessageId !== undefined
      ? { internetMessageId: draft.internetMessageId }
      : {}),
    updatedAt: draft.updatedAt,
    ...(draft.revision === undefined ? {} : { revision: draft.revision as number }),
  };
}

/** Returns storage health as well as drafts, so a UI can show a recoverable notice. */
export function readDraftsWithStatus(accountKey: string): DraftReadResult {
  const key = normalizedAccountKey(accountKey);
  if (!key) return { drafts: [], status: "corrupt" };
  try {
    const storage = draftStorage();
    if (!storage) return { drafts: [], status: "unavailable" };
    const canonical = atomicDrafts(storage);
    const raw = Object.hasOwn(canonical.accounts, key)
      ? undefined
      : storage.getItem(`${STORAGE_PREFIX}${encodeURIComponent(key)}`);
    if (raw === null) return { drafts: [], status: "ok" };
    const envelope = (raw === undefined ? canonical.accounts[key] : JSON.parse(raw)) as Record<
      string,
      unknown
    > | null;
    if (
      !envelope ||
      envelope.version !== STORAGE_VERSION ||
      envelope.accountKey !== key ||
      !Array.isArray(envelope.drafts)
    ) {
      return { drafts: [], status: "corrupt" };
    }
    let status: DraftReadResult["status"] = "ok";
    const ids = new Set<string>();
    const drafts: MailDraft[] = [];
    for (const value of envelope.drafts) {
      const draft = validatedDraft(value, key);
      if (!draft || ids.has(draft.id)) {
        status = "corrupt";
        continue;
      }
      ids.add(draft.id);
      drafts.push(draft);
    }
    drafts.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    return { drafts, status };
  } catch (error) {
    return { drafts: [], status: error instanceof SyntaxError ? "corrupt" : "unavailable" };
  }
}

export function readDrafts(accountKey: string): MailDraft[] {
  return readDraftsWithStatus(accountKey).drafts;
}

/** False means validation or browser storage failed; callers should keep their draft in memory. */
export function writeDrafts(accountKey: string, drafts: MailDraft[]): boolean {
  const key = normalizedAccountKey(accountKey);
  if (!key) return false;
  const values = drafts.map((draft) => validatedDraft(draft, key));
  if (
    values.some((value) => !value) ||
    new Set(values.map((value) => value?.id)).size !== values.length
  ) {
    return false;
  }
  try {
    const storage = draftStorage();
    if (!storage) return false;
    const canonical = atomicDrafts(storage);
    const envelope = { version: STORAGE_VERSION, accountKey: key, drafts: values };
    if (Object.hasOwn(canonical.accounts, key)) {
      canonical.accounts[key] = envelope;
      storage.setItem(ATOMIC_STORAGE_KEY, JSON.stringify(canonical));
    } else storage.setItem(`${STORAGE_PREFIX}${encodeURIComponent(key)}`, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

const COORDINATION_DATABASE = "verto.mail.draft-coordination";
const COORDINATION_STORE = "claims";
const draftListeners = new Set<() => void>();

export interface DraftDeliveryClaim {
  owner: string;
  leaseUntil: number;
  state: "pending" | "confirmed";
}

export function draftClaimKey(accountKey: string, id: string): string {
  return JSON.stringify([accountKey.trim().toLowerCase(), id]);
}

export function draftStorageRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** A readwrite transaction serializes localStorage mutations across tabs, including HTTP LAN tabs. */
export async function withDraftStorage<T>(
  operation: (claims: IDBObjectStore) => Promise<T>
): Promise<T> {
  if (typeof indexedDB === "undefined") throw new Error("Shared draft storage is unavailable.");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(COORDINATION_DATABASE, 1);
    let rejected = false;
    request.onupgradeneeded = () => request.result.createObjectStore(COORDINATION_STORE);
    request.onsuccess = () => {
      if (rejected) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      rejected = true;
      reject(new Error("Shared draft storage is blocked. Close other mail windows and retry."));
    };
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(COORDINATION_STORE, "readwrite");
      let result: T;
      let failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error("Draft storage failed."));
      operation(tx.objectStore(COORDINATION_STORE)).then(
        (value) => {
          result = value;
        },
        (error) => {
          failure = error;
          try {
            tx.abort();
          } catch {
            reject(error);
          }
        }
      );
    });
  } finally {
    db.close();
  }
}

export function notifyDraftChanges(): void {
  for (const listener of draftListeners) {
    try {
      listener();
    } catch {
      // A departed editor must not change the result of a saved mutation.
    }
  }
}

export function subscribeDraftChanges(listener: () => void): () => void {
  draftListeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === ATOMIC_STORAGE_KEY ||
      event.key?.startsWith(STORAGE_PREFIX)
    )
      listener();
  };
  if (typeof window !== "undefined") window.addEventListener?.("storage", changed);
  return () => {
    draftListeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener?.("storage", changed);
  };
}

async function editableDraft(claims: IDBObjectStore, accountKey: string, id: string) {
  const claim = await draftStorageRequest<DraftDeliveryClaim | undefined>(
    claims.get(draftClaimKey(accountKey, id))
  );
  return !claim || (claim.state === "pending" && claim.leaseUntil <= Date.now());
}

/** Upsert one identity into the current list; edits cannot resurrect a removed or sent draft. */
export async function saveMailDraftWithStatus(
  draft: MailDraft,
  options: { create?: boolean; expectedVersion?: string } = {}
): Promise<DraftSaveResult> {
  try {
    const result = await withDraftStorage<DraftSaveResult>(async (claims) => {
      if (!(await editableDraft(claims, draft.accountKey, draft.id)))
        return { status: "unavailable" };
      const current = readDraftsWithStatus(draft.accountKey);
      if (current.status !== "ok") return { status: "unavailable" };
      const previous = current.drafts.find((item) => item.id === draft.id);
      if (!previous && !options.create) return { status: "missing" };
      if (
        previous &&
        (options.create ||
          (options.expectedVersion !== undefined
            ? mailDraftVersion(previous) !== options.expectedVersion
            : (previous.revision ?? 0) !== (draft.revision ?? 0)))
      )
        return { status: "conflict", draft: previous };
      const revision = (previous?.revision ?? 0) + 1;
      if (!Number.isSafeInteger(revision)) return { status: "unavailable" };
      const saved = { ...draft, revision };
      return writeDrafts(draft.accountKey, [
        saved,
        ...current.drafts.filter((item) => item.id !== draft.id),
      ])
        ? { status: "saved", draft: saved }
        : { status: "unavailable" };
    });
    if (result.status === "saved") notifyDraftChanges();
    return result;
  } catch {
    return { status: "unavailable" };
  }
}

/** Boolean compatibility API; editors use the result API to retain their new baseline. */
export async function saveMailDraft(draft: MailDraft, create = false): Promise<boolean> {
  return (await saveMailDraftWithStatus(draft, { create })).status === "saved";
}

export async function removeMailDraft(
  accountKey: string,
  id: string,
  expectedVersion?: string
): Promise<boolean> {
  try {
    const saved = await withDraftStorage(async (claims) => {
      if (!(await editableDraft(claims, accountKey, id))) return false;
      const current = readDraftsWithStatus(accountKey);
      const previous = current.drafts.find((item) => item.id === id);
      if (
        expectedVersion !== undefined &&
        previous &&
        mailDraftVersion(previous) !== expectedVersion
      )
        return false;
      return (
        current.status === "ok" &&
        writeDrafts(
          accountKey,
          current.drafts.filter((item) => item.id !== id)
        )
      );
    });
    if (saved) notifyDraftChanges();
    return saved;
  } catch {
    return false;
  }
}

export async function moveMailDraft(
  draft: MailDraft,
  fromAccountKey: string,
  expectedVersion?: string
): Promise<boolean> {
  if (draft.accountKey.trim().toLowerCase() === fromAccountKey.trim().toLowerCase())
    return (await saveMailDraftWithStatus(draft, { expectedVersion })).status === "saved";
  try {
    const saved = await withDraftStorage(async (claims) => {
      if (
        !(await editableDraft(claims, fromAccountKey, draft.id)) ||
        !(await editableDraft(claims, draft.accountKey, draft.id))
      )
        return false;
      const old = readDraftsWithStatus(fromAccountKey);
      const target = readDraftsWithStatus(draft.accountKey);
      const previous = old.drafts.find((item) => item.id === draft.id);
      if (
        old.status !== "ok" ||
        target.status !== "ok" ||
        !previous ||
        target.drafts.some((item) => item.id === draft.id)
      )
        return false;
      if (
        expectedVersion !== undefined
          ? mailDraftVersion(previous) !== expectedVersion
          : (previous.revision ?? 0) !== (draft.revision ?? 0)
      )
        return false;
      const sourceKey = normalizedAccountKey(fromAccountKey);
      const targetKey = normalizedAccountKey(draft.accountKey);
      const copied =
        targetKey &&
        validatedDraft({ ...draft, revision: (previous.revision ?? 0) + 1 }, targetKey);
      const storage = draftStorage();
      if (!sourceKey || !targetKey || !copied || !storage) return false;
      const canonical = atomicDrafts(storage);
      canonical.accounts[sourceKey] = {
        version: STORAGE_VERSION,
        accountKey: sourceKey,
        drafts: old.drafts.filter((item) => item.id !== draft.id),
      };
      canonical.accounts[targetKey] = {
        version: STORAGE_VERSION,
        accountKey: targetKey,
        drafts: [copied, ...target.drafts.filter((item) => item.id !== draft.id)],
      };
      // One localStorage write commits both account lists. Empty source entries
      // deliberately prevent a stale legacy list from restoring the moved draft.
      storage.setItem(ATOMIC_STORAGE_KEY, JSON.stringify(canonical));
      for (const key of [sourceKey, targetKey]) {
        try {
          storage.removeItem(`${STORAGE_PREFIX}${encodeURIComponent(key)}`);
        } catch {
          /* Legacy rows are ignored after the canonical commit. */
        }
      }
      return true;
    });
    if (saved) notifyDraftChanges();
    return saved;
  } catch {
    return false;
  }
}

function recipients(headers: string[] | undefined): string[] {
  if (!headers?.length) return [];
  try {
    return parseMailRecipients(headers.join(", "));
  } catch {
    return headers.flatMap((header) => {
      try {
        return parseMailRecipients(header);
      } catch {
        return [];
      }
    });
  }
}

function prefixedSubject(subject: string, mode: DraftMode): string {
  if (mode === "reply" || mode === "replyAll") {
    return /^\s*re\s*:/i.test(subject) ? subject : `Re: ${subject}`;
  }
  return /^\s*(?:fw|fwd)\s*:/i.test(subject) ? subject : `Fwd: ${subject}`;
}

function quotedBody(message: MailMessage, mode: DraftMode): string {
  const parsedDate = new Date(message.receivedAt);
  const date = Number.isFinite(parsedDate.getTime())
    ? parsedDate.toUTCString()
    : message.receivedAt;
  if (mode === "forward") {
    return [
      "",
      "",
      "---------- Forwarded message ----------",
      `From: ${message.from}`,
      `Date: ${date}`,
      `Subject: ${message.subject}`,
      `To: ${message.to.join(", ")}`,
      ...(message.cc?.length ? [`Cc: ${message.cc.join(", ")}`] : []),
      "",
      message.bodyText,
    ].join("\n");
  }
  return `\n\nOn ${date}, ${message.from} wrote:\n${message.bodyText
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}`;
}

export function createDraft(
  mode: DraftMode,
  message?: MailMessage,
  account?: Pick<MailAccount, "provider" | "address">
): MailDraft {
  const id = globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}-${++fallbackId}`;
  const draft: MailDraft = {
    id,
    accountKey: account ? mailAccountKey(account) : "",
    mode,
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    bodyText: "",
    updatedAt: new Date().toISOString(),
  };
  if (mode === "compose" || !message) return draft;
  draft.subject = prefixedSubject(message.subject, mode);
  draft.bodyText = quotedBody(message, mode);
  if (mode === "forward") return draft;
  const replyTo = recipients(message.replyTo);
  const sender = recipients([message.from]);
  const primary = replyTo.length ? replyTo : sender;
  if (mode === "replyAll") {
    const self = account?.address.trim().toLowerCase();
    const to = [...new Set([...primary, ...recipients(message.to)])].filter(
      (address) => address !== self
    );
    const cc = [...new Set(recipients(message.cc))].filter(
      (address) => address !== self && !to.includes(address)
    );
    draft.to = to.join(", ");
    draft.cc = cc.join(", ");
  } else {
    draft.to = primary.join(", ");
  }
  draft.replyToMessageId = message.id;
  if (message.internetMessageId) draft.internetMessageId = message.internetMessageId;
  return draft;
}
