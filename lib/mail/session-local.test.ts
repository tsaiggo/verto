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
import { MailConnectionUnavailableError, MailRequestError } from "./http";
import {
  disconnectMailAccount,
  getMailSession,
  registerMailAccount,
  reportMailAccountError,
  restoreMailAccounts,
  retryMailAccountRestore,
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
const microsoftMailbox: MailConnection = {
  ...mailbox,
  account: { ...mailbox.account, provider: "microsoft", id: "home-account" },
};
const microsoftScope = "microsoft:home-account";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function microsoftRemote(): MailConnector {
  const connector = remote("microsoft");
  vi.mocked(connector.restore).mockResolvedValue(microsoftMailbox);
  return connector;
}

async function restoreUnavailableMicrosoft() {
  await store.saveConnection(microsoftScope, microsoftMailbox);
  await store.applySyncPage(microsoftScope, "INBOX", { messages: [message], cursor: "10" });
  const original = Object.assign(microsoftRemote(), { account: microsoftMailbox.account });
  vi.mocked(original.restore).mockRejectedValueOnce(
    new MailConnectionUnavailableError("Identity network is temporarily unavailable.")
  );
  factories.restore.mockResolvedValueOnce([original]);
  await restoreMailAccounts();
  const entry = getMailSession().accounts[0];
  expect(entry).toMatchObject({ id: microsoftScope, status: "error", canRetryRestore: true });
  return { entry, original };
}

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
    expect(entry.canRetryRestore).not.toBe(true);
    factories.create.mockClear();
    expect(await retryMailAccountRestore(entry.id)).toBeNull();
    expect(factories.create).not.toHaveBeenCalled();
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

  it("silently retries a temporary Outlook startup restore with a fresh live connector and keeps its cache", async () => {
    const { entry, original } = await restoreUnavailableMicrosoft();
    expect((await entry.connector.getMessage(message.id)).bodyText).toBe(message.bodyText);
    const fresh = microsoftRemote();
    factories.create.mockClear().mockImplementation(() => fresh);
    const restored = await retryMailAccountRestore(entry.id);
    expect(restored).toMatchObject({
      id: microsoftScope,
      status: "connected",
      connection: microsoftMailbox,
    });
    expect(restored?.canRetryRestore).not.toBe(true);
    expect(restored?.connector).not.toBe(entry.connector);
    expect(factories.create).toHaveBeenCalledExactlyOnceWith(
      "microsoft",
      microsoftMailbox.account.address,
      microsoftMailbox.account.id
    );
    expect(fresh.restore).toHaveBeenCalledOnce();
    expect(fresh.connect).not.toHaveBeenCalled();
    expect(original.connect).not.toHaveBeenCalled();
    expect((await restored!.connector.getMessage(message.id)).bodyText).toBe(message.bodyText);
    expect(fresh.getMessage).not.toHaveBeenCalled();
    await restored!.connector.local!.synchronize("INBOX");
    expect(fresh.syncFolder).toHaveBeenCalledOnce();
    expect(getMailSession().accounts).toHaveLength(1);
  });

  it("shares one silent restore attempt for duplicate retry requests", async () => {
    const { entry } = await restoreUnavailableMicrosoft();
    const result = deferred<MailConnection | null>();
    const fresh = microsoftRemote();
    vi.mocked(fresh.restore).mockReturnValueOnce(result.promise);
    factories.create.mockClear().mockImplementation(() => fresh);
    const first = retryMailAccountRestore(entry.id);
    const second = retryMailAccountRestore(entry.id);
    expect(second).toBe(first);
    await vi.waitFor(() => expect(fresh.restore).toHaveBeenCalledOnce());
    expect(factories.create).toHaveBeenCalledOnce();
    expect(fresh.connect).not.toHaveBeenCalled();
    result.resolve(microsoftMailbox);
    const [one, two] = await Promise.all([first, second]);
    expect(one).toBe(two);
    expect(one?.status).toBe("connected");
    expect(getMailSession().accounts).toHaveLength(1);
  });

  it.each(["disconnect", "replacement"] as const)(
    "ignores a late silent restore after account %s",
    async (retirement) => {
      const { entry } = await restoreUnavailableMicrosoft();
      const result = deferred<MailConnection | null>();
      const fresh = microsoftRemote();
      vi.mocked(fresh.restore).mockReturnValueOnce(result.promise);
      factories.create.mockImplementation(() => fresh);
      const retry = retryMailAccountRestore(entry.id);
      await vi.waitFor(() => expect(fresh.restore).toHaveBeenCalledOnce());
      if (retirement === "disconnect") {
        await disconnectMailAccount(entry.id);
        expect(getMailSession().accounts[0]).toMatchObject({
          status: "error",
          canRetryRestore: false,
        });
      } else registerMailAccount(microsoftRemote(), microsoftMailbox);
      const current = getMailSession().accounts[0];
      result.resolve(microsoftMailbox);
      expect(await retry).toBeNull();
      expect(getMailSession().accounts).toEqual([current]);
      expect(current.connector).not.toBe(fresh);
      expect((await store.getMessage(microsoftScope, message.id))?.bodyText).toBe(message.bodyText);
      expect(fresh.connect).not.toHaveBeenCalled();
    }
  );

  it("keeps a repeated temporary retry failure eligible without opening consent or changing saved mail", async () => {
    const { entry } = await restoreUnavailableMicrosoft();
    const fresh = microsoftRemote();
    vi.mocked(fresh.restore).mockRejectedValueOnce(
      new MailConnectionUnavailableError("Network still unavailable.")
    );
    factories.create.mockImplementation(() => fresh);
    expect(await retryMailAccountRestore(entry.id)).toBeNull();
    expect(getMailSession().accounts[0]).toMatchObject({
      id: microsoftScope,
      status: "error",
      canRetryRestore: true,
      message: "Network still unavailable.",
    });
    expect(fresh.connect).not.toHaveBeenCalled();
    expect((await store.getMessage(microsoftScope, message.id))?.bodyText).toBe(message.bodyText);
  });

  it("requires explicit reconnect after a real Outlook authentication failure and ignores quiet retry", async () => {
    await store.saveConnection(microsoftScope, microsoftMailbox);
    await store.applySyncPage(microsoftScope, "INBOX", { messages: [message], cursor: "10" });
    const expired = Object.assign(microsoftRemote(), { account: microsoftMailbox.account });
    vi.mocked(expired.restore).mockRejectedValueOnce(
      new MailRequestError("Your mail session expired. Reconnect to continue.", 401)
    );
    factories.restore.mockResolvedValueOnce([expired]);
    await restoreMailAccounts();
    const entry = getMailSession().accounts[0];
    expect(entry).toMatchObject({ status: "error", canRetryRestore: false });
    factories.create.mockClear();
    expect(await retryMailAccountRestore(entry.id)).toBeNull();
    expect(factories.create).not.toHaveBeenCalled();
    expect(expired.connect).not.toHaveBeenCalled();
    expect((await entry.connector.getMessage(message.id)).bodyText).toBe(message.bodyText);
  });

  it("rejects a quiet restore for another mailbox identity and preserves the saved account", async () => {
    const { entry } = await restoreUnavailableMicrosoft();
    const fresh = microsoftRemote();
    const wrong = {
      ...microsoftMailbox,
      account: { ...microsoftMailbox.account, id: "another-home-account" },
    };
    vi.mocked(fresh.restore).mockResolvedValueOnce(wrong);
    factories.create.mockImplementation(() => fresh);
    expect(await retryMailAccountRestore(entry.id)).toBeNull();
    expect(getMailSession().accounts).toHaveLength(1);
    expect(getMailSession().accounts[0]).toMatchObject({
      id: microsoftScope,
      status: "error",
      connection: microsoftMailbox,
      canRetryRestore: false,
    });
    expect(getMailSession().accounts[0].connector).toBe(entry.connector);
    expect(await store.getConnection(microsoftScope)).toEqual(microsoftMailbox);
    expect((await store.getMessage(microsoftScope, message.id))?.bodyText).toBe(message.bodyText);
    expect(await store.getConnection("microsoft:another-home-account")).toBeUndefined();
    expect(fresh.connect).not.toHaveBeenCalled();
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
