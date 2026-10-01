import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailConnection, MailConnector, MailProviderId } from "./model";

const factories = vi.hoisted(() => ({
  create: vi.fn(),
  available: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("./connectors", () => ({
  createMailConnector: factories.create,
  getMailConnectors: factories.available,
  getRestorableMailConnectors: factories.restore,
}));
import {
  connectMailAccount,
  disconnectMailAccount,
  getMailSession,
  mailAccountKey,
  registerMailAccount,
  reportMailAccountError,
  restoreMailAccounts,
  selectMailAccount,
  setMailSession,
} from "./session";

const storage = new Map<string, string>();
const STORAGE_KEY = "verto.mail.accounts.v1";

function connection(address: string, provider: MailProviderId = "google"): MailConnection {
  return {
    account: { id: address, address, displayName: address.split("@")[0], provider },
    folders: [{ id: "INBOX", name: "Inbox", kind: "inbox", unreadCount: 2 }],
  };
}

function connector(mailbox: MailConnection): MailConnector {
  return {
    id: mailbox.account.provider,
    label: mailbox.account.provider === "google" ? "Gmail" : "Outlook",
    isConfigured: () => true,
    connect: vi.fn(async () => undefined),
    restore: vi.fn(async () => mailbox),
    disconnect: vi.fn(async () => undefined),
    listMessages: vi.fn(async () => ({ messages: [] })),
    getMessage: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  factories.restore.mockResolvedValue([]);
  factories.available.mockReturnValue([]);
  factories.create.mockImplementation((provider: MailProviderId, address?: string) =>
    connector(connection(address || "new@example.com", provider))
  );
  setMailSession({ status: "disconnected", connection: null });
});
afterEach(() => {
  setMailSession({ status: "disconnected", connection: null });
  vi.unstubAllGlobals();
});

describe("multi-account Mail registry", () => {
  it("preserves opaque provider IDs and migrates remembered Outlook IDs without duplicating a mailbox", async () => {
    const remembered = connection("work@outlook.com", "microsoft");
    remembered.account.id = "OldGraphID";
    const mailbox = connection("work@outlook.com", "microsoft");
    mailbox.account.id = "OpaqueCase.TenantID";
    const cached = Object.assign(connector(mailbox), { account: mailbox.account });
    storage.set(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        accounts: [remembered.account],
        activeAccountId: "microsoft:OldGraphID",
      })
    );
    factories.restore.mockResolvedValueOnce([cached]);
    await restoreMailAccounts();
    expect(mailAccountKey(mailbox.account)).toBe("microsoft:OpaqueCase.TenantID");
    expect(getMailSession().accounts).toHaveLength(1);
    expect(getMailSession()).toMatchObject({
      activeAccountId: "microsoft:OpaqueCase.TenantID",
      accounts: [{ connector: cached, connection: mailbox, status: "connected" }],
    });
  });
  it("keeps two Gmail connectors independent and removes only the chosen mailbox", async () => {
    const personal = connection("personal@gmail.com");
    const work = connection("work@gmail.com");
    const personalConnector = connector(personal);
    const workConnector = connector(work);
    registerMailAccount(personalConnector, personal);
    registerMailAccount(workConnector, work);
    selectMailAccount("all");
    expect(getMailSession()).toMatchObject({
      status: "connected",
      activeAccountId: "all",
      accounts: [
        { id: "google:personal@gmail.com", connector: personalConnector },
        { id: "google:work@gmail.com", connector: workConnector },
      ],
    });
    selectMailAccount(mailAccountKey(personal.account));
    expect(getMailSession().connection).toBe(personal);
    await disconnectMailAccount(mailAccountKey(work.account));
    expect(workConnector.disconnect).toHaveBeenCalledOnce();
    expect(personalConnector.disconnect).not.toHaveBeenCalled();
    expect(getMailSession().accounts).toHaveLength(1);
    expect(getMailSession().connection).toBe(personal);
  });

  it("retains a live connector and pending delivery when the same account is added again", async () => {
    const personal = connection("personal@gmail.com");
    const original = connector(personal);
    const redundant = connector(personal);
    const sending = deferred<void>();
    vi.mocked(original.sendMessage!).mockReturnValueOnce(sending.promise);
    registerMailAccount(original, personal);
    const delivery = original.sendMessage!({
      to: ["recipient@example.com"],
      cc: [],
      bcc: [],
      subject: "Hi",
      bodyText: "Hi",
    });
    const result = registerMailAccount(redundant, { ...personal, folders: [] });
    expect(result.connector).toBe(original);
    expect(getMailSession().accounts).toHaveLength(1);
    expect(original.disconnect).not.toHaveBeenCalled();
    expect(redundant.disconnect).not.toHaveBeenCalled();
    sending.resolve();
    await delivery;
    expect(original.sendMessage).toHaveBeenCalledOnce();
    expect(redundant.sendMessage).not.toHaveBeenCalled();
  });

  it("adds a fresh account without dropping the currently selected mailbox during consent", async () => {
    const personal = connection("personal@gmail.com");
    registerMailAccount(connector(personal), personal);
    const work = connection("work@gmail.com");
    const next = connector(work);
    const popup = deferred<void>();
    vi.mocked(next.connect).mockReturnValueOnce(popup.promise);
    factories.create.mockReturnValueOnce(next);
    const adding = connectMailAccount("google");
    expect(getMailSession()).toMatchObject({
      status: "connected",
      connection: personal,
      connectingProvider: "google",
    });
    expect(await connectMailAccount("microsoft")).toBeNull();
    popup.resolve();
    expect((await adding)?.connector).toBe(next);
    expect(getMailSession()).toMatchObject({ connection: work, connectingProvider: null });
    expect(getMailSession().accounts).toHaveLength(2);
    expect(factories.create).toHaveBeenCalledTimes(1);
  });

  it("keeps existing accounts usable after an add-account error and a targeted read error", async () => {
    const personal = connection("personal@gmail.com");
    const work = connection("work@outlook.com", "microsoft");
    registerMailAccount(connector(personal), personal);
    registerMailAccount(connector(work), work);
    const rejected = connector(connection("other@gmail.com"));
    vi.mocked(rejected.connect).mockRejectedValueOnce(new Error("Sign-in cancelled."));
    factories.create.mockReturnValueOnce(rejected);
    expect(await connectMailAccount("google")).toBeNull();
    expect(getMailSession()).toMatchObject({
      status: "connected",
      connection: work,
      message: "Sign-in cancelled.",
      connectingProvider: null,
    });
    reportMailAccountError(mailAccountKey(personal.account), new Error("Session expired."));
    expect(getMailSession().accounts[0]).toMatchObject({
      status: "error",
      message: "Session expired.",
      connection: personal,
    });
    expect(getMailSession().accounts[1].status).toBe("connected");
  });

  it("ignores a connect result after the session has been reset", async () => {
    const mailbox = connection("late@gmail.com");
    const next = connector(mailbox);
    const popup = deferred<void>();
    vi.mocked(next.connect).mockReturnValueOnce(popup.promise);
    factories.create.mockReturnValueOnce(next);
    const adding = connectMailAccount("google");
    setMailSession({ status: "disconnected", connection: null });
    popup.resolve();
    expect(await adding).toBeNull();
    expect(getMailSession()).toMatchObject({
      status: "disconnected",
      accounts: [],
      connectingProvider: null,
    });
  });

  it("does not re-add a mailbox removed while duplicate consent is pending", async () => {
    const mailbox = connection("personal@gmail.com");
    registerMailAccount(connector(mailbox), mailbox);
    const next = connector(mailbox);
    const popup = deferred<void>();
    vi.mocked(next.connect).mockReturnValueOnce(popup.promise);
    factories.create.mockReturnValueOnce(next);
    const adding = connectMailAccount("google");
    await disconnectMailAccount(mailAccountKey(mailbox.account));
    popup.resolve();
    expect(await adding).toBeNull();
    expect(getMailSession()).toMatchObject({ status: "disconnected", accounts: [] });
  });

  it("does not remove or mark a new connector as failed when an older disconnect completes", async () => {
    const mailbox = connection("personal@gmail.com");
    const original = connector(mailbox);
    const replacement = connector(mailbox);
    registerMailAccount(original, mailbox);
    reportMailAccountError(mailAccountKey(mailbox.account), "Expired");
    const removal = deferred<void>();
    vi.mocked(original.disconnect).mockReturnValueOnce(removal.promise);
    const removing = disconnectMailAccount(mailAccountKey(mailbox.account));
    registerMailAccount(replacement, mailbox);
    removal.reject(new Error("Old disconnect failed."));
    await removing;
    expect(getMailSession().accounts[0]).toMatchObject({
      connector: replacement,
      status: "connected",
    });
  });

  it("migrates a legacy active connection into an independently selectable registry entry", () => {
    const mailbox = connection("personal@gmail.com");
    const legacy = connector(mailbox);
    factories.available.mockReturnValue([legacy]);
    setMailSession({ status: "connected", connection: mailbox });
    expect(getMailSession()).toMatchObject({
      activeAccountId: mailAccountKey(mailbox.account),
      accounts: [{ connector: legacy, connection: mailbox }],
    });
  });

  it("keeps a fresh connection when it replaces a mailbox whose disconnect is still pending", async () => {
    const mailbox = connection("personal@gmail.com");
    const original = connector(mailbox);
    const replacement = connector(mailbox);
    const completion = deferred<void>();
    vi.mocked(original.disconnect).mockReturnValueOnce(completion.promise);
    registerMailAccount(original, mailbox);
    const removing = disconnectMailAccount(mailAccountKey(mailbox.account));
    registerMailAccount(replacement, mailbox);
    completion.resolve();
    expect(await removing).toBe(false);
    expect(getMailSession().accounts[0]).toMatchObject({
      connector: replacement,
      status: "connected",
    });
  });

  it("restores each cached Outlook account independently and keeps a failed account's identity", async () => {
    const personal = connection("personal@outlook.com", "microsoft");
    const work = connection("work@outlook.com", "microsoft");
    const first = Object.assign(connector(personal), { account: personal.account });
    const second = Object.assign(connector(work), { account: work.account });
    vi.mocked(first.restore).mockRejectedValueOnce(new Error("Personal token expired."));
    factories.restore.mockResolvedValueOnce([first, second]);
    const restore = restoreMailAccounts();
    expect(restoreMailAccounts()).toBe(restore);
    await restore;
    expect(getMailSession().accounts).toMatchObject([
      {
        connection: { account: personal.account },
        status: "error",
        message: "Personal token expired.",
      },
      { connection: work, connector: second, status: "connected" },
    ]);
    expect(first.restore).toHaveBeenCalledOnce();
    expect(second.restore).toHaveBeenCalledOnce();
  });

  it("remembers Gmail identities without storing credentials and asks to reconnect after reload", async () => {
    const google = connection("personal@gmail.com");
    const microsoft = connection("work@outlook.com", "microsoft");
    storage.set(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        accounts: [google.account, microsoft.account],
        activeAccountId: "all",
      })
    );
    const outlook = Object.assign(connector(microsoft), { account: microsoft.account });
    factories.restore.mockResolvedValueOnce([outlook]);
    await restoreMailAccounts();
    expect(getMailSession()).toMatchObject({
      activeAccountId: "all",
      accounts: [
        {
          connection: { account: google.account, folders: [] },
          status: "error",
          message: "Reconnect Gmail to read this account.",
        },
        { connector: outlook, status: "connected" },
      ],
    });
    const remembered = JSON.parse(storage.get(STORAGE_KEY)!);
    expect(remembered.accounts).toEqual([google.account, microsoft.account]);
    expect(storage.get(STORAGE_KEY)).not.toContain("token");
    expect(storage.get(STORAGE_KEY)).not.toContain("folders");
  });

  it("ignores a restore result after reset and handles unavailable storage", async () => {
    const mailbox = connection("work@outlook.com", "microsoft");
    const cached = connector(mailbox);
    const loading = deferred<MailConnection | null>();
    vi.mocked(cached.restore).mockReturnValueOnce(loading.promise);
    factories.restore.mockResolvedValueOnce([cached]);
    const restoring = restoreMailAccounts();
    await Promise.resolve();
    setMailSession({ status: "disconnected", connection: null });
    loading.resolve(mailbox);
    await restoring;
    expect(getMailSession().accounts).toEqual([]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("Denied");
        },
        setItem: () => {
          throw new Error("Denied");
        },
        removeItem: () => {
          throw new Error("Denied");
        },
      },
    });
    expect(() => registerMailAccount(cached, mailbox)).not.toThrow();
    expect(getMailSession().connection).toBe(mailbox);
  });

  it("rejects malformed remembered account entries", async () => {
    storage.set(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        accounts: [
          null,
          { id: "invalid", provider: "other" },
          { ...connection("good@gmail.com").account, address: "" },
        ],
      })
    );
    await restoreMailAccounts();
    expect(getMailSession()).toMatchObject({ status: "disconnected", accounts: [] });
  });
});
