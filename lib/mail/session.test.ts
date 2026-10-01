import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMailSession,
  setMailSession,
  subscribeMailSession,
  updateMailAccountConnection,
} from "./session";

afterEach(() => {
  setMailSession({ status: "disconnected", connection: null });
});

describe("mail session shared between the workspace and sidebar", () => {
  const connection = {
    account: {
      id: "google-account",
      address: "reader@example.com",
      displayName: "Reader",
      provider: "google" as const,
    },
    folders: [{ id: "INBOX", name: "Inbox", kind: "inbox" as const, unreadCount: 3 }],
  };

  it("publishes confirmed unread counts once without changing the owning connector", () => {
    setMailSession({ status: "connected", connection });
    const entry = getMailSession().accounts[0];
    const listener = vi.fn();
    const stop = subscribeMailSession(listener);
    const updated = { ...connection, folders: [{ ...connection.folders[0], unreadCount: 2 }] };
    updateMailAccountConnection(entry.id, entry.connector, updated);
    expect(getMailSession().connection).toEqual(updated);
    expect(getMailSession().accounts[0].connector).toBe(entry.connector);
    expect(listener).toHaveBeenCalledOnce();
    updateMailAccountConnection(entry.id, entry.connector, structuredClone(updated));
    expect(listener).toHaveBeenCalledOnce();
    stop();
  });

  it("ignores another identity and metadata from a replaced or disconnected connector", () => {
    setMailSession({ status: "connected", connection });
    const entry = getMailSession().accounts[0];
    const updated = { ...connection, folders: [{ ...connection.folders[0], unreadCount: 0 }] };
    updateMailAccountConnection(entry.id, entry.connector, {
      ...updated,
      account: { ...connection.account, id: "other-account" },
    });
    expect(getMailSession().connection).toEqual(connection);
    const replacement = { ...entry.connector };
    setMailSession({
      ...getMailSession(),
      accounts: [{ ...entry, connector: replacement }],
    });
    expect(getMailSession().accounts[0].connector).toBe(replacement);
    updateMailAccountConnection(entry.id, entry.connector, updated);
    expect(getMailSession().connection).toEqual(connection);
    setMailSession({ status: "disconnected", connection: null });
    updateMailAccountConnection(entry.id, entry.connector, updated);
    expect(getMailSession().accounts).toEqual([]);
  });

  it("notifies every mounted view when an account connects and stops notifying unmounted views", () => {
    const sidebar = vi.fn();
    const workspace = vi.fn();
    const stopSidebar = subscribeMailSession(sidebar);
    const stopWorkspace = subscribeMailSession(workspace);
    const connection = {
      account: {
        id: "google-account",
        address: "reader@example.com",
        displayName: "Reader",
        provider: "google" as const,
      },
      folders: [{ id: "INBOX", name: "Inbox", kind: "inbox" as const }],
    };

    setMailSession({ status: "connected", connection });
    expect(getMailSession()).toMatchObject({
      status: "connected",
      connection,
      activeAccountId: "google:google-account",
      accounts: [{ connection }],
    });
    expect(sidebar).toHaveBeenCalledOnce();
    expect(workspace).toHaveBeenCalledOnce();

    stopSidebar();
    setMailSession({ status: "disconnected", connection: null });
    expect(sidebar).toHaveBeenCalledOnce();
    expect(workspace).toHaveBeenCalledTimes(2);
    stopWorkspace();
  });
});
