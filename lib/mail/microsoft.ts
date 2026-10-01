import type { AccountInfo, PublicClientApplication } from "@azure/msal-browser";
import type {
  MailAttachment,
  MailAccount,
  MailConnection,
  MailConnector,
  MailFolder,
  MailMessage,
  MailMessageSummary,
  MailPage,
  MailMessageAction,
} from "./model";
import { mailBlob, mailJson, mailPost, mailMutationJson } from "./http";
import { mailHtmlToText } from "./html";
import { validateMailOutgoing } from "./outgoing";
import { graphSyncPageUrl, syncMicrosoftFolder } from "./microsoft-sync";

const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Mail.Read", "User.Read"];
const SEND_SCOPES = ["Mail.Send"];
const UPDATE_SCOPES = ["Mail.ReadWrite"];

interface GraphAddress {
  emailAddress?: { address?: string; name?: string };
}
interface GraphMessage {
  id: string;
  subject?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  replyTo?: GraphAddress[];
  internetMessageId?: string;
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  isRead?: boolean;
  hasAttachments?: boolean;
  flag?: { flagStatus?: string };
  parentFolderId?: string;
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

interface GraphAttachment {
  id: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  "@odata.type"?: string;
}

function graphPageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.origin !== "https://graph.microsoft.com" ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      !/^\/v1\.0\/me\/mailFolders(?:(?:\/[^/]+|\('(?:[^']|'')+'\))\/childFolders)?\/?$/i.test(
        parsed.pathname
      )
    )
      throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("Mail pagination link was invalid.");
  }
}

function graphMessagesPageUrl(url: string, folderId: string): string {
  try {
    const parsed = new URL(url);
    const path = /^\/v1\.0\/me\/mailFolders(?:\/([^/]+)|\('((?:[^']|'')+)'\))\/messages\/?$/i.exec(
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
    throw new Error("Mail pagination link was invalid.");
  }
}

function address(value?: GraphAddress): string {
  const email = value?.emailAddress?.address;
  const name = value?.emailAddress?.name?.replace(/[\r\n]/g, " ");
  const display = name && /[",;<>\\]/.test(name) ? `"${name.replace(/["\\]/g, "\\$&")}"` : name;
  return email ? (display && name !== email ? `${display} <${email}>` : email) : name || "";
}

export function graphMessageSummary(message: GraphMessage): MailMessageSummary {
  return {
    id: message.id,
    subject: message.subject ?? "",
    from: address(message.from),
    receivedAt: message.receivedDateTime ?? new Date(0).toISOString(),
    preview: message.bodyPreview ?? "",
    isRead: message.isRead ?? true,
    isStarred: message.flag?.flagStatus === "flagged",
    hasAttachments: message.hasAttachments ?? false,
  };
}

export function graphMessageDetail(message: GraphMessage): MailMessage {
  const content = message.body?.content ?? "";
  const cc = (message.ccRecipients ?? []).map(address).filter(Boolean);
  const replyTo = (message.replyTo ?? []).map(address).filter(Boolean);
  return {
    ...graphMessageSummary(message),
    to: (message.toRecipients ?? []).map(address).filter(Boolean),
    ...(cc.length ? { cc } : {}),
    ...(replyTo.length ? { replyTo } : {}),
    ...(message.internetMessageId ? { internetMessageId: message.internetMessageId } : {}),
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
    })().catch(() => {
      clientPromise = null;
      throw new Error("Outlook sign-in could not be initialized. Try connecting again.");
    });
  }
  return clientPromise;
}

function currentAccount(client: PublicClientApplication): AccountInfo | null {
  return client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null;
}

function hasScopes(granted: string[], requested: string[]): boolean {
  const names = new Set(granted.map((scope) => scope.split("/").pop()?.toLowerCase()));
  return requested.every((scope) => names.has(scope.toLowerCase()));
}

function requiresMicrosoftInteraction(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const details = error as { name?: unknown; errorCode?: unknown };
  return (
    details.name === "InteractionRequiredAuthError" ||
    [
      "interaction_required",
      "login_required",
      "consent_required",
      "no_account_error",
      "no_tokens_found",
    ].includes(typeof details.errorCode === "string" ? details.errorCode : "")
  );
}

async function graphToken(
  client: PublicClientApplication,
  account: AccountInfo | null,
  scopes = SCOPES
): Promise<string> {
  if (!account) throw new Error("Outlook is not connected.");
  let result;
  try {
    result = await client.acquireTokenSilent({ account, scopes });
  } catch (error) {
    if (requiresMicrosoftInteraction(error))
      throw new Error("Your Outlook session expired. Reconnect to continue.");
    throw new Error("Outlook sign-in could not be reached. Check your connection and try again.");
  }
  if (!result.accessToken || !hasScopes(result.scopes ?? [], scopes)) {
    throw new Error(
      scopes === SEND_SCOPES
        ? "Outlook send permission was not granted."
        : scopes === UPDATE_SCOPES
          ? "Outlook update permission was not granted."
          : "Outlook read permission was not granted."
    );
  }
  if (result.account && result.account.homeAccountId !== account.homeAccountId) {
    throw new Error("The Outlook account changed. Reconnect to continue.");
  }
  return result.accessToken;
}

function graphAttachment(value: GraphAttachment): MailAttachment | null {
  if (
    value.isInline ||
    !["#microsoft.graph.fileAttachment", "#microsoft.graph.itemAttachment"].includes(
      value["@odata.type"] ?? ""
    )
  )
    return null;
  return {
    id: value.id,
    name: value.name || "Attachment",
    mimeType:
      value.contentType ||
      (value["@odata.type"] === "#microsoft.graph.itemAttachment"
        ? "message/rfc822"
        : "application/octet-stream"),
    size: value.size ?? 0,
  };
}

async function graphAttachments(messageId: string, token: string): Promise<MailAttachment[]> {
  const path = `/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments`;
  let next: string | undefined =
    `${GRAPH}/me/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size,isInline`;
  const attachments: MailAttachment[] = [];
  while (next) {
    const parsed = new URL(next);
    if (
      parsed.origin !== "https://graph.microsoft.com" ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      parsed.pathname !== path
    )
      throw new Error("Mail attachment pagination link was invalid.");
    const page: GraphPage<GraphAttachment> = await mailJson<GraphPage<GraphAttachment>>(
      parsed.toString(),
      token
    );
    attachments.push(
      ...(page.value ?? []).flatMap((value) => {
        const attachment = graphAttachment(value);
        return attachment ? [attachment] : [];
      })
    );
    next = page["@odata.nextLink"];
  }
  return attachments;
}

async function graphRawMessage(id: string, token: string): Promise<GraphMessage> {
  return mailJson<GraphMessage>(
    `${GRAPH}/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,toRecipients,ccRecipients,replyTo,internetMessageId,receivedDateTime,bodyPreview,body,isRead,hasAttachments,flag,parentFolderId`,
    token,
    { Prefer: 'outlook.body-content-type="text"' }
  );
}

async function graphFullDetail(message: GraphMessage, token: string): Promise<MailMessage> {
  const attachments = message.hasAttachments ? await graphAttachments(message.id, token) : [];
  return { ...graphMessageDetail(message), ...(attachments.length ? { attachments } : {}) };
}

async function graphMessage(id: string, token: string): Promise<MailMessage> {
  return graphFullDetail(await graphRawMessage(id, token), token);
}

function graphMutation(action: MailMessageAction): {
  method: "POST" | "PATCH";
  suffix: string;
  body: unknown;
} {
  if (action.type === "archive" || action.type === "trash")
    return {
      method: "POST",
      suffix: "/move",
      body: { destinationId: action.type === "archive" ? "archive" : "deleteditems" },
    };
  if ((action.type === "read" || action.type === "star") && typeof action.value === "boolean")
    return {
      method: "PATCH",
      suffix: "",
      body:
        action.type === "read"
          ? { isRead: action.value }
          : { flag: { flagStatus: action.value ? "flagged" : "notFlagged" } },
    };
  throw new Error("This mail action is invalid.");
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

export async function getCachedMicrosoftMailConnectors(): Promise<
  Array<MailConnector & { account: MailAccount }>
> {
  const client = await msalClient();
  return client.getAllAccounts().map((account) =>
    Object.assign(createMicrosoftMailConnector({ accountId: account.homeAccountId }), {
      account: {
        id: account.homeAccountId,
        address: account.username,
        displayName: account.name || account.username,
        provider: "microsoft" as const,
      },
    })
  );
}

export function createMicrosoftMailConnector(
  options: {
    accountId?: string;
    accountAddress?: string;
    selectAccount?: boolean;
  } = {}
): MailConnector {
  let sendingAccountId: string | null = null;
  let updatingAccountId: string | null = null;
  let connectionVersion = 0;
  let boundAccount: AccountInfo | null = null;
  let disconnected = false;

  function mailboxAccount(client: PublicClientApplication): AccountInfo | null {
    if (disconnected) return null;
    if (!boundAccount) {
      boundAccount = options.accountId
        ? (client.getAllAccounts().find((account) => account.homeAccountId === options.accountId) ??
          null)
        : options.accountAddress
          ? (client
              .getAllAccounts()
              .find(
                (account) =>
                  account.username.toLowerCase() === options.accountAddress!.toLowerCase()
              ) ?? null)
          : currentAccount(client);
    }
    return boundAccount;
  }

  return {
    id: "microsoft",
    label: "Outlook",
    isConfigured: () => Boolean(process.env.NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID),
    async connect() {
      const version = ++connectionVersion;
      sendingAccountId = null;
      updatingAccountId = null;
      const client = await msalClient();
      try {
        if (options.selectAccount) {
          const result = await client.loginPopup({ scopes: SCOPES, prompt: "select_account" });
          if (version !== connectionVersion) throw new Error("Outlook connection was cancelled.");
          if (!result.account) throw new Error("Outlook sign-in did not return an account.");
          if (
            options.accountAddress &&
            result.account.username.toLowerCase() !== options.accountAddress.toLowerCase()
          )
            throw new Error("Reconnect with the Outlook account you selected.");
          boundAccount = result.account;
          disconnected = false;
        } else {
          disconnected = false;
          await client.loginRedirect({ scopes: SCOPES });
        }
      } catch {
        throw new Error("Outlook sign-in was cancelled or could not be completed.");
      }
    },
    async restore(): Promise<MailConnection | null> {
      const client = await msalClient();
      const version = connectionVersion;
      const account = mailboxAccount(client);
      if (!account) return null;
      const token = await graphToken(client, account);
      const [profile, folders] = await Promise.all([
        mailJson<{ id: string; displayName?: string; mail?: string; userPrincipalName?: string }>(
          `${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`,
          token
        ),
        graphFolders(token),
      ]);
      if (version !== connectionVersion) throw new Error("Outlook connection was cancelled.");
      const email = profile.mail || profile.userPrincipalName || account.username;
      return {
        account: {
          id: account.homeAccountId,
          address: email,
          displayName: profile.displayName || email,
          provider: "microsoft",
        },
        folders,
      };
    },
    async disconnect() {
      connectionVersion += 1;
      sendingAccountId = null;
      updatingAccountId = null;
      const client = await msalClient();
      const account = mailboxAccount(client);
      disconnected = true;
      if (account) await client.clearCache({ account });
      if (account && client.getActiveAccount()?.homeAccountId === account.homeAccountId)
        client.setActiveAccount(null);
    },
    async listMessages(folderId, pageUrl): Promise<MailPage> {
      const continuation = pageUrl ? graphMessagesPageUrl(pageUrl, folderId) : undefined;
      const client = await msalClient();
      const token = await graphToken(client, mailboxAccount(client));
      const url = continuation
        ? continuation
        : `${GRAPH}/me/mailFolders/${encodeURIComponent(folderId)}/messages?$select=id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments,flag&$orderby=receivedDateTime%20desc&$top=30`;
      const page = await mailJson<GraphPage<GraphMessage>>(url, token);
      const next = page["@odata.nextLink"];
      if (next) graphMessagesPageUrl(next, folderId);
      return {
        messages: (page.value ?? []).map(graphMessageSummary),
        nextPageUrl: next,
      };
    },
    async getMessage(id) {
      const client = await msalClient();
      const token = await graphToken(client, mailboxAccount(client));
      return graphMessage(id, token);
    },
    async syncFolder(folderId, request = {}) {
      // Reject a persisted continuation before acquiring an access token.
      const continuation = request.pageUrl ?? request.cursor;
      if (continuation) graphSyncPageUrl(continuation, folderId);
      const client = await msalClient();
      const token = await graphToken(client, mailboxAccount(client));
      return syncMicrosoftFolder(folderId, request, token, async (id) => {
        const raw = await graphRawMessage(id, token);
        if (!raw.parentFolderId)
          throw new Error("Mail returned an unreadable sync response. Try again.");
        return raw.parentFolderId === folderId ? graphFullDetail(raw, token) : null;
      });
    },
    async enableSending() {
      const version = connectionVersion;
      const client = await msalClient();
      const account = mailboxAccount(client);
      if (!account) throw new Error("Outlook is not connected.");
      let result;
      try {
        result = await client.acquireTokenPopup({
          account,
          scopes: SEND_SCOPES,
          prompt: "consent",
        });
      } catch {
        throw new Error("Outlook send permission was cancelled or could not be granted.");
      }
      if (!result.accessToken || !hasScopes(result.scopes ?? [], SEND_SCOPES))
        throw new Error("Outlook send permission was not granted.");
      if (!result.account || result.account.homeAccountId !== account.homeAccountId)
        throw new Error("Enable sending with the Outlook account you already connected.");
      if (
        version !== connectionVersion ||
        mailboxAccount(client)?.homeAccountId !== account.homeAccountId
      )
        throw new Error("Outlook connection was cancelled.");
      sendingAccountId = account.homeAccountId;
    },
    async enableUpdating() {
      const version = connectionVersion;
      const client = await msalClient();
      const account = mailboxAccount(client);
      if (!account) throw new Error("Outlook is not connected.");
      if (updatingAccountId === account.homeAccountId) return;
      let result;
      try {
        result = await client.acquireTokenPopup({
          account,
          scopes: UPDATE_SCOPES,
          prompt: "consent",
        });
      } catch {
        throw new Error("Outlook update permission was cancelled or could not be granted.");
      }
      if (!result.accessToken || !hasScopes(result.scopes ?? [], UPDATE_SCOPES))
        throw new Error("Outlook update permission was not granted.");
      if (!result.account || result.account.homeAccountId !== account.homeAccountId)
        throw new Error("Enable updating with the Outlook account you already connected.");
      if (
        version !== connectionVersion ||
        mailboxAccount(client)?.homeAccountId !== account.homeAccountId
      )
        throw new Error("Outlook connection was cancelled.");
      updatingAccountId = account.homeAccountId;
    },
    async mutateMessage(id, action) {
      const operation = graphMutation(action);
      if (!id.trim()) throw new Error("This message does not identify its mailbox.");
      const version = connectionVersion;
      const client = await msalClient();
      const account = mailboxAccount(client);
      if (!updatingAccountId || updatingAccountId !== account?.homeAccountId)
        throw new Error("Enable Outlook updating before changing a message.");
      const token = await graphToken(client, account, UPDATE_SCOPES);
      if (
        version !== connectionVersion ||
        updatingAccountId !== mailboxAccount(client)?.homeAccountId
      )
        throw new Error("Outlook connection was cancelled.");
      const changed = await mailMutationJson<GraphMessage>(
        `${GRAPH}/me/messages/${encodeURIComponent(id)}${operation.suffix}`,
        token,
        operation.method,
        operation.body
      );
      if (!changed.id)
        throw new Error("Mail returned an unreadable update. Sync this folder again.");
      const raw = await graphRawMessage(changed.id, token);
      if (!raw.parentFolderId)
        throw new Error("Mail returned an unreadable update. Sync this folder again.");
      const message = await graphFullDetail(raw, token);
      if (version !== connectionVersion) throw new Error("Outlook connection was cancelled.");
      return { message, folderIds: [raw.parentFolderId] };
    },
    async sendMessage(message) {
      const outgoing = validateMailOutgoing(message);
      const version = connectionVersion;
      const client = await msalClient();
      if (!sendingAccountId || sendingAccountId !== mailboxAccount(client)?.homeAccountId)
        throw new Error("Enable Outlook sending before sending a message.");
      const token = await graphToken(client, mailboxAccount(client), SEND_SCOPES);
      if (
        version !== connectionVersion ||
        sendingAccountId !== mailboxAccount(client)?.homeAccountId
      )
        throw new Error("Outlook connection was cancelled.");
      const recipients = (values: string[]) =>
        values.map((address) => ({ emailAddress: { address } }));
      const body = {
        message: {
          subject: outgoing.subject,
          body: { contentType: "Text", content: outgoing.bodyText },
          toRecipients: recipients(outgoing.to),
          ccRecipients: recipients(outgoing.cc),
          bccRecipients: recipients(outgoing.bcc),
        },
      };
      const url = outgoing.replyToMessageId
        ? `${GRAPH}/me/messages/${encodeURIComponent(outgoing.replyToMessageId)}/reply`
        : `${GRAPH}/me/sendMail`;
      await mailPost(
        url,
        token,
        outgoing.replyToMessageId ? body : { ...body, saveToSentItems: true }
      );
    },
    async getAttachment(messageId, attachment) {
      const client = await msalClient();
      const token = await graphToken(client, mailboxAccount(client));
      const url = `${GRAPH}/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`;
      const detail = await mailJson<GraphAttachment>(url, token);
      if (!graphAttachment(detail))
        throw new Error("This attachment cannot be downloaded as a file.");
      return mailBlob(`${url}/$value`, token);
    },
  };
}
