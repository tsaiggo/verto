import type { AccountInfo, PublicClientApplication } from "@azure/msal-browser";
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

const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Mail.Read", "User.Read"];

interface GraphAddress {
  emailAddress?: { address?: string; name?: string };
}
interface GraphMessage {
  id: string;
  subject?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  isRead?: boolean;
  hasAttachments?: boolean;
}

interface GraphFolder {
  id: string;
  displayName: string;
  unreadItemCount?: number;
  isHidden?: boolean;
  childFolderCount?: number;
}

interface GraphPage<T> {
  value?: T[];
  "@odata.nextLink"?: string;
}

function graphPageUrl(url: string): string {
  const parsed = new URL(url);
  if (
    parsed.origin !== "https://graph.microsoft.com" ||
    !parsed.pathname.startsWith("/v1.0/me/mailFolders")
  ) {
    throw new Error("Mail pagination link was invalid.");
  }
  return parsed.toString();
}

function address(value?: GraphAddress): string {
  return value?.emailAddress?.name || value?.emailAddress?.address || "";
}

export function graphMessageSummary(message: GraphMessage): MailMessageSummary {
  return {
    id: message.id,
    subject: message.subject ?? "",
    from: address(message.from),
    receivedAt: message.receivedDateTime ?? new Date(0).toISOString(),
    preview: message.bodyPreview ?? "",
    isRead: message.isRead ?? true,
    hasAttachments: message.hasAttachments ?? false,
  };
}

export function graphMessageDetail(message: GraphMessage): MailMessage {
  const content = message.body?.content ?? "";
  return {
    ...graphMessageSummary(message),
    to: (message.toRecipients ?? []).map(address).filter(Boolean),
    bodyText:
      message.body?.contentType?.toLowerCase() === "html" ? mailHtmlToText(content) : content,
  };
}

let clientPromise: Promise<PublicClientApplication> | null = null;

async function msalClient(): Promise<PublicClientApplication> {
  const clientId = process.env.NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("Outlook is not configured.");
  if (!clientPromise) {
    clientPromise = (async () => {
      const { PublicClientApplication } = await import("@azure/msal-browser");
      const client = new PublicClientApplication({
        auth: {
          clientId,
          authority: "https://login.microsoftonline.com/common",
          redirectUri: `${window.location.origin}/mail`,
          navigateToLoginRequestUrl: false,
        },
        cache: { cacheLocation: "sessionStorage" },
      });
      await client.initialize();
      const result = await client.handleRedirectPromise();
      if (result?.account) client.setActiveAccount(result.account);
      return client;
    })().catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

function currentAccount(client: PublicClientApplication): AccountInfo | null {
  return client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null;
}

async function graphToken(client: PublicClientApplication): Promise<string> {
  const account = currentAccount(client);
  if (!account) throw new Error("Outlook is not connected.");
  try {
    const result = await client.acquireTokenSilent({ account, scopes: SCOPES });
    return result.accessToken;
  } catch {
    throw new Error("Your Outlook session expired. Disconnect and connect again.");
  }
}

async function graphFolders(token: string): Promise<MailFolder[]> {
  const standard: Array<{ path: string; name: string; kind: MailFolder["kind"] }> = [
    { path: "inbox", name: "Inbox", kind: "inbox" },
    { path: "sentitems", name: "Sent", kind: "sent" },
    { path: "drafts", name: "Drafts", kind: "drafts" },
    { path: "archive", name: "Archive", kind: "archive" },
    { path: "deleteditems", name: "Trash", kind: "trash" },
  ];
  const standardResults = await Promise.allSettled(
    standard.map((folder) =>
      mailJson<GraphFolder>(
        `${GRAPH}/me/mailFolders/${folder.path}?$select=id,displayName,unreadItemCount`,
        token
      )
    )
  );
  const folders: MailFolder[] = standardResults.flatMap((result, index) =>
    result.status === "fulfilled"
      ? [
          {
            id: result.value.id,
            name: standard[index].name,
            kind: standard[index].kind,
            unreadCount: result.value.unreadItemCount,
          },
        ]
      : []
  );
  if (!folders.some((folder) => folder.kind === "inbox")) {
    throw new Error("Outlook inbox could not be loaded.");
  }

  const known = new Set(folders.map((folder) => folder.id));
  const select = "$select=id,displayName,unreadItemCount,isHidden,childFolderCount&$top=100";
  const pending = [{ url: `${GRAPH}/me/mailFolders?${select}`, parentName: "" }];
  while (pending.length) {
    const current = pending.shift();
    if (!current) break;
    const page: GraphPage<GraphFolder> = await mailJson<GraphPage<GraphFolder>>(
      graphPageUrl(current.url),
      token
    );
    for (const folder of page.value ?? []) {
      if (folder.isHidden) continue;
      const name = current.parentName
        ? `${current.parentName} / ${folder.displayName}`
        : folder.displayName;
      if (!known.has(folder.id)) {
        folders.push({
          id: folder.id,
          name,
          kind: "custom",
          unreadCount: folder.unreadItemCount,
        });
        known.add(folder.id);
      }
      if (folder.childFolderCount) {
        pending.push({
          url: `${GRAPH}/me/mailFolders/${encodeURIComponent(folder.id)}/childFolders?${select}`,
          parentName: name,
        });
      }
    }
    if (page["@odata.nextLink"]) {
      pending.push({ url: page["@odata.nextLink"], parentName: current.parentName });
    }
  }
  return folders;
}

export function createMicrosoftMailConnector(): MailConnector {
  return {
    id: "microsoft",
    label: "Outlook",
    isConfigured: () => Boolean(process.env.NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID),
    async connect() {
      const client = await msalClient();
      await client.loginRedirect({ scopes: SCOPES });
    },
    async restore(): Promise<MailConnection | null> {
      const client = await msalClient();
      const account = currentAccount(client);
      if (!account) return null;
      const token = await graphToken(client);
      const [profile, folders] = await Promise.all([
        mailJson<{ id: string; displayName?: string; mail?: string; userPrincipalName?: string }>(
          `${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`,
          token
        ),
        graphFolders(token),
      ]);
      const email = profile.mail || profile.userPrincipalName || account.username;
      return {
        account: {
          id: profile.id,
          address: email,
          displayName: profile.displayName || email,
          provider: "microsoft",
        },
        folders,
      };
    },
    async disconnect() {
      const client = await msalClient();
      const account = currentAccount(client);
      if (account) await client.clearCache({ account });
      client.setActiveAccount(null);
    },
    async listMessages(folderId, pageUrl): Promise<MailPage> {
      const token = await graphToken(await msalClient());
      const url = pageUrl
        ? graphPageUrl(pageUrl)
        : `${GRAPH}/me/mailFolders/${encodeURIComponent(folderId)}/messages?$select=id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments&$orderby=receivedDateTime%20desc&$top=30`;
      const page = await mailJson<GraphPage<GraphMessage>>(url, token);
      return {
        messages: (page.value ?? []).map(graphMessageSummary),
        nextPageUrl: page["@odata.nextLink"],
      };
    },
    async getMessage(id) {
      const token = await graphToken(await msalClient());
      const message = await mailJson<GraphMessage>(
        `${GRAPH}/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead,hasAttachments`,
        token,
        { Prefer: 'outlook.body-content-type="text"' }
      );
      return graphMessageDetail(message);
    },
  };
}
