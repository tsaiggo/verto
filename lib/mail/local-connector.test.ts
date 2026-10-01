import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalMailConnector } from "./local-connector";
import { createLocalMailStore } from "./local-store";
import { MailRequestError } from "./http";
import type { LocalMailStore } from "./local-types";
import type { MailConnection, MailConnector, MailMessage, MailSyncPage } from "./model";

const scope = "google:opaque-reader-id";
const connection: MailConnection = {
  account: {
    id: "opaque-reader-id",
    provider: "google",
    address: "reader@example.com",
    displayName: "Reader",
  },
  folders: [
    { id: "inbox", name: "Inbox", kind: "inbox" },
    { id: "archive", name: "Archive", kind: "archive" },
    { id: "sent", name: "Sent", kind: "sent" },
  ],
};

function message(id: string, changes: Partial<MailMessage> = {}): MailMessage {
  return {
    id,
    from: "Sender <sender@example.com>",
    to: ["reader@example.com"],
    subject: `Subject ${id}`,
    receivedAt: "2026-10-01T08:00:00.000Z",
    preview: "A short preview",
    bodyText: `Complete saved body for ${id}`,
    isRead: false,
    hasAttachments: false,
    ...changes,
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

function provider() {
  const syncFolder = vi
    .fn<NonNullable<MailConnector["syncFolder"]>>()
    .mockResolvedValue({ messages: [], cursor: "provider-cursor" });
  const listMessages = vi.fn<MailConnector["listMessages"]>().mockResolvedValue({ messages: [] });
  const getMessage = vi
    .fn<MailConnector["getMessage"]>()
    .mockImplementation(async (id) => message(id));
  const disconnect = vi.fn<MailConnector["disconnect"]>().mockResolvedValue();
  const enableSending = vi.fn<NonNullable<MailConnector["enableSending"]>>().mockResolvedValue();
  const sendMessage = vi.fn<NonNullable<MailConnector["sendMessage"]>>().mockResolvedValue();
  const remote: MailConnector = {
    id: "google",
    label: "Gmail",
    isConfigured: () => true,
    connect: vi.fn(async () => {}),
    restore: vi.fn(async () => connection),
    disconnect,
    syncFolder,
    listMessages,
    getMessage,
    enableSending,
    sendMessage,
  };
  return { remote, syncFolder, listMessages, getMessage, disconnect, enableSending, sendMessage };
}

const outgoing = {
  to: ["friend@example.com"],
  cc: [],
  bcc: [],
  subject: "Hello",
  bodyText: "Message",
};

describe("local mailbox connector integration", () => {
  let store: LocalMailStore;
  let network: { onLine: boolean };

  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    network = { onLine: true };
    vi.stubGlobal("navigator", network);
    store = createLocalMailStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns the first stored page while full-body initial sync continues with a durable checkpoint", async () => {
    const remote = provider();
    const last = deferred<MailSyncPage>();
    remote.syncFolder
      .mockResolvedValueOnce({
        reset: true,
        messages: [message("first", { bodyText: "Only in full body: 开发计划 café" })],
        nextPageUrl: "provider:page-2",
      })
      .mockReturnValueOnce(last.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const local = connector.local!;
    const changed = vi.fn();
    const unsubscribe = local.subscribe(changed);

    const first = await connector.listMessages("inbox");
    expect(first.messages.map((item) => item.id)).toEqual(["first"]);
    await vi.waitFor(() => expect(remote.syncFolder).toHaveBeenCalledTimes(2));
    expect(remote.syncFolder.mock.calls).toEqual([
      ["inbox", { cursor: undefined, pageUrl: undefined }],
      ["inbox", { cursor: undefined, pageUrl: "provider:page-2" }],
    ]);
    expect(await store.getFolder(scope, "inbox")).toMatchObject({
      messageIds: ["first"],
      replacementIds: ["first"],
      nextPageUrl: "provider:page-2",
    });
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBeUndefined();
    expect((await store.getFolder(scope, "inbox"))?.lastSyncedAt).toBeUndefined();
    expect(local.getStatus("inbox")).toMatchObject({ phase: "syncing", count: 1 });
    expect((await connector.getMessage("first")).bodyText).toContain("开发计划");
    expect((await local.search("inbox", "开发计划 cafe")).messages.map((item) => item.id)).toEqual([
      "first",
    ]);
    expect(remote.getMessage).not.toHaveBeenCalled();

    const completed = local.synchronize("inbox");
    last.resolve({ messages: [message("last")], cursor: "complete-cursor" });
    await completed;
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual(["first", "last"]);
    expect(await store.getFolder(scope, "inbox")).toMatchObject({
      cursor: "complete-cursor",
      lastSyncedAt: expect.any(Number),
    });
    expect(await store.getFolder(scope, "inbox")).not.toHaveProperty("nextPageUrl");
    expect(local.getStatus("inbox")).toMatchObject({ phase: "idle", count: 2 });
    expect(changed).toHaveBeenCalled();
    unsubscribe();
  });

  it("resumes the provider continuation and committed cursor after reopening a partial replacement", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("old")],
      cursor: "previous-round",
    });
    await store.applySyncPage(scope, "inbox", {
      reset: true,
      messages: [message("downloaded")],
      nextPageUrl: "provider:resume",
    });
    const reopened = createLocalMailStore();
    const remote = provider();
    remote.syncFolder.mockResolvedValueOnce({
      messages: [message("last")],
      cursor: "resumed-round",
    });
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store: reopened,
    });
    await connector.local!.synchronize("inbox");

    expect(remote.syncFolder).toHaveBeenCalledWith("inbox", {
      cursor: "previous-round",
      pageUrl: "provider:resume",
    });
    expect((await reopened.getFolder(scope, "inbox"))?.messageIds).toEqual(["downloaded", "last"]);
    expect((await reopened.getFolder(scope, "inbox"))?.cursor).toBe("resumed-round");
    expect((await reopened.getMessage(scope, "downloaded"))?.bodyText).toContain(
      "Complete saved body"
    );
  });

  it("returns cached mail immediately while a background delta updates bodies, flags, and deletions", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("cached"), message("deleted")],
      cursor: "old-cursor",
    });
    const remote = provider();
    const delta = deferred<MailSyncPage>();
    remote.syncFolder.mockReturnValueOnce(delta.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const first = await connector.listMessages("inbox");
    expect(first.messages.map((item) => item.id)).toEqual(["cached", "deleted"]);
    await vi.waitFor(() =>
      expect(remote.syncFolder).toHaveBeenCalledWith("inbox", {
        cursor: "old-cursor",
        pageUrl: undefined,
      })
    );
    expect((await connector.getMessage("cached")).bodyText).toBe("Complete saved body for cached");

    const completed = connector.local!.synchronize("inbox");
    delta.resolve({
      messages: [
        message("cached", { isRead: true, bodyText: "Updated body delta" }),
        message("new"),
      ],
      removedIds: ["deleted"],
      cursor: "new-cursor",
    });
    await completed;
    expect((await connector.listMessages("inbox")).messages.map((item) => item.id)).toEqual([
      "cached",
      "new",
    ]);
    expect(await connector.getMessage("cached")).toMatchObject({
      isRead: true,
      bodyText: "Updated body delta",
    });
    expect(
      (await connector.local!.search("inbox", "", true)).messages.map((item) => item.id)
    ).toEqual(["new"]);
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("new-cursor");
    expect(remote.syncFolder).toHaveBeenCalledOnce();
    expect(remote.getMessage).not.toHaveBeenCalled();
  });

  it("reads and searches complete saved mail offline across folders without provider requests", async () => {
    await store.saveMessages(scope, "inbox", [
      message("cached", {
        bodyText: "Offline full body: déjà vu 开发方案",
        preview: "No keywords",
      }),
    ]);
    await store.saveMessages(scope, "archive", [
      message("archived", { bodyText: "Offline full body archive", isRead: true }),
    ]);
    network.onLine = false;
    const remote = provider();
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });

    expect((await connector.listMessages("inbox")).messages.map((item) => item.id)).toEqual([
      "cached",
    ]);
    expect((await connector.getMessage("cached")).bodyText).toContain("déjà vu 开发方案");
    expect(
      (await connector.local!.search(undefined, "offline full body")).messages.map(
        (item) => item.id
      )
    ).toEqual(["archived", "cached"]);
    expect(
      (await connector.local!.search("inbox", "DEJA 开发方案", true)).messages.map(
        (item) => item.id
      )
    ).toEqual(["cached"]);
    expect(await connector.restore()).toEqual(connection);
    expect(connector.local!.getStatus("inbox")).toMatchObject({ phase: "offline", count: 1 });
    await expect(connector.getMessage("not-saved")).rejects.toThrow("offline");
    await expect(connector.local!.synchronize("inbox")).rejects.toThrow("offline");
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("offline");
    expect(remote.syncFolder).not.toHaveBeenCalled();
    expect(remote.listMessages).not.toHaveBeenCalled();
    expect(remote.getMessage).not.toHaveBeenCalled();
    expect(remote.remote.restore).not.toHaveBeenCalled();
    expect(remote.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps the committed cursor and cached body when a sync transaction fails, then allows retry", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("saved")],
      cursor: "committed",
    });
    const remote = provider();
    remote.syncFolder.mockResolvedValue({
      messages: [message("saved", { bodyText: "Must roll back" }), message("new")],
      cursor: "next-cursor",
    });
    const authentication = vi.fn();
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store,
      onAuthenticationError: authentication,
    });
    const originalPut = FakeObjectStore.prototype.put;
    const put = vi.spyOn(FakeObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.name === "folders" && value.cursor === "next-cursor")
        throw new DOMException("Local mail quota exceeded", "QuotaExceededError");
      return originalPut.call(this, value, key);
    });

    await expect(connector.local!.synchronize("inbox")).rejects.toThrow("quota exceeded");
    put.mockRestore();
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("committed");
    expect((await store.getMessage(scope, "saved"))?.bodyText).toBe(
      "Complete saved body for saved"
    );
    expect(await store.getMessage(scope, "new")).toBeUndefined();
    expect(connector.local!.getStatus("inbox")).toMatchObject({
      phase: "error",
      count: 1,
      message: "Local mail quota exceeded",
    });
    expect(authentication).not.toHaveBeenCalled();

    await connector.local!.synchronize("inbox");
    expect(
      remote.syncFolder.mock.calls.every(([, request]) => request?.cursor === "committed")
    ).toBe(true);
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("next-cursor");
    expect(connector.local!.getStatus("inbox")).toMatchObject({ phase: "idle", count: 2 });
  });

  it("keeps saved mail after disconnect while syncing and sending require reconnection", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    await connector.disconnect();

    expect(remote.disconnect).toHaveBeenCalledOnce();
    expect((await connector.listMessages("inbox")).messages.map((item) => item.id)).toEqual([
      "saved",
    ]);
    expect((await connector.getMessage("saved")).bodyText).toContain("Complete saved body");
    expect(
      (await connector.local!.search(undefined, "saved")).messages.map((item) => item.id)
    ).toEqual(["saved"]);
    expect(await store.getConnection(scope)).toEqual(connection);
    expect(connector.local!.getStatus("inbox")).toMatchObject({ phase: "offline", count: 1 });
    await expect(connector.local!.synchronize("inbox")).rejects.toThrow("Reconnect");
    await expect(connector.enableSending!()).rejects.toThrow("Reconnect");
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("Reconnect");
    expect(remote.syncFolder).not.toHaveBeenCalled();
    expect(remote.getMessage).not.toHaveBeenCalled();
    expect(remote.enableSending).not.toHaveBeenCalled();
    expect(remote.sendMessage).not.toHaveBeenCalled();
  });

  it("reports authentication failure once and leaves saved mail readable", async () => {
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const failure = Object.assign(new Error("Session expired; sign in again"), { status: 401 });
    remote.syncFolder.mockRejectedValue(failure);
    const authentication = vi.fn();
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store,
      onAuthenticationError: authentication,
    });

    await expect(connector.local!.synchronize("inbox")).rejects.toBe(failure);
    expect(authentication).toHaveBeenCalledExactlyOnceWith(failure);
    expect(connector.local!.getStatus("inbox")).toMatchObject({
      phase: "offline",
      count: 1,
      message: failure.message,
    });
    expect((await connector.getMessage("saved")).bodyText).toContain("Complete saved body");
    await expect(connector.local!.synchronize("inbox")).rejects.toThrow("Reconnect");
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("Reconnect");
    expect(authentication).toHaveBeenCalledOnce();
    expect(remote.syncFolder).toHaveBeenCalledOnce();
  });

  it("keeps a Gmail quota 403 retryable without treating it as an authentication failure", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("saved")],
      cursor: "committed",
    });
    const remote = provider();
    const quota = new MailRequestError(
      "Mail is receiving too many requests. Try syncing again.",
      403,
      "rateLimitExceeded"
    );
    remote.syncFolder
      .mockRejectedValueOnce(quota)
      .mockResolvedValueOnce({ messages: [message("new")], cursor: "retry-completed" });
    const authentication = vi.fn();
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store,
      onAuthenticationError: authentication,
    });

    await expect(connector.local!.synchronize("inbox")).rejects.toBe(quota);
    expect(connector.local!.getStatus("inbox")).toMatchObject({
      phase: "error",
      count: 1,
      message: quota.message,
    });
    expect(authentication).not.toHaveBeenCalled();
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("committed");

    await connector.local!.synchronize("inbox");
    expect(remote.syncFolder).toHaveBeenCalledTimes(2);
    expect(remote.syncFolder.mock.calls[1]).toEqual([
      "inbox",
      { cursor: "committed", pageUrl: undefined },
    ]);
    expect(connector.local!.getStatus("inbox")).toMatchObject({ phase: "idle", count: 2 });
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("retry-completed");
    expect(authentication).not.toHaveBeenCalled();
  });

  it("invalidates a sibling folder sync after authentication fails so its late page cannot be persisted", async () => {
    await store.applySyncPage(scope, "archive", {
      messages: [message("archived")],
      cursor: "archive-committed",
    });
    const remote = provider();
    const laterPage = deferred<MailSyncPage>();
    const expired = new MailRequestError(
      "Your mail session expired. Reconnect this account.",
      401,
      "authError"
    );
    remote.syncFolder.mockImplementation(async (folderId, request) => {
      if (folderId === "inbox") throw expired;
      if (request?.pageUrl === "archive:page-2") return laterPage.promise;
      return { reset: true, messages: [message("downloaded")], nextPageUrl: "archive:page-2" };
    });
    const authentication = vi.fn();
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store,
      onAuthenticationError: authentication,
    });
    const archiving = connector.local!.synchronize("archive");
    await vi.waitFor(() =>
      expect(remote.syncFolder).toHaveBeenCalledWith("archive", {
        cursor: "archive-committed",
        pageUrl: "archive:page-2",
      })
    );

    await expect(connector.local!.synchronize("inbox")).rejects.toBe(expired);
    expect(authentication).toHaveBeenCalledExactlyOnceWith(expired);
    laterPage.resolve({ messages: [message("late")], cursor: "must-not-commit" });
    await archiving;

    expect(await store.getFolder(scope, "archive")).toMatchObject({
      messageIds: ["archived", "downloaded"],
      replacementIds: ["downloaded"],
      nextPageUrl: "archive:page-2",
      cursor: "archive-committed",
    });
    expect(await store.getMessage(scope, "late")).toBeUndefined();
    expect(connector.local!.getStatus("archive")).toMatchObject({ phase: "offline", count: 2 });
    await expect(connector.local!.synchronize("archive")).rejects.toThrow("Reconnect");
    expect(remote.syncFolder).toHaveBeenCalledTimes(3);
  });

  it("does not restore cleared mail when an in-flight provider sync finishes", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("saved")],
      cursor: "committed",
    });
    const remote = provider();
    const page = deferred<MailSyncPage>();
    remote.syncFolder.mockReturnValue(page.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const running = connector.local!.synchronize("inbox");
    await vi.waitFor(() => expect(remote.syncFolder).toHaveBeenCalledOnce());
    await connector.local!.clear();
    page.resolve({ messages: [message("late")], cursor: "late-cursor" });
    await running;

    expect(await store.getConnection(scope)).toBeUndefined();
    expect(await store.getFolder(scope, "inbox")).toBeUndefined();
    expect((await connector.local!.search(undefined, "")).messages).toEqual([]);
    expect(connector.local!.getStatus("inbox")).toMatchObject({
      count: 0,
      message: "Saved mail cleared.",
    });
  });

  it("does not reinsert delta-moved mail into the previous folder after a transient body read", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("moved")],
      cursor: "before-move",
    });
    const remote = provider();
    remote.syncFolder.mockResolvedValue({
      messages: [],
      removedIds: ["moved"],
      cursor: "after-move",
    });
    remote.getMessage.mockResolvedValue(
      message("moved", { bodyText: "Provider body remains readable after moving folders" })
    );
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    expect((await connector.listMessages("inbox")).messages.map((item) => item.id)).toEqual([
      "moved",
    ]);
    await connector.local!.synchronize("inbox");
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual([]);

    expect((await connector.getMessage("moved")).bodyText).toContain("after moving folders");
    expect(remote.getMessage).toHaveBeenCalledExactlyOnceWith("moved");
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual([]);
    expect(await store.getMessage(scope, "moved")).toBeUndefined();
    expect((await connector.local!.search("inbox", "")).messages).toEqual([]);
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("after-move");
  });

  it("does not restore cleared mail when an in-flight provider body read finishes", async () => {
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const body = deferred<MailMessage>();
    remote.getMessage.mockReturnValue(body.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const running = connector.getMessage("uncached");
    await vi.waitFor(() => expect(remote.getMessage).toHaveBeenCalledWith("uncached"));
    await connector.local!.clear();
    body.resolve(message("uncached"));
    await expect(running).rejects.toThrow("Saved mail changed");

    expect(await store.getConnection(scope)).toBeUndefined();
    expect(await store.getFolder(scope, "inbox")).toBeUndefined();
    expect(await store.getMessage(scope, "uncached")).toBeUndefined();
    expect((await store.search(scope, { query: "" })).messages).toEqual([]);
  });

  it("serializes clear after an already-entered sync write so pending persistence cannot resurrect mail", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("saved")],
      cursor: "committed",
    });
    const entered = deferred<void>();
    const release = deferred<void>();
    const originalApply = store.applySyncPage.bind(store);
    vi.spyOn(store, "applySyncPage").mockImplementation(async (...args) => {
      entered.resolve();
      await release.promise;
      await originalApply(...args);
    });
    const remote = provider();
    remote.syncFolder.mockResolvedValue({ messages: [message("late")], cursor: "late-cursor" });
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const syncing = connector.local!.synchronize("inbox");
    await entered.promise;
    const clearing = connector.local!.clear();
    // Complete an IndexedDB read while the write is paused so an unguarded clear
    // would reach storage before the delayed sync resumes.
    await store.getConnection(scope);
    release.resolve();
    await Promise.all([syncing, clearing]);

    expect(await store.getConnection(scope)).toBeUndefined();
    expect(await store.getFolder(scope, "inbox")).toBeUndefined();
    expect((await store.search(scope, { query: "" })).messages).toEqual([]);
    expect(connector.local!.getStatus("inbox")).toMatchObject({
      count: 0,
      message: "Saved mail cleared.",
    });
  });

  it("shares the write queue across replacement wrappers so clear waits for an entered old write", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("saved")],
      cursor: "committed",
    });
    const entered = deferred<void>();
    const release = deferred<void>();
    const originalApply = store.applySyncPage.bind(store);
    vi.spyOn(store, "applySyncPage").mockImplementation(async (...args) => {
      entered.resolve();
      await release.promise;
      await originalApply(...args);
    });
    const oldProvider = provider();
    oldProvider.syncFolder.mockResolvedValue({
      messages: [message("late-old-write")],
      cursor: "old-write-cursor",
    });
    const old = createLocalMailConnector(oldProvider.remote, connection, { scope, store });
    const syncing = old.local!.synchronize("inbox");
    await entered.promise;
    old.local!.invalidate!();

    const replacementProvider = provider();
    const replacement = createLocalMailConnector(replacementProvider.remote, connection, {
      scope,
      store,
    });
    const cleared = vi.fn();
    const clearing = replacement.local!.clear().then(cleared);
    await store.getConnection(scope);
    expect(cleared).not.toHaveBeenCalled();
    release.resolve();
    await Promise.all([syncing, clearing]);

    expect(cleared).toHaveBeenCalledOnce();
    expect(await store.getConnection(scope)).toBeUndefined();
    expect(await store.getFolder(scope, "inbox")).toBeUndefined();
    expect((await replacement.local!.search(undefined, "")).messages).toEqual([]);
    expect(await store.getMessage(scope, "late-old-write")).toBeUndefined();
    expect(replacement.local!.getStatus("inbox")).toMatchObject({
      count: 0,
      message: "Saved mail cleared.",
    });
    expect(replacementProvider.syncFolder).not.toHaveBeenCalled();
  });

  it("uses strict local pagination for saved list and full-body search", async () => {
    await store.saveMessages(
      scope,
      "inbox",
      Array.from({ length: 53 }, (_, index) =>
        message(`id-${String(index).padStart(2, "0")}`, { bodyText: "Searchable complete body" })
      )
    );
    const remote = provider();
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store,
      connected: false,
    });
    const first = await connector.listMessages("inbox");
    expect(first.messages).toHaveLength(50);
    expect(first.nextPageUrl).toBe("local:50");
    const last = await connector.listMessages("inbox", first.nextPageUrl);
    expect(last.messages.map((item) => item.id)).toEqual(["id-50", "id-51", "id-52"]);
    expect(last.nextPageUrl).toBeUndefined();
    const search = await connector.local!.search(undefined, "complete body");
    expect(search.nextPageUrl).toBe("local:50");
    expect(
      await connector.local!.search(undefined, "complete body", false, search.nextPageUrl)
    ).toEqual(last);

    for (const invalid of [
      "provider:next",
      "local:-1",
      "local:1.5",
      "local:",
      "local:Infinity",
      "local:9007199254740992",
      " local:50",
    ]) {
      await expect(connector.listMessages("inbox", invalid)).rejects.toThrow();
      await expect(async () =>
        connector.local!.search(undefined, "", false, invalid)
      ).rejects.toThrow();
    }
    expect(remote.syncFolder).not.toHaveBeenCalled();
    expect(remote.listMessages).not.toHaveBeenCalled();
  });

  it("downloads full message bodies for a legacy connector without a delta API", async () => {
    const remote = provider();
    delete remote.remote.syncFolder;
    remote.listMessages
      .mockResolvedValueOnce({ messages: [message("first")], nextPageUrl: "legacy:page-2" })
      .mockResolvedValueOnce({ messages: [message("last")] });
    remote.getMessage.mockImplementation(async (id) =>
      message(id, { bodyText: `Full downloaded body ${id}` })
    );
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    await connector.local!.synchronize("inbox");

    expect(remote.listMessages.mock.calls).toEqual([
      ["inbox", undefined],
      ["inbox", "legacy:page-2"],
    ]);
    expect(remote.getMessage.mock.calls).toEqual([["first"], ["last"]]);
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual(["first", "last"]);
    network.onLine = false;
    expect((await connector.getMessage("last")).bodyText).toBe("Full downloaded body last");
    expect((await connector.local!.search("inbox", "downloaded body")).messages).toHaveLength(2);
    expect(remote.getMessage).toHaveBeenCalledTimes(2);
  });
});
