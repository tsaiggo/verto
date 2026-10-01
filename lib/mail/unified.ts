import type { MailConnection, MailConnector, MailMessageSummary, MailPage } from "./model";

export interface MailAccountBinding {
  id: string;
  connector: MailConnector;
  connection: MailConnection;
  status?: "connected" | "error";
  message?: string;
}

export function scopedMailId(accountId: string, messageId: string): string {
  return JSON.stringify([accountId, messageId]);
}

function readScopedId(id: string): [string, string] {
  try {
    const value: unknown = JSON.parse(id);
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((part) => typeof part === "string")
    )
      return value as [string, string];
  } catch {
    // Reject an unscoped provider ID instead of guessing which mailbox owns it.
  }
  throw new Error("This message does not identify its mailbox. Open it from the inbox again.");
}

export function unifiedMailConnection(accounts: MailAccountBinding[]): MailConnection {
  return {
    account: {
      id: "all",
      address: "All accounts",
      displayName: "All inboxes",
      provider: accounts[0]?.connection.account.provider ?? "google",
    },
    folders: [
      {
        id: "INBOX",
        name: "All inboxes",
        kind: "inbox",
        unreadCount: accounts.every(
          (entry) =>
            entry.status !== "error" &&
            typeof entry.connection.folders.find((folder) => folder.kind === "inbox")
              ?.unreadCount === "number"
        )
          ? accounts.reduce(
              (total, account) =>
                total +
                (account.connection.folders.find((folder) => folder.kind === "inbox")
                  ?.unreadCount ?? 0),
              0
            )
          : undefined,
      },
    ],
  };
}

export function sortMailMessages(messages: MailMessageSummary[]): MailMessageSummary[] {
  return messages.sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt) || a.id.localeCompare(b.id)
  );
}

/** Read-only aggregation. Composition always uses the owning account's connector. */
export function createUnifiedMailConnector(accounts: MailAccountBinding[]): MailConnector {
  function owner(id: string) {
    const [accountId, messageId] = readScopedId(id);
    const account = accounts.find((item) => item.id === accountId);
    if (!account || account.status === "error")
      throw new Error("This mailbox is unavailable. Reconnect it from Manage accounts.");
    return { account, messageId };
  }
  return {
    id: accounts[0]?.connector.id ?? "google",
    label: "All inboxes",
    isConfigured: () => accounts.length > 0,
    connect: async () => {
      throw new Error("Choose an account to connect.");
    },
    restore: async () => unifiedMailConnection(accounts),
    disconnect: async () => {
      throw new Error("Choose an account to disconnect.");
    },
    async listMessages(_folderId, pageUrl) {
      let cursors: Record<string, string> | undefined;
      if (pageUrl) {
        try {
          const parsed: unknown = JSON.parse(pageUrl);
          if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed) ||
            !Object.keys(parsed).length ||
            Object.entries(parsed).some(
              ([id, value]) =>
                !accounts.some((a) => a.id === id) || typeof value !== "string" || !value.trim()
            )
          )
            throw new Error();
          cursors = parsed as Record<string, string>;
        } catch {
          throw new Error("The combined inbox page expired. Refresh the inbox.");
        }
      }
      const selected = accounts.filter((account) => !cursors || Object.hasOwn(cursors, account.id));
      const results = await Promise.allSettled(
        selected.map(async (account) => {
          if (account.status === "error")
            throw new Error(account.message ?? "Reconnect this mailbox.");
          const inbox = account.connection.folders.find((folder) => folder.kind === "inbox");
          if (!inbox) throw new Error("This mailbox has no readable inbox.");
          return account.connector.listMessages(inbox.id, cursors?.[account.id] ?? undefined);
        })
      );
      const messages: MailMessageSummary[] = [];
      const next: Record<string, string> = {};
      const warnings: NonNullable<MailPage["accountWarnings"]> = [];
      results.forEach((result, index) => {
        const account = selected[index];
        if (result.status === "rejected") {
          warnings.push({
            accountId: account.id,
            address: account.connection.account.address,
            message:
              result.reason instanceof Error
                ? result.reason.message
                : "This inbox could not be loaded.",
          });
          return;
        }
        messages.push(
          ...result.value.messages.map((message) => ({
            ...message,
            id: scopedMailId(account.id, message.id),
            sourceMessageId: message.id,
            mailAccount: account.connection.account,
          }))
        );
        if (result.value.nextPageUrl) next[account.id] = result.value.nextPageUrl;
      });
      if (selected.length && warnings.length === selected.length)
        throw new Error("None of your inboxes could be loaded. Reconnect an account or try again.");
      return {
        messages: sortMailMessages(messages),
        ...(Object.keys(next).length ? { nextPageUrl: JSON.stringify(next) } : {}),
        ...(warnings.length ? { accountWarnings: warnings } : {}),
      };
    },
    async getMessage(id) {
      const { account, messageId } = owner(id);
      const message = await account.connector.getMessage(messageId);
      return {
        ...message,
        id,
        sourceMessageId: message.id,
        mailAccount: account.connection.account,
      };
    },
    async getAttachment(id, attachment) {
      const { account, messageId } = owner(id);
      if (!account.connector.getAttachment)
        throw new Error("Attachments are unavailable for this mailbox.");
      return account.connector.getAttachment(messageId, attachment);
    },
  };
}
