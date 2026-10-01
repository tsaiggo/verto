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
}

export interface DraftReadResult {
  drafts: MailDraft[];
  status: "ok" | "corrupt" | "unavailable";
}

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "verto.mail.drafts.v1:";
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
    (draft.internetMessageId !== undefined && typeof draft.internetMessageId !== "string")
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
  };
}

/** Returns storage health as well as drafts, so a UI can show a recoverable notice. */
export function readDraftsWithStatus(accountKey: string): DraftReadResult {
  const key = normalizedAccountKey(accountKey);
  if (!key) return { drafts: [], status: "corrupt" };
  try {
    const storage = draftStorage();
    if (!storage) return { drafts: [], status: "unavailable" };
    const raw = storage.getItem(`${STORAGE_PREFIX}${encodeURIComponent(key)}`);
    if (raw === null) return { drafts: [], status: "ok" };
    const envelope = JSON.parse(raw) as Record<string, unknown> | null;
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
    storage.setItem(
      `${STORAGE_PREFIX}${encodeURIComponent(key)}`,
      JSON.stringify({ version: STORAGE_VERSION, accountKey: key, drafts: values })
    );
    return true;
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
