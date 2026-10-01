import type {
  MailAttachment,
  MailConnection,
  MailConnector,
  MailFolder,
  MailMessage,
  MailMessageSummary,
  MailPage,
} from "./model";
import { mailJson, mailPost } from "./http";
import { mailHtmlToText } from "./html";
import { decodeMailBase64, gmailRawMessage, validateMailOutgoing } from "./outgoing";
import { parseMailRecipients } from "./addresses";
import { authorizeGoogleMail, loadGoogleIdentity } from "./google-auth";
import { syncGmailFolder } from "./google-sync";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const PAGE_SIZE = 15;

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  partId?: string;
  filename?: string;
  mimeType?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  headers?: GmailHeader[];
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

function header(message: GmailMessage, name: string): string {
  return (
    message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function decodeBase64Url(value: string, contentType?: string): string {
  const bytes = decodeMailBase64(value);
  const charset = /charset\s*=\s*"?([^;"\s]+)/i.exec(contentType ?? "")?.[1];
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function partText(part: GmailPart | undefined, mimeType: string): string | null {
  if (!part) return null;
  if (
    part.filename ||
    part.headers?.some(
      (item) =>
        item.name.toLowerCase() === "content-disposition" && /^attachment\b/i.test(item.value)
    )
  )
    return null;
  if (part.filename || /^attachment\b/i.test(partHeader(part, "content-disposition"))) return null;
  if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) {
    const contentType = part.headers?.find(
      (item) => item.name.toLowerCase() === "content-type"
    )?.value;
    return decodeBase64Url(part.body.data, contentType);
  }
  for (const child of part.parts ?? []) {
    const text = partText(child, mimeType);
    if (text !== null) return text;
  }
  return null;
}

export function gmailMessageSummary(message: GmailMessage): MailMessageSummary {
  const timestamp = Number(message.internalDate);
  const date =
    Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp)
      : new Date(header(message, "Date"));
  return {
    id: message.id,
    subject: header(message, "Subject"),
    from: header(message, "From"),
    receivedAt: Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
    preview: message.snippet ?? "",
    isRead: !message.labelIds?.includes("UNREAD"),
    hasAttachments: hasAttachment(message.payload),
  };
}

function partHeader(part: GmailPart, name: string): string {
  return part.headers?.find((item) => item.name.toLowerCase() === name)?.value ?? "";
}

function isInlinePart(part: GmailPart): boolean {
  const disposition = partHeader(part, "content-disposition");
  const explicitlyAttached = /^attachment\b/i.test(disposition);
  return (
    /^inline\b/i.test(disposition) || Boolean(partHeader(part, "content-id") && !explicitlyAttached)
  );
}

function gmailAttachment(part: GmailPart, path: string): MailAttachment | null {
  if (isInlinePart(part)) return null;
  const explicitlyAttached = /^attachment\b/i.test(partHeader(part, "content-disposition"));
  const body = part.body;
  if (!body || (!body.attachmentId && body.data === undefined)) return null;
  const detachedFile = body.attachmentId && !/^text\/(plain|html)$/i.test(part.mimeType ?? "");
  if (!part.filename && !explicitlyAttached && !detachedFile) return null;
  return {
    id: body.attachmentId ?? `part:${part.partId ?? path}`,
    name: part.filename || "Attachment",
    mimeType: part.mimeType || "application/octet-stream",
    size: body.size ?? 0,
  };
}

function gmailAttachments(
  part?: GmailPart,
  path = "0"
): Array<{ attachment: MailAttachment; part: GmailPart }> {
  if (!part) return [];
  const attachment = gmailAttachment(part, path);
  return [
    ...(attachment ? [{ attachment, part }] : []),
    ...(part.parts ?? []).flatMap((child, index) => gmailAttachments(child, `${path}.${index}`)),
  ];
}

function hasAttachment(part?: GmailPart): boolean {
  return gmailAttachments(part).length > 0;
}

async function downloadGmailAttachment(
  messageId: string,
  attachment: MailAttachment,
  token: string
): Promise<Blob> {
  const message = await mailJson<GmailMessage>(
    `${API}/messages/${encodeURIComponent(messageId)}?format=full`,
    token
  );
  const item = gmailAttachments(message.payload).find(
    (item) => item.attachment.id === attachment.id
  );
  if (!item) throw new Error("This attachment is no longer available.");
  const data = item.part.body?.attachmentId
    ? (
        await mailJson<{ data?: string }>(
          `${API}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(item.part.body.attachmentId)}`,
          token
        )
      ).data
    : item.part.body?.data;
  if (data === undefined) throw new Error("This attachment could not be downloaded.");
  return new Blob([decodeMailBase64(data)], { type: item.attachment.mimeType });
}

export function gmailMessageDetail(message: GmailMessage): MailMessage {
  const html = partText(message.payload, "text/html");
  const addresses = (name: string) => {
    try {
      return parseMailRecipients(header(message, name));
    } catch {
      return [];
    }
  };
  const cc = addresses("Cc");
  const replyTo = addresses("Reply-To");
  const internetMessageId = header(message, "Message-ID");
  const attachments = gmailAttachments(message.payload).map((item) => item.attachment);
  return {
    ...gmailMessageSummary(message),
    to: addresses("To"),
    ...(cc.length ? { cc } : {}),
    ...(replyTo.length ? { replyTo } : {}),
    ...(internetMessageId ? { internetMessageId } : {}),
    ...(attachments.length ? { attachments } : {}),
    bodyText:
      partText(message.payload, "text/plain") ??
      (html ? mailHtmlToText(html) : null) ??
      message.snippet ??
      "",
  };
}

interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messagesUnread?: number;
}

function gmailFolders(labels: GmailLabel[]): MailFolder[] {
  const primary: Array<{ id: string; name: string; kind: MailFolder["kind"] }> = [
    { id: "INBOX", name: "Inbox", kind: "inbox" },
    { id: "SENT", name: "Sent", kind: "sent" },
    { id: "DRAFT", name: "Drafts", kind: "drafts" },
    { id: "TRASH", name: "Trash", kind: "trash" },
  ];
  const byId = new Map(labels.map((label) => [label.id, label]));
  return [
    ...primary.map((folder) => ({
      ...folder,
      unreadCount: byId.get(folder.id)?.messagesUnread,
    })),
    ...labels
      .filter((label) => label.type === "user")
      .map((label) => ({
        id: label.id,
        name: label.name,
        kind: "custom" as const,
        unreadCount: label.messagesUnread,
      })),
  ];
}

export function createGoogleMailConnector(
  options: {
    accountAddress?: string;
    selectAccount?: boolean;
  } = {}
): MailConnector {
  let token: string | null = null;
  let expiresAt = 0;
  let accountAddress: string | null = null;
  let sendingEnabled = false;
  let connectionVersion = 0;
  const clientId = process.env.NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID;

  function accessToken(): string {
    if (!token || Date.now() >= expiresAt) {
      token = null;
      sendingEnabled = false;
      throw new Error("Your Gmail session expired. Disconnect and connect again.");
    }
    return token;
  }

  return {
    id: "google",
    label: "Gmail",
    isConfigured: () => Boolean(clientId),
    async connect() {
      const version = ++connectionVersion;
      accountAddress = null;
      sendingEnabled = false;
      const result = await authorizeGoogleMail({
        clientId,
        scope: SCOPE,
        requiredScopes: [SCOPE],
        accountAddress: options.accountAddress,
        ...(options.selectAccount ? { prompt: "select_account" } : {}),
      });
      if (version !== connectionVersion) throw new Error("Gmail connection was cancelled.");
      token = result.token;
      expiresAt = result.expiresAt;
      accountAddress = null;
      sendingEnabled = false;
    },
    async restore(): Promise<MailConnection | null> {
      if (!token || Date.now() >= expiresAt) {
        token = null;
        sendingEnabled = false;
        // The consent popup must be requested directly from the later Connect click.
        if (clientId) await loadGoogleIdentity().catch(() => undefined);
        return null;
      }
      const version = connectionVersion;
      const activeToken = accessToken();
      const [profile, result] = await Promise.all([
        mailJson<{ emailAddress: string }>(`${API}/profile`, activeToken),
        mailJson<{ labels?: GmailLabel[] }>(`${API}/labels`, activeToken),
      ]);
      if (version !== connectionVersion) throw new Error("Gmail connection was cancelled.");
      if (
        options.accountAddress &&
        profile.emailAddress.toLowerCase() !== options.accountAddress.toLowerCase()
      )
        throw new Error("Reconnect with the Gmail account you selected.");
      accountAddress = profile.emailAddress;
      return {
        account: {
          id: profile.emailAddress,
          address: profile.emailAddress,
          displayName: profile.emailAddress,
          provider: "google",
        },
        folders: gmailFolders(result.labels ?? []),
      };
    },
    async disconnect() {
      connectionVersion += 1;
      const oldToken = token;
      token = null;
      expiresAt = 0;
      accountAddress = null;
      sendingEnabled = false;
      if (oldToken && window.google) {
        await new Promise<void>((resolve) =>
          window.google?.accounts.oauth2.revoke(oldToken, resolve)
        );
      }
    },
    async listMessages(folderId, pageToken): Promise<MailPage> {
      const params = new URLSearchParams({ labelIds: folderId, maxResults: String(PAGE_SIZE) });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await mailJson<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
        `${API}/messages?${params}`,
        accessToken()
      );
      const messages = await Promise.all(
        (page.messages ?? []).map((item) =>
          mailJson<GmailMessage>(
            `${API}/messages/${encodeURIComponent(item.id)}?format=full`,
            accessToken()
          ).then(gmailMessageSummary)
        )
      );
      return { messages, nextPageUrl: page.nextPageToken };
    },
    async getMessage(id) {
      const message = await mailJson<GmailMessage>(
        `${API}/messages/${encodeURIComponent(id)}?format=full`,
        accessToken()
      );
      return gmailMessageDetail(message);
    },
    async syncFolder(folderId, request = {}) {
      const activeToken = accessToken();
      return syncGmailFolder(folderId, request, {
        token: activeToken,
        getMessage: (id) =>
          mailJson<GmailMessage>(
            `${API}/messages/${encodeURIComponent(id)}?format=full`,
            activeToken
          ),
        detail: gmailMessageDetail,
      });
    },
    async enableSending() {
      const version = connectionVersion;
      sendingEnabled = false;
      const oldToken = accessToken();
      const connectedAddress = accountAddress;
      const result = await authorizeGoogleMail({
        clientId,
        scope: SEND_SCOPE,
        requiredScopes: [SCOPE, SEND_SCOPE],
        accountAddress,
        prompt: "consent",
      });
      const profile = await mailJson<{ emailAddress: string }>(`${API}/profile`, result.token);
      const original =
        connectedAddress ??
        (await mailJson<{ emailAddress: string }>(`${API}/profile`, oldToken)).emailAddress;
      if (profile.emailAddress.toLowerCase() !== original.toLowerCase()) {
        throw new Error("Enable sending with the Gmail account you already connected.");
      }
      if (version !== connectionVersion) throw new Error("Gmail connection was cancelled.");
      token = result.token;
      expiresAt = result.expiresAt;
      accountAddress = profile.emailAddress;
      sendingEnabled = true;
    },
    async sendMessage(message) {
      const outgoing = validateMailOutgoing(message);
      const version = connectionVersion;
      const activeToken = accessToken();
      if (!sendingEnabled || !accountAddress)
        throw new Error("Enable Gmail sending before sending a message.");
      let threadId: string | undefined;
      let references: string | undefined;
      if (outgoing.replyToMessageId) {
        const original = await mailJson<GmailMessage>(
          `${API}/messages/${encodeURIComponent(outgoing.replyToMessageId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Subject`,
          activeToken
        );
        threadId = original.threadId;
        outgoing.internetMessageId = header(original, "Message-ID") || outgoing.internetMessageId;
        references = header(original, "References");
        validateMailOutgoing(outgoing);
      }
      if (version !== connectionVersion || !sendingEnabled)
        throw new Error("Gmail connection was cancelled.");
      await mailPost(`${API}/messages/send`, activeToken, {
        raw: gmailRawMessage(outgoing, accountAddress, references),
        ...(threadId ? { threadId } : {}),
      });
    },
    async getAttachment(messageId, attachment) {
      return downloadGmailAttachment(messageId, attachment, accessToken());
    },
  };
}
