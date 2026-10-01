import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalMailStore } from "./local-types";
import type { MailConnection, MailConnector, MailMessage, MailProviderId } from "./model";

const factories = vi.hoisted(() => ({ create: vi.fn(), restore: vi.fn(), store: vi.fn() }));
vi.mock("./connectors", () => ({
  createMailConnector: factories.create,
  getRestorableMailConnectors: factories.restore,
  getMailConnectors: () => [],
}));
vi.mock("./local-store", async (original) => ({
  ...(await original<typeof import("./local-store")>()),
  getLocalMailStore: factories.store,
}));
import { createLocalMailStore } from "./local-store";
import {
  disconnectMailAccount,
  getMailSession,
  registerMailAccount,
  reportMailAccountError,
  restoreMailAccounts,
  setMailSession,
} from "./session";

let store: LocalMailStore;
const memory = new Map<string, string>();
const mailbox: MailConnection = {
  account: {
    id: "opaque",
    provider: "google",
    address: "reader@example.com",
    displayName: "Reader",
  },
  folders: [{ id: "INBOX", kind: "inbox", name: "Inbox" }],
};
const message: MailMessage = {
  id: "saved-message",
  from: "Sender <sender@example.com>",
  to: [mailbox.account.address],
  subject: "Saved",
  receivedAt: "2026-10-01T00:00:00Z",
  isRead: false,
  hasAttachments: false,
  preview: "Short preview",
  bodyText: "The full body is readable after authorization expires.",
};

function remote(provider: MailProviderId = "google"): MailConnector {
  return {
    id: provider,
    label: provider,
    isConfigured: () => true,
    connect: vi.fn(),
    restore: vi.fn(async () => mailbox),
    disconnect: vi.fn(async () => undefined),
    listMessages: vi.fn(async () => ({ messages: [] })),
    getMessage: vi.fn(async () => message),
    syncFolder: vi.fn(async () => ({ messages: [message], reset: true, cursor: "10" })),
    sendMessage: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("navigator", { onLine: true });
  const events = new EventTarget();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  });
  memory.clear();
  store = createLocalMailStore();
  factories.store.mockReturnValue(store);
  factories.create.mockImplementation((provider: MailProviderId) => remote(provider));
  factories.restore.mockResolvedValue([]);
  setMailSession({ status: "disconnected", connection: null });
});
afterEach(() => {
  setMailSession({ status: "disconnected", connection: null });
  vi.unstubAllGlobals();
});

describe("saved mailbox restoration", () => {
  it("restores saved mail even without remembered identities, credentials or configured providers", async () => {
    await store.saveConnection("google:opaque", mailbox);
    await store.applySyncPage("google:opaque", "INBOX", { messages: [message], cursor: "10" });
    vi.stubGlobal("navigator", { onLine: false });
    await restoreMailAccounts();
    const entry = getMailSession().accounts[0];
    expect(entry).toMatchObject({ status: "error", connection: mailbox });
    expect(entry.connector.local).toBeDefined();
    expect((await entry.connector.listMessages("INBOX")).messages[0].id).toBe(message.id);
    expect((await entry.connector.getMessage(message.id)).bodyText).toBe(message.bodyText);
    expect(await entry.connector.local!.search("INBOX", "authorization expires")).toMatchObject({
      messages: [{ id: message.id }],
    });
    expect(entry.connector.local!.getStatus("INBOX")).toMatchObject({ phase: "offline", count: 1 });
  });

  it("keeps cached mail when silent provider restoration fails", async () => {
    await store.saveConnection("google:opaque", mailbox);
    await store.applySyncPage("google:opaque", "INBOX", { messages: [message], cursor: "10" });
    const expired = Object.assign(remote(), { account: mailbox.account });
    vi.mocked(expired.restore).mockRejectedValueOnce(new Error("Session expired."));
    factories.restore.mockResolvedValueOnce([expired]);
    await restoreMailAccounts();
    const entry = getMailSession().accounts[0];
    expect(entry.status).toBe("error");
    expect(entry.message).toBe("Session expired.");
    expect((await entry.connector.getMessage(message.id)).bodyText).toBe(message.bodyText);
    expect(expired.getMessage).not.toHaveBeenCalled();
  });

  it("excludes demo caches from the real account registry", async () => {
    await store.saveConnection("demo:google:opaque", mailbox);
    await store.applySyncPage("demo:google:opaque", "INBOX", { messages: [message] });
    await restoreMailAccounts();
    expect(getMailSession().accounts).toEqual([]);
  });

  it("disconnects authorization while preserving saved mail, and reconnects using a fresh live connector", async () => {
    const original = remote();
    const first = registerMailAccount(original, mailbox);
    await first.connector.local!.synchronize("INBOX");
    await disconnectMailAccount(first.id);
    const disconnected = getMailSession().accounts[0];
    expect(disconnected).toMatchObject({ status: "error", id: first.id });
    expect(original.disconnect).toHaveBeenCalledOnce();
    expect((await disconnected.connector.getMessage(message.id)).bodyText).toBe(message.bodyText);
    await expect(
      disconnected.connector.sendMessage!({
        to: [],
        cc: [],
        bcc: [],
        subject: "Hi",
        bodyText: "Hi",
      })
    ).rejects.toThrow("Reconnect");
    const next = registerMailAccount(remote(), mailbox);
    expect(next.status).toBe("connected");
    expect(next.connector).not.toBe(first.connector);
    expect(getMailSession().accounts).toHaveLength(1);
  });

  it("continues restoring online accounts when the local database is blocked", async () => {
    vi.spyOn(store, "listAccounts").mockRejectedValueOnce(new Error("Blocked"));
    const online = remote();
    factories.restore.mockResolvedValueOnce([online]);
    await restoreMailAccounts();
    expect(getMailSession().accounts[0].status).toBe("connected");
    expect(online.restore).toHaveBeenCalledOnce();
  });

  it("reports failed authorization removal while keeping saved mail readable", async () => {
    const original = remote();
    const entry = registerMailAccount(original, mailbox);
    await entry.connector.local!.synchronize("INBOX");
    vi.mocked(original.disconnect).mockRejectedValueOnce(
      new Error("Authorization removal failed.")
    );
    expect(await disconnectMailAccount(entry.id)).toBe(false);
    expect(getMailSession().accounts[0]).toMatchObject({
      status: "error",
      message: "Authorization removal failed.",
    });
    expect((await entry.connector.getMessage(message.id)).bodyText).toBe(message.bodyText);
  });

  it("keeps a reconnected account live when the old authentication callback resumes", async () => {
    const original = remote();
    const failure = Object.assign(new Error("Session expired."), { status: 401 });
    vi.mocked(original.syncFolder!).mockRejectedValueOnce(failure);
    const first = registerMailAccount(original, mailbox);
    const local = first.connector.local!;
    const fresh = remote();
    let replacement: ReturnType<typeof registerMailAccount> | undefined;
    const unsubscribe = local.subscribe(() => {
      if (local.getStatus("INBOX").phase !== "offline" || replacement) return;
      unsubscribe();
      // Reconnect during invalidation notification, before the old authentication callback resumes.
      reportMailAccountError(first.id, failure);
      replacement = registerMailAccount(fresh, mailbox);
    });

    try {
      await expect(local.synchronize("INBOX")).rejects.toBe(failure);
      expect(replacement).toBeDefined();
      expect(replacement!.connector).not.toBe(first.connector);
      expect(getMailSession().accounts).toEqual([replacement]);
      expect(getMailSession().accounts[0]).toMatchObject({ status: "connected" });
      expect(getMailSession().accounts[0].message).toBeUndefined();
      await replacement!.connector.local!.synchronize("INBOX");
      expect(fresh.syncFolder).toHaveBeenCalledOnce();
      expect(getMailSession().accounts[0].status).toBe("connected");
    } finally {
      unsubscribe();
    }
  });
});
