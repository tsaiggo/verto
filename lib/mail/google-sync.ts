import type { GmailMessage } from "./google";
import { mailJson, MailRequestError } from "./http";
import type { MailMessage, MailSyncPage, MailSyncRequest } from "./model";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const PAGE_SIZE = 100;
const CONTINUATION_PREFIX = "gmail-sync:";

interface Continuation {
  folderId: string;
  mode: "full" | "history";
  historyId: string;
  pageToken: string;
}

interface GmailHistory {
  messages?: Array<{ id: string }>;
  messagesAdded?: Array<{ message: { id: string } }>;
  messagesDeleted?: Array<{ message: { id: string } }>;
  labelsAdded?: Array<{ message: { id: string } }>;
  labelsRemoved?: Array<{ message: { id: string } }>;
}

interface HistoryPage {
  history?: GmailHistory[];
  nextPageToken?: string;
  historyId?: string;
}

interface GmailSyncAccess {
  token: string;
  getMessage(id: string): Promise<GmailMessage>;
  detail(message: GmailMessage): MailMessage;
}

function historyChanges(records: GmailHistory[]): { ids: string[]; deleted: Set<string> } {
  const changed = new Set<string>();
  const deleted = new Set<string>();
  for (const record of records) {
    for (const message of record.messages ?? []) changed.add(message.id);
    for (const field of ["messagesAdded", "labelsAdded", "labelsRemoved"] as const) {
      for (const item of record[field] ?? []) changed.add(item.message.id);
    }
    for (const item of record.messagesDeleted ?? []) deleted.add(item.message.id);
  }
  return { ids: [...changed], deleted };
}

function historyId(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function historyCursor(page: HistoryPage): string | undefined {
  if (page.nextPageToken) return undefined;
  if (!historyId(page.historyId)) {
    throw new Error("Mail returned an unreadable sync response. Try again.");
  }
  return page.historyId;
}

function encodeContinuation(value: Continuation): string {
  return CONTINUATION_PREFIX + encodeURIComponent(JSON.stringify(value));
}

function decodeContinuation(value: string, folderId: string): Continuation {
  try {
    if (!value.startsWith(CONTINUATION_PREFIX)) throw new Error();
    const parsed = JSON.parse(decodeURIComponent(value.slice(CONTINUATION_PREFIX.length)));
    if (
      parsed.folderId !== folderId ||
      !["full", "history"].includes(parsed.mode) ||
      !historyId(parsed.historyId) ||
      typeof parsed.pageToken !== "string" ||
      !parsed.pageToken
    )
      throw new Error();
    return parsed as Continuation;
  } catch {
    throw new Error("Mail sync continuation was invalid.");
  }
}

// Batch detail requests so a large folder cannot open hundreds of requests at once.
async function details(
  ids: string[],
  folderId: string,
  access: GmailSyncAccess,
  deleted: Set<string> = new Set()
): Promise<{ messages: MailMessage[]; removedIds: string[] }> {
  const messages: MailMessage[] = [];
  const removedIds = new Set(deleted);
  const uniqueIds = [...new Set(ids)].filter((id) => !deleted.has(id));
  for (let offset = 0; offset < uniqueIds.length; offset += 4) {
    const batch = await Promise.all(
      uniqueIds.slice(offset, offset + 4).map(async (id) => {
        try {
          const message = await access.getMessage(id);
          return message.labelIds?.includes(folderId) ? access.detail(message) : id;
        } catch (error) {
          if (error instanceof MailRequestError && error.status === 404) return id;
          throw error;
        }
      })
    );
    for (const item of batch) {
      if (typeof item === "string") removedIds.add(item);
      else messages.push(item);
    }
  }
  return { messages, removedIds: [...removedIds] };
}

async function fullPage(
  folderId: string,
  access: GmailSyncAccess,
  continuation?: Continuation
): Promise<MailSyncPage> {
  // Capture the baseline first: changes during the snapshot are picked up by
  // the next history round, even when messages move between listing pages.
  const baseline =
    continuation?.historyId ??
    (await mailJson<{ historyId?: string }>(`${API}/profile`, access.token)).historyId;
  if (!historyId(baseline))
    throw new Error("Mail returned an unreadable sync response. Try again.");
  const params = new URLSearchParams({
    labelIds: folderId,
    maxResults: String(PAGE_SIZE),
    includeSpamTrash: "true",
  });
  if (continuation) params.set("pageToken", continuation.pageToken);
  const page = await mailJson<{
    messages?: Array<{ id: string }>;
    nextPageToken?: string;
  }>(`${API}/messages?${params}`, access.token);
  const result = await details(
    (page.messages ?? []).map((message) => message.id),
    folderId,
    access
  );
  return {
    ...result,
    ...(!continuation ? { reset: true } : {}),
    ...(page.nextPageToken
      ? {
          nextPageUrl: encodeContinuation({
            folderId,
            mode: "full",
            historyId: baseline,
            pageToken: page.nextPageToken,
          }),
        }
      : { cursor: baseline }),
  };
}

export async function syncGmailFolder(
  folderId: string,
  request: MailSyncRequest,
  access: GmailSyncAccess
): Promise<MailSyncPage> {
  const continuation = request.pageUrl ? decodeContinuation(request.pageUrl, folderId) : undefined;
  if (continuation?.mode === "full" || (!continuation && !request.cursor)) {
    return fullPage(folderId, access, continuation);
  }
  const startHistoryId = continuation?.historyId ?? request.cursor;
  if (!historyId(startHistoryId)) throw new Error("Mail sync cursor was invalid.");
  // Do not filter history by label: label removals must also remove cached membership.
  const params = new URLSearchParams({ startHistoryId, maxResults: String(PAGE_SIZE) });
  if (continuation) params.set("pageToken", continuation.pageToken);
  let page: HistoryPage;
  try {
    page = await mailJson<HistoryPage>(`${API}/history?${params}`, access.token);
  } catch (error) {
    if (error instanceof MailRequestError && error.status === 404)
      return fullPage(folderId, access);
    throw error;
  }
  const cursor = historyCursor(page);
  const changes = historyChanges(page.history ?? []);
  const result = await details(changes.ids, folderId, access, changes.deleted);
  return {
    ...result,
    ...(page.nextPageToken
      ? {
          nextPageUrl: encodeContinuation({
            folderId,
            mode: "history",
            historyId: startHistoryId,
            pageToken: page.nextPageToken,
          }),
        }
      : { cursor }),
  };
}
