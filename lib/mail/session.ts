"use client";

import { useSyncExternalStore } from "react";
import type { MailAccount, MailConnection, MailConnector, MailProviderId } from "./model";
import { createMailConnector, getMailConnectors, getRestorableMailConnectors } from "./connectors";

type LegacyMailSession =
  | { status: "disconnected"; connection: null }
  | { status: "restoring"; connection: null }
  | { status: "connecting"; connection: null }
  | { status: "connected"; connection: MailConnection }
  | { status: "error"; connection: null; message: string };

export interface MailAccountSession {
  id: string;
  connector: MailConnector;
  connection: MailConnection;
  status: "connected" | "error";
  message?: string;
}

export type MailSession = LegacyMailSession & {
  accounts: MailAccountSession[];
  activeAccountId: string | null;
  connectingProvider: MailProviderId | null;
  message?: string;
};

const STORAGE_KEY = "verto.mail.accounts.v1";
const EMPTY_SESSION: MailSession = {
  status: "disconnected",
  connection: null,
  accounts: [],
  activeAccountId: null,
  connectingProvider: null,
};
let currentSession: MailSession = EMPTY_SESSION;
let sessionVersion = 0;
let restorePromise: Promise<MailAccountSession[]> | null = null;
let connectRequest = 0;
const accountVersions = new Map<string, number>();
const listeners = new Set<() => void>();

export function mailAccountKey(account: MailAccount): string {
  return `${account.provider}:${account.id.trim()}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "Mail could not be loaded.";
}

function rememberAccounts(): void {
  try {
    if (typeof window === "undefined") return;
    if (!currentSession.accounts.length) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    // Only mailbox identities are remembered. OAuth tokens and message data stay out of this store.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        accounts: currentSession.accounts.map((entry) => entry.connection.account),
        activeAccountId: currentSession.activeAccountId,
      })
    );
  } catch {
    // Mail remains usable when browser storage is unavailable.
  }
}

function publish(next: MailSession, persist = true): void {
  currentSession = next;
  if (persist) rememberAccounts();
  for (const listener of listeners) listener();
}

function project(
  accounts: MailAccountSession[],
  activeAccountId: string | null = currentSession.activeAccountId,
  activity: {
    status?: "disconnected" | "restoring" | "connecting" | "error";
    message?: string;
    connectingProvider?: MailProviderId | null;
  } = {}
): MailSession {
  const active = accounts.find((entry) => entry.id === activeAccountId) ?? accounts[0];
  return {
    ...(active
      ? { status: "connected" as const, connection: active.connection }
      : activity.status === "error"
        ? {
            status: "error" as const,
            connection: null,
            message: activity.message || "Mail could not be loaded.",
          }
        : { status: activity.status ?? "disconnected", connection: null }),
    accounts,
    activeAccountId: activeAccountId === "all" && active ? "all" : (active?.id ?? null),
    connectingProvider:
      activity.connectingProvider === undefined
        ? currentSession.connectingProvider
        : activity.connectingProvider,
    ...(activity.message ? { message: activity.message } : {}),
  } as MailSession;
}

function rememberedAccounts(): { accounts: MailAccount[]; activeAccountId: string | null } {
  try {
    const value = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
    if (!value) return { accounts: [], activeAccountId: null };
    const parsed = JSON.parse(value) as {
      version?: unknown;
      accounts?: unknown;
      activeAccountId?: unknown;
    };
    if (parsed.version !== 1 || !Array.isArray(parsed.accounts))
      return { accounts: [], activeAccountId: null };
    const accounts = parsed.accounts.filter((account: unknown): account is MailAccount => {
      if (!account || typeof account !== "object") return false;
      const item = account as Partial<MailAccount>;
      return (
        (item.provider === "google" || item.provider === "microsoft") &&
        typeof item.id === "string" &&
        Boolean(item.id.trim()) &&
        typeof item.address === "string" &&
        Boolean(item.address.trim()) &&
        typeof item.displayName === "string"
      );
    });
    return {
      accounts,
      activeAccountId: typeof parsed.activeAccountId === "string" ? parsed.activeAccountId : null,
    };
  } catch {
    return { accounts: [], activeAccountId: null };
  }
}

export function getMailSession(): MailSession {
  return currentSession;
}

/** Legacy callers can still set one active connection; new callers use the account helpers. */
export function setMailSession(next: LegacyMailSession | MailSession): void {
  sessionVersion += 1;
  connectRequest += 1;
  restorePromise = null;
  if ("accounts" in next) {
    publish(next);
    return;
  }
  const connector = next.connection
    ? getMailConnectors().find((item) => item.id === next.connection?.account.provider)
    : undefined;
  const accounts: MailAccountSession[] =
    next.connection && connector
      ? [
          {
            id: mailAccountKey(next.connection.account),
            connector,
            connection: next.connection,
            status: "connected",
          },
        ]
      : [];
  publish({
    ...next,
    accounts,
    activeAccountId: accounts[0]?.id ?? null,
    connectingProvider: null,
  });
}

export function registerMailAccount(
  connector: MailConnector,
  connection: MailConnection,
  options: { select?: boolean } = {}
): MailAccountSession {
  const id = mailAccountKey(connection.account);
  const previous = currentSession.accounts.find(
    (entry) =>
      entry.id === id ||
      (entry.connection.account.provider === connection.account.provider &&
        entry.connection.account.address.toLowerCase() === connection.account.address.toLowerCase())
  );
  // Retain a live connector, including any captured in-flight delivery and its sending consent.
  // Revoking the redundant grant here could invalidate the original Google account's grant too.
  const entry: MailAccountSession = {
    id,
    connector: previous?.status === "connected" ? previous.connector : connector,
    connection,
    status: "connected",
  };
  if (previous && previous.connector !== entry.connector) {
    accountVersions.set(previous.id, (accountVersions.get(previous.id) ?? 0) + 1);
    if (previous.id !== id) accountVersions.set(id, (accountVersions.get(id) ?? 0) + 1);
  }
  const accounts = previous
    ? currentSession.accounts.map((item) => (item === previous ? entry : item))
    : [...currentSession.accounts, entry];
  const selected =
    options.select === false
      ? currentSession.activeAccountId === previous?.id
        ? id
        : currentSession.activeAccountId
      : id;
  publish(project(accounts, selected));
  return entry;
}

export function selectMailAccount(id: string): void {
  if (id !== "all" && !currentSession.accounts.some((entry) => entry.id === id)) return;
  publish(project(currentSession.accounts, id));
}

export function reportMailAccountError(id: string, error: unknown): void {
  const accounts = currentSession.accounts.map((entry) =>
    entry.id === id ? { ...entry, status: "error" as const, message: errorMessage(error) } : entry
  );
  publish(project(accounts));
}

export async function connectMailAccount(
  provider: MailProviderId,
  address?: string
): Promise<MailAccountSession | null> {
  if (currentSession.connectingProvider) return null;
  const version = sessionVersion;
  const request = ++connectRequest;
  const versions = new Map(accountVersions);
  const connector = createMailConnector(provider, address);
  publish(
    project(currentSession.accounts, currentSession.activeAccountId, {
      status: "connecting",
      connectingProvider: provider,
    })
  );
  try {
    await connector.connect();
    const connection = await connector.restore();
    if (version !== sessionVersion || request !== connectRequest || !connection) return null;
    const id = mailAccountKey(connection.account);
    if ((versions.get(id) ?? 0) !== (accountVersions.get(id) ?? 0)) return null;
    return registerMailAccount(connector, connection);
  } catch (error) {
    if (version === sessionVersion && request === connectRequest) {
      publish(
        project(currentSession.accounts, currentSession.activeAccountId, {
          status: "error",
          message: errorMessage(error),
        })
      );
    }
    return null;
  } finally {
    if (version === sessionVersion && request === connectRequest) {
      publish(
        project(currentSession.accounts, currentSession.activeAccountId, {
          status: currentSession.status === "error" ? "error" : "disconnected",
          connectingProvider: null,
          message: currentSession.message,
        })
      );
    }
  }
}

export async function disconnectMailAccount(id: string): Promise<void> {
  const entry = currentSession.accounts.find((item) => item.id === id);
  if (!entry) return;
  const version = (accountVersions.get(id) ?? 0) + 1;
  const session = sessionVersion;
  accountVersions.set(id, version);
  try {
    await entry.connector.disconnect();
    if (session !== sessionVersion || accountVersions.get(id) !== version) return;
    // A newer connection for this identity must survive completion of an older disconnect.
    const accounts = currentSession.accounts.filter(
      (item) => item.id !== id || item.connector !== entry.connector
    );
    if (!accounts.length) restorePromise = null;
    publish(project(accounts));
  } catch (error) {
    if (session === sessionVersion && accountVersions.get(id) === version)
      reportMailAccountError(id, error);
  }
}

export function restoreMailAccounts(): Promise<MailAccountSession[]> {
  if (restorePromise) return restorePromise;
  if (currentSession.accounts.length) return Promise.resolve(currentSession.accounts);
  const version = sessionVersion;
  const remembered = rememberedAccounts();
  const placeholders: MailAccountSession[] = remembered.accounts.map((account) => ({
    id: mailAccountKey(account),
    connector: createMailConnector(account.provider, account.address),
    connection: { account, folders: [] },
    status: "error",
    message: `Reconnect ${account.provider === "google" ? "Gmail" : "Outlook"} to read this account.`,
  }));
  publish(project(placeholders, remembered.activeAccountId, { status: "restoring" }), false);
  restorePromise = (async () => {
    let connectors: Array<MailConnector & { account?: MailAccount }>;
    try {
      connectors = await getRestorableMailConnectors();
    } catch (error) {
      if (version === sessionVersion)
        publish(
          project(currentSession.accounts, currentSession.activeAccountId, {
            status: "error",
            message: errorMessage(error),
          })
        );
      return currentSession.accounts;
    }
    if (version !== sessionVersion) return currentSession.accounts;
    const cached = connectors.flatMap((connector): MailAccountSession[] => {
      if (
        !connector.account ||
        currentSession.accounts.some(
          (entry) =>
            entry.id === mailAccountKey(connector.account!) ||
            (entry.connection.account.provider === connector.account!.provider &&
              entry.connection.account.address.toLowerCase() ===
                connector.account!.address.toLowerCase())
        )
      )
        return [];
      return [
        {
          id: mailAccountKey(connector.account),
          connector,
          connection: { account: connector.account, folders: [] },
          status: "error",
          message: "Reconnect Outlook to read this account.",
        },
      ];
    });
    if (cached.length) publish(project([...currentSession.accounts, ...cached]), false);
    const results = await Promise.allSettled(
      connectors.map(async (connector) => {
        const existing = connector.account
          ? currentSession.accounts.find(
              (entry) =>
                entry.id === mailAccountKey(connector.account!) ||
                (entry.connection.account.provider === connector.account!.provider &&
                  entry.connection.account.address.toLowerCase() ===
                    connector.account!.address.toLowerCase())
            )
          : null;
        const id = existing?.id ?? (connector.account ? mailAccountKey(connector.account) : null);
        const accountVersion = id ? (accountVersions.get(id) ?? 0) : 0;
        try {
          const connection = await connector.restore();
          if (version !== sessionVersion || !connection) return;
          if (id && accountVersion !== (accountVersions.get(id) ?? 0)) return;
          registerMailAccount(connector, connection, { select: false });
        } catch (error) {
          if (version === sessionVersion && id && accountVersion === (accountVersions.get(id) ?? 0))
            reportMailAccountError(id, error);
          throw error;
        }
      })
    );
    if (version === sessionVersion) {
      const failure = results.find((result) => result.status === "rejected");
      publish(
        project(
          currentSession.accounts,
          currentSession.activeAccountId,
          failure?.status === "rejected" && !currentSession.accounts.length
            ? { status: "error", message: errorMessage(failure.reason) }
            : { status: "disconnected" }
        )
      );
    }
    return currentSession.accounts;
  })();
  return restorePromise;
}

export function subscribeMailSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMailSession(): MailSession {
  return useSyncExternalStore(subscribeMailSession, getMailSession, () => EMPTY_SESSION);
}
