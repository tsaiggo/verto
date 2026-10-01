import { mailJson, MailRequestError } from "./http";
import type { MailMessage, MailSyncPage, MailSyncRequest } from "./model";

const GRAPH = "https://graph.microsoft.com/v1.0";
const SELECT =
  "id,subject,from,toRecipients,ccRecipients,replyTo,internetMessageId,receivedDateTime,bodyPreview,body,isRead,hasAttachments";

interface DeltaMessage {
  id: string;
  "@removed"?: { reason?: string };
}

interface DeltaPage {
  value?: DeltaMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

export function graphSyncPageUrl(url: string, folderId: string): string {
  try {
    const parsed = new URL(url);
    // Graph can return slash paths or OData key syntax in its opaque state links.
    const path =
      /^\/v1\.0\/me\/mailFolders(?:\/([^/]+)|\('((?:[^']|'')+)'\))\/messages\/delta\/?$/i.exec(
        parsed.pathname
      );
    const linkedFolder =
      path &&
      (path[1] ? decodeURIComponent(path[1]) : decodeURIComponent(path[2]).replace(/''/g, "'"));
    if (
      parsed.origin !== "https://graph.microsoft.com" ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      linkedFolder !== folderId
    )
      throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("Mail sync continuation was invalid.");
  }
}

async function completePage(
  folderId: string,
  page: DeltaPage,
  reset: boolean,
  getMessage: (id: string) => Promise<MailMessage>
): Promise<MailSyncPage> {
  const next = page["@odata.nextLink"];
  const cursor = page["@odata.deltaLink"];
  if ((!next && !cursor) || (next && cursor)) {
    throw new Error("Mail returned an unreadable sync response. Try again.");
  }
  // Validate returned links before the caller can persist them for another round.
  if (next) graphSyncPageUrl(next, folderId);
  if (cursor) graphSyncPageUrl(cursor, folderId);

  const messages: MailMessage[] = [];
  const removedIds: string[] = [];
  // Replays can repeat an ID on one page. Preserve the last action for that ID.
  const items = [...new Map((page.value ?? []).map((item) => [item.id, item])).values()];
  for (let offset = 0; offset < items.length; offset += 4) {
    const batch = await Promise.all(
      items.slice(offset, offset + 4).map(async (item) => {
        if (item["@removed"]) return item.id;
        try {
          // Delta updates can contain only changed properties. The normal detail
          // path keeps full body text and the complete downloadable attachment list.
          return await getMessage(item.id);
        } catch (error) {
          if (error instanceof MailRequestError && error.status === 404) return item.id;
          throw error;
        }
      })
    );
    for (const item of batch) {
      if (typeof item === "string") removedIds.push(item);
      else messages.push(item);
    }
  }
  return {
    messages,
    removedIds,
    ...(reset ? { reset: true } : {}),
    ...(next ? { nextPageUrl: next } : { cursor }),
  };
}

export async function syncMicrosoftFolder(
  folderId: string,
  request: MailSyncRequest,
  token: string,
  getMessage: (id: string) => Promise<MailMessage>
): Promise<MailSyncPage> {
  const initialUrl = `${GRAPH}/me/mailFolders/${encodeURIComponent(folderId)}/messages/delta?$select=${SELECT}`;
  const savedUrl = request.pageUrl ?? request.cursor;
  const url = savedUrl ? graphSyncPageUrl(savedUrl, folderId) : initialUrl;
  const headers = { Prefer: 'outlook.body-content-type="text", odata.maxpagesize=100' };
  let page: DeltaPage;
  let reset = !savedUrl;
  try {
    page = await mailJson<DeltaPage>(url, token, headers);
  } catch (error) {
    if (
      savedUrl &&
      error instanceof MailRequestError &&
      (error.status === 410 || error.code?.toLowerCase() === "syncstatenotfound")
    ) {
      // Start from our known endpoint rather than trusting an error Location URL.
      // A failure of this replacement request propagates; it is never retried recursively.
      page = await mailJson<DeltaPage>(initialUrl, token, headers);
      reset = true;
    } else {
      throw error;
    }
  }
  return completePage(folderId, page, reset, getMessage);
}
