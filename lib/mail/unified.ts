import type { LocalMailControl, LocalMailStatus } from "./local-types";
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

function readable(account: MailAccountBinding): boolean {
  return account.status !== "error" || Boolean(account.connector.local);
}

function inboxId(account: MailAccountBinding): string {
  const inbox = account.connection.folders.find((folder) => folder.kind === "inbox");
  if (!inbox) throw new Error("This mailbox has no readable inbox.");
  return inbox.id;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "This inbox could not be loaded.";
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
            readable(entry) &&
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

function readCursors(value: unknown, accounts: MailAccountBinding[]): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Object.keys(value).length ||
    Object.entries(value).some(
      ([id, cursor]) =>
        !accounts.some((account) => account.id === id) ||
        typeof cursor !== "string" ||
        !cursor.trim()
    )
  )
    throw new Error();
  return value as Record<string, string>;
}

function inboxCursors(pageUrl: string | undefined, accounts: MailAccountBinding[]) {
  if (!pageUrl) return undefined;
  try {
    return readCursors(JSON.parse(pageUrl), accounts);
  } catch {
    throw new Error("The combined inbox page expired. Refresh the inbox.");
  }
}

async function aggregatePages(
  accounts: MailAccountBinding[],
  cursors: Record<string, string> | undefined,
  read: (account: MailAccountBinding, cursor?: string) => Promise<MailPage>
): Promise<MailPage> {
  const selected = accounts.filter((account) => !cursors || Object.hasOwn(cursors, account.id));
  const results = await Promise.allSettled(
    selected.map(async (account) => {
      if (!readable(account)) throw new Error(account.message ?? "Reconnect this mailbox.");
      return read(account, cursors?.[account.id]);
    })
  );
  const messages: MailMessageSummary[] = [];
  const next: Record<string, string> = Object.create(null);
  const warnings: NonNullable<MailPage["accountWarnings"]> = [];
  results.forEach((result, index) => {
    const account = selected[index];
    const warning = (message: string) =>
      warnings.push({
        accountId: account.id,
        address: account.connection.account.address,
        message,
      });
    if (result.status === "rejected") {
      warning(errorMessage(result.reason));
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
    if (account.status === "error")
      warning(account.message ?? "Reconnect this mailbox to sync saved messages.");
    for (const item of result.value.accountWarnings ?? []) warning(item.message);
  });
  if (selected.length && results.every((result) => result.status === "rejected"))
    throw new Error("None of your inboxes could be loaded. Reconnect an account or try again.");
  return {
    messages: sortMailMessages(messages),
    ...(Object.keys(next).length ? { nextPageUrl: JSON.stringify(next) } : {}),
    ...(warnings.length ? { accountWarnings: warnings } : {}),
  };
}

interface SearchCursor {
  kind: "saved-search";
  scope: string;
  folderId: string | null;
  query: string;
  unreadOnly: boolean;
  cursors: Record<string, string>;
}

function searchCursors(
  pageUrl: string | undefined,
  context: Omit<SearchCursor, "cursors">,
  accounts: MailAccountBinding[]
) {
  if (!pageUrl) return undefined;
  try {
    const parsed = JSON.parse(pageUrl);
    if (!parsed || Object.entries(context).some(([key, value]) => parsed[key] !== value))
      throw new Error();
    return readCursors(parsed.cursors, accounts);
  } catch {
    throw new Error("The combined saved search page expired. Search again.");
  }
}

function localStatus(account: MailAccountBinding, failure?: string): LocalMailStatus {
  let status: LocalMailStatus;
  try {
    status = account.connector.local!.getStatus(inboxId(account));
  } catch (error) {
    return { phase: "error", count: 0, message: errorMessage(error) };
  }
  if (account.status === "error")
    status = {
      ...status,
      phase: status.phase === "idle" ? "offline" : status.phase,
      message:
        status.message ?? account.message ?? "Reconnect this mailbox to sync saved messages.",
    };
  if (failure && status.phase !== "syncing")
    status = {
      ...status,
      phase: status.phase === "offline" ? "offline" : "error",
      message: failure,
    };
  return status;
}

function combinedStatus(
  accounts: MailAccountBinding[],
  failures: Map<string, string>,
  syncing: boolean
): LocalMailStatus {
  const statuses = accounts.map((account) => localStatus(account, failures.get(account.id)));
  const phase =
    syncing || statuses.some((status) => status.phase === "syncing")
      ? "syncing"
      : statuses.some((status) => status.phase === "error")
        ? "error"
        : statuses.some((status) => status.phase === "offline")
          ? "offline"
          : "idle";
  const lastSyncedAt = statuses.every(
    (status) => typeof status.lastSyncedAt === "number" && Number.isFinite(status.lastSyncedAt)
  )
    ? Math.min(...statuses.map((status) => status.lastSyncedAt!))
    : undefined;
  const messages = statuses.flatMap((status, index) => {
    const message =
      status.message ??
      (status.phase === "offline"
        ? "Offline · saved messages remain readable."
        : status.phase === "error"
          ? "This mailbox could not be synced."
          : undefined);
    return message ? [`${accounts[index].connection.account.address}: ${message}`] : [];
  });
  return {
    phase,
    count: statuses.reduce((total, status) => total + status.count, 0),
    ...(lastSyncedAt !== undefined ? { lastSyncedAt } : {}),
    ...(messages.length ? { message: messages.join(" ") } : {}),
  };
}

function createUnifiedLocalControl(accounts: MailAccountBinding[]): LocalMailControl {
  const listeners = new Set<() => void>();
  const failures = new Map<string, string>();
  const snapshots = new Map<string, { key: string; status: LocalMailStatus }>();
  let unsubscribes: Array<() => void> = [];
  let syncing = 0;
  const scope = `all:${JSON.stringify(accounts.map((account) => account.connector.local!.scope))}`;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    scope,
    subscribe(listener) {
      listeners.add(listener);
      if (!unsubscribes.length)
        unsubscribes = accounts.map((account) =>
          account.connector.local!.subscribe(() => {
            const phase = localStatus(account).phase;
            if (phase === "idle" || phase === "syncing") failures.delete(account.id);
            notify();
          })
        );
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          for (const unsubscribe of unsubscribes) unsubscribe();
          unsubscribes = [];
        }
      };
    },
    getStatus(folderId) {
      const status =
        folderId === "INBOX"
          ? combinedStatus(accounts, failures, syncing > 0)
          : {
              phase: "error" as const,
              count: 0,
              message: "Choose an account to open this saved folder.",
            };
      const key = JSON.stringify(status);
      const existing = snapshots.get(folderId);
      if (existing?.key === key) return existing.status;
      snapshots.set(folderId, { key, status });
      return status;
    },
    async synchronize(folderId) {
      if (folderId !== "INBOX") throw new Error("Choose an account to sync this folder.");
      failures.clear();
      syncing += 1;
      notify();
      try {
        const results = await Promise.allSettled(
          accounts.map(async (account) => {
            await account.connector.local!.synchronize(inboxId(account));
            const status = localStatus(account);
            if (status.phase !== "idle")
              throw new Error(status.message ?? "This inbox has not finished syncing.");
          })
        );
        results.forEach((result, index) => {
          if (result.status === "rejected")
            failures.set(accounts[index].id, errorMessage(result.reason));
        });
        if (failures.size) {
          const detail = accounts
            .filter((account) => failures.has(account.id))
            .map((account) => `${account.connection.account.address}: ${failures.get(account.id)}`)
            .join(" ");
          const summary =
            failures.size === accounts.length
              ? "None of your inboxes could be synced."
              : "Some of your inboxes could not be synced.";
          throw new Error(`${summary} ${detail}`);
        }
      } finally {
        syncing -= 1;
        notify();
      }
    },
    async search(folderId, query, unreadOnly = false, pageUrl) {
      if (folderId !== undefined && folderId !== "INBOX")
        throw new Error("Choose an account to search this saved folder.");
      const context: Omit<SearchCursor, "cursors"> = {
        kind: "saved-search",
        scope,
        folderId: folderId ?? null,
        query,
        unreadOnly,
      };
      const cursors = searchCursors(pageUrl, context, accounts);
      const page = await aggregatePages(accounts, cursors, (account, cursor) =>
        account.connector.local!.search(
          folderId === undefined ? undefined : inboxId(account),
          query,
          unreadOnly,
          cursor
        )
      );
      return {
        ...page,
        ...(page.nextPageUrl
          ? { nextPageUrl: JSON.stringify({ ...context, cursors: JSON.parse(page.nextPageUrl) }) }
          : {}),
      };
    },
    async clear() {
      throw new Error("Choose an account to clear its saved mail.");
    },
  };
}

/** Read-only aggregation. Composition always uses the owning account's connector. */
export function createUnifiedMailConnector(accounts: MailAccountBinding[]): MailConnector {
  function owner(id: string) {
    const [accountId, messageId] = readScopedId(id);
    const account = accounts.find((item) => item.id === accountId);
    if (!account || !readable(account))
      throw new Error("This mailbox is unavailable. Reconnect it from Manage accounts.");
    return { account, messageId };
  }
  return {
    id: accounts[0]?.connector.id ?? "google",
    label: "All inboxes",
    ...(accounts.length && accounts.every((account) => account.connector.local)
      ? { local: createUnifiedLocalControl(accounts) }
      : {}),
    isConfigured: () => accounts.length > 0,
    connect: async () => {
      throw new Error("Choose an account to connect.");
    },
    restore: async () => unifiedMailConnection(accounts),
    disconnect: async () => {
      throw new Error("Choose an account to disconnect.");
    },
    listMessages: async (_folderId, pageUrl) =>
      aggregatePages(accounts, inboxCursors(pageUrl, accounts), (account, cursor) =>
        account.connector.listMessages(inboxId(account), cursor)
      ),
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
