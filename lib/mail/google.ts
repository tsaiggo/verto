import type {
  MailConnection,
  MailConnector,
  MailFolder,
  MailMessage,
  MailMessageSummary,
  MailPage,
} from "./model";
import { mailJson } from "./http";
import { mailHtmlToText } from "./html";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const PAGE_SIZE = 15;

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback: (error: { type: string }) => void;
      }): GoogleTokenClient;
      revoke(token: string, callback: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string; attachmentId?: string };
  headers?: GmailHeader[];
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

let scriptPromise: Promise<GoogleIdentity> | null = null;

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  const promise = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google sign-in did not load."));
    };
    script.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  scriptPromise = promise;
  return promise;
}

function header(message: GmailMessage, name: string): string {
  return (
    message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

function decodeBase64Url(value: string, contentType?: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const charset = /charset\s*=\s*"?([^;"\s]+)/i.exec(contentType ?? "")?.[1];
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function partText(part: GmailPart | undefined, mimeType: string): string | null {
  if (!part) return null;
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

function hasAttachment(part?: GmailPart): boolean {
  return Boolean(part?.body?.attachmentId || part?.parts?.some(hasAttachment));
}

export function gmailMessageDetail(message: GmailMessage): MailMessage {
  const html = partText(message.payload, "text/html");
  return {
    ...gmailMessageSummary(message),
    to: header(message, "To")
      .split(/,(?=\s*[^,]+@)/)
      .map((address) => address.trim())
      .filter(Boolean),
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

export function createGoogleMailConnector(): MailConnector {
  let token: string | null = null;
  let expiresAt = 0;
  const clientId = process.env.NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID;

  function accessToken(): string {
    if (!token || Date.now() >= expiresAt) {
      token = null;
      throw new Error("Your Gmail session expired. Disconnect and connect again.");
    }
    return token;
  }

  return {
    id: "google",
    label: "Gmail",
    isConfigured: () => Boolean(clientId),
    async connect() {
      if (!clientId) throw new Error("Gmail is not configured.");
      const google = await loadGoogleIdentity();
      await new Promise<void>((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback(response) {
            if (!response.access_token || !response.scope?.split(" ").includes(SCOPE)) {
              reject(new Error(response.error ?? "Gmail read permission was not granted."));
              return;
            }
            token = response.access_token;
            expiresAt = Date.now() + Math.max(0, (response.expires_in ?? 3600) - 60) * 1000;
            resolve();
          },
          error_callback(error) {
            reject(new Error(`Google sign-in failed: ${error.type}.`));
          },
        });
        client.requestAccessToken();
      });
    },
    async restore(): Promise<MailConnection | null> {
      if (!token || Date.now() >= expiresAt) {
        token = null;
        // The consent popup must be requested directly from the later Connect click.
        if (clientId) await loadGoogleIdentity().catch(() => undefined);
        return null;
      }
      const [profile, result] = await Promise.all([
        mailJson<{ emailAddress: string }>(`${API}/profile`, accessToken()),
        mailJson<{ labels?: GmailLabel[] }>(`${API}/labels`, accessToken()),
      ]);
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
      const oldToken = token;
      token = null;
      expiresAt = 0;
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
            `${API}/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
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
  };
}
