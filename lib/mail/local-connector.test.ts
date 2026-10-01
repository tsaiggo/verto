import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalMailConnector } from "./local-connector";
import { createLocalMailStore } from "./local-store";
import { MailRequestError } from "./http";
import type { LocalMailStore, LocalMailVersion } from "./local-types";
import type {
  MailConnection,
  MailConnector,
  MailMessage,
  MailMutationResult,
  MailSyncPage,
} from "./model";

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
  const enableUpdating = vi.fn<NonNullable<MailConnector["enableUpdating"]>>().mockResolvedValue();
  const mutateMessage = vi
    .fn<NonNullable<MailConnector["mutateMessage"]>>()
    .mockImplementation(async (id) => ({ message: message(id), folderIds: ["inbox"] }));
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
    enableUpdating,
    mutateMessage,
  };
  return {
    remote,
    syncFolder,
    listMessages,
    getMessage,
    disconnect,
    enableSending,
    sendMessage,
    enableUpdating,
    mutateMessage,
  };
}

const outgoing = {
  to: ["friend@example.com"],
  cc: [],
  bcc: [],
  subject: "Hello",
  bodyText: "Message",
};

interface LibraryChange {
  scope: string;
  type: "mutation" | "clear";
  version: LocalMailVersion;
  source: string;
}

class FakeBroadcastChannel extends EventTarget {
  static instances: FakeBroadcastChannel[] = [];
  readonly sent: LibraryChange[] = [];
  closed = false;
  onmessage: ((event: MessageEvent<LibraryChange>) => void) | null = null;
  readonly postMessage = vi.fn((change: LibraryChange) => {
    this.sent.push(structuredClone(change));
  });
  readonly close = vi.fn(() => {
    this.closed = true;
  });

  constructor(readonly name: string) {
    super();
    FakeBroadcastChannel.instances.push(this);
  }

  receive(change: LibraryChange) {
    if (this.closed) return;
    const event = new MessageEvent("message", { data: change });
    this.onmessage?.(event);
    this.dispatchEvent(event);
  }
}

function deliverLibraryChange(change: LibraryChange) {
  for (const channel of FakeBroadcastChannel.instances)
    if (channel.name === "verto.mail.library.changes") channel.receive(change);
}

function publishedLibraryChanges() {
  return FakeBroadcastChannel.instances.flatMap((channel) => channel.sent);
}

describe("local mailbox connector integration", () => {
  let store: LocalMailStore;
  let network: { onLine: boolean };

  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    vi.stubGlobal("window", new EventTarget());
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

    expect(await store.getConnection(scope)).toEqual(connection);
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

    expect(await store.getConnection(scope)).toEqual(connection);
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

    expect(await store.getConnection(scope)).toEqual(connection);
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
    expect(await store.getConnection(scope)).toEqual(connection);
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

  it("requires a live online account for updates and forwards owner-specific permission requests", async () => {
    const remote = provider();
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    await connector.enableUpdating!("owner-message");
    expect(remote.enableUpdating).toHaveBeenCalledExactlyOnceWith("owner-message");
    network.onLine = false;
    await expect(
      connector.mutateMessage!("message", { type: "read", value: true })
    ).rejects.toThrow("offline");
    await expect(connector.enableUpdating!("message")).rejects.toThrow("offline");
    network.onLine = true;
    await connector.disconnect();
    await expect(connector.mutateMessage!("message", { type: "trash" })).rejects.toThrow(
      "Reconnect"
    );
    expect(remote.mutateMessage).not.toHaveBeenCalled();
  });

  it("stores flags and new Graph membership only after one confirmed server mutation", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("original")]);
    const remote = provider();
    const confirmed = deferred<MailMutationResult>();
    remote.mutateMessage.mockReturnValue(confirmed.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const updating = connector.mutateMessage!("original", { type: "archive" });
    await vi.waitFor(() => expect(remote.mutateMessage).toHaveBeenCalledOnce());
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual(["original"]);
    expect((await connector.getMessage("original")).isRead).toBe(false);
    confirmed.resolve({
      message: message("moved", { isRead: true, isStarred: true }),
      folderIds: ["archive"],
    });
    expect(await updating).toMatchObject({ message: { id: "moved", isStarred: true } });
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual([]);
    expect((await store.getFolder(scope, "archive"))?.messageIds).toEqual(["moved"]);
    expect(await connector.getMessage("moved")).toMatchObject({ isRead: true, isStarred: true });
    expect(await connector.local!.getConnection!()).toEqual(await store.getConnection(scope));
    expect(remote.mutateMessage).toHaveBeenCalledExactlyOnceWith("original", { type: "archive" });
  });

  it("blocks another store's same-message provider action while different-message updates remain parallel", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved"), message("other")]);
    const remote = provider();
    const confirmed = deferred<MailMutationResult>();
    const firstResult = {
      message: message("saved", { isRead: true, isStarred: false }),
      folderIds: ["inbox"],
    };
    remote.mutateMessage.mockReturnValueOnce(confirmed.promise);
    const first = createLocalMailConnector(remote.remote, connection, { scope, store });
    const otherStore = createLocalMailStore();
    const other = provider();
    other.mutateMessage.mockImplementation(async (id) => ({
      message: message(id, { isRead: id === "saved", isStarred: true }),
      folderIds: ["inbox"],
    }));
    const second = createLocalMailConnector(other.remote, connection, { scope, store: otherStore });
    const updating = first.mutateMessage!("saved", { type: "read", value: true });

    try {
      await vi.waitFor(() => expect(remote.mutateMessage).toHaveBeenCalledOnce());
      await expect(second.mutateMessage!("saved", { type: "star", value: true })).rejects.toThrow(
        "being updated in another mail window"
      );
      expect(other.mutateMessage).not.toHaveBeenCalled();
      await second.mutateMessage!("other", { type: "star", value: true });
      expect(other.mutateMessage).toHaveBeenCalledExactlyOnceWith("other", {
        type: "star",
        value: true,
      });
      expect(await otherStore.getMessage(scope, "other")).toMatchObject({ isStarred: true });
      expect(await otherStore.getMessage(scope, "saved")).toMatchObject({ isRead: false });
      confirmed.resolve(firstResult);
      await updating;
      expect(await second.getMessage("saved")).toMatchObject({ isRead: true, isStarred: false });
      await second.mutateMessage!("saved", { type: "star", value: true });
      expect(other.mutateMessage).toHaveBeenCalledTimes(2);
      expect(other.mutateMessage.mock.calls[1]).toEqual(["saved", { type: "star", value: true }]);
      expect(await first.getMessage("saved")).toMatchObject({ isRead: true, isStarred: true });
    } finally {
      confirmed.resolve(firstResult);
      await updating.catch(() => undefined);
    }
  });

  it("releases a failed provider action so another store can retry the same message", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const response = deferred<MailMutationResult>();
    remote.mutateMessage.mockReturnValueOnce(response.promise);
    const first = createLocalMailConnector(remote.remote, connection, { scope, store });
    const other = provider();
    other.mutateMessage.mockResolvedValueOnce({
      message: message("saved", { isRead: true, isStarred: true }),
      folderIds: ["inbox"],
    });
    const second = createLocalMailConnector(other.remote, connection, {
      scope,
      store: createLocalMailStore(),
    });
    const failure = new MailRequestError("Rate limited", 403, "rateLimitExceeded");
    const updating = first.mutateMessage!("saved", { type: "read", value: true });
    const failed = expect(updating).rejects.toBe(failure);

    try {
      await vi.waitFor(() => expect(remote.mutateMessage).toHaveBeenCalledOnce());
      await expect(second.mutateMessage!("saved", { type: "star", value: true })).rejects.toThrow(
        "being updated in another mail window"
      );
      expect(other.mutateMessage).not.toHaveBeenCalled();
      response.reject(failure);
      await failed;
      expect(await store.getMessage(scope, "saved")).toMatchObject({ isRead: false });
      await second.mutateMessage!("saved", { type: "star", value: true });
      expect(other.mutateMessage).toHaveBeenCalledExactlyOnceWith("saved", {
        type: "star",
        value: true,
      });
      expect(await store.getMessage(scope, "saved")).toMatchObject({
        isRead: true,
        isStarred: true,
      });
    } finally {
      response.reject(failure);
      await updating.catch(() => undefined);
    }
  });

  it("retains a pending action's claim across clear until its stale provider result settles", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const response = deferred<MailMutationResult>();
    const staleResult = { message: message("saved"), folderIds: ["inbox"] };
    remote.mutateMessage.mockReturnValueOnce(response.promise);
    const first = createLocalMailConnector(remote.remote, connection, { scope, store });
    const other = provider();
    other.mutateMessage.mockResolvedValueOnce({
      message: message("saved", { isRead: true, isStarred: true, bodyText: "Fresh owner result" }),
      folderIds: ["inbox"],
    });
    const otherStore = createLocalMailStore();
    const second = createLocalMailConnector(other.remote, connection, { scope, store: otherStore });
    const updating = first.mutateMessage!("saved", { type: "read", value: true });
    const rejected = expect(updating).rejects.toThrow(/Saved mail changed|updated on the provider/);

    try {
      await vi.waitFor(() => expect(remote.mutateMessage).toHaveBeenCalledOnce());
      await second.local!.clear();
      await expect(second.mutateMessage!("saved", { type: "star", value: true })).rejects.toThrow(
        "being updated in another mail window"
      );
      expect(other.mutateMessage).not.toHaveBeenCalled();
      response.resolve(staleResult);
      await rejected;
      expect(await otherStore.getMessage(scope, "saved")).toBeUndefined();
      expect((await otherStore.search(scope, { query: "" })).messages).toEqual([]);
      await second.mutateMessage!("saved", { type: "star", value: true });
      expect(other.mutateMessage).toHaveBeenCalledOnce();
      expect(await otherStore.getMessage(scope, "saved")).toMatchObject({
        isRead: true,
        isStarred: true,
        bodyText: "Fresh owner result",
      });
    } finally {
      response.resolve(staleResult);
      await updating.catch(() => undefined);
    }
  });

  it("retains an invalidated action's claim until its provider call settles, then permits another store's retry", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const response = deferred<MailMutationResult>();
    const staleResult = {
      message: message("saved", { isRead: true }),
      folderIds: ["inbox"],
    };
    remote.mutateMessage.mockReturnValueOnce(response.promise);
    const first = createLocalMailConnector(remote.remote, connection, { scope, store });
    const other = provider();
    other.mutateMessage.mockResolvedValueOnce({
      message: message("saved", { isRead: true, isStarred: true }),
      folderIds: ["inbox"],
    });
    const second = createLocalMailConnector(other.remote, connection, {
      scope,
      store: createLocalMailStore(),
    });
    const updating = first.mutateMessage!("saved", { type: "read", value: true });
    const rejected = expect(updating).rejects.toThrow("Saved mail changed");

    try {
      await vi.waitFor(() => expect(remote.mutateMessage).toHaveBeenCalledOnce());
      first.local!.invalidate!();
      await expect(second.mutateMessage!("saved", { type: "star", value: true })).rejects.toThrow(
        "being updated in another mail window"
      );
      expect(other.mutateMessage).not.toHaveBeenCalled();
      response.resolve(staleResult);
      await rejected;
      expect(await store.getMessage(scope, "saved")).toMatchObject({ isRead: false });
      await second.mutateMessage!("saved", { type: "star", value: true });
      expect(other.mutateMessage).toHaveBeenCalledOnce();
      expect(await store.getMessage(scope, "saved")).toMatchObject({
        isRead: true,
        isStarred: true,
      });
    } finally {
      response.resolve(staleResult);
      await updating.catch(() => undefined);
    }
  });

  it("rejects provider failures and reports confirmed actions whose cache write fails without optimistic changes", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    remote.mutateMessage.mockRejectedValueOnce(
      new MailRequestError("Rate limited", 403, "rateLimitExceeded")
    );
    const authentication = vi.fn();
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store,
      onAuthenticationError: authentication,
    });
    await expect(connector.mutateMessage!("saved", { type: "read", value: true })).rejects.toThrow(
      "Rate limited"
    );
    expect((await connector.getMessage("saved")).isRead).toBe(false);
    expect(authentication).not.toHaveBeenCalled();
    const failingWrite = vi
      .spyOn(store, "applyMutation")
      .mockRejectedValueOnce(new DOMException("Quota exceeded", "QuotaExceededError"));
    remote.mutateMessage.mockResolvedValueOnce({
      message: message("saved", { isRead: true }),
      folderIds: ["inbox"],
    });
    await expect(connector.mutateMessage!("saved", { type: "read", value: true })).rejects.toThrow(
      "updated on the provider"
    );
    expect(remote.mutateMessage).toHaveBeenCalledTimes(2);
    expect((await store.getMessage(scope, "saved"))?.isRead).toBe(false);
    expect(connector.local!.getStatus("inbox")).toMatchObject({
      phase: "error",
      message: expect.stringContaining("Quota exceeded"),
    });
    failingWrite.mockRestore();
  });

  it("prevents a pre-mutation sync page from restoring removed membership or old flags", async () => {
    await store.applySyncPage(scope, "inbox", {
      messages: [message("updated")],
      cursor: "committed",
    });
    const remote = provider();
    const stale = deferred<MailSyncPage>();
    remote.syncFolder.mockReturnValue(stale.promise);
    remote.mutateMessage.mockResolvedValue({
      message: message("updated", { isRead: true, isStarred: true }),
      folderIds: ["archive"],
    });
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const syncing = connector.local!.synchronize("inbox");
    await vi.waitFor(() => expect(remote.syncFolder).toHaveBeenCalledOnce());
    await connector.mutateMessage!("updated", { type: "archive" });
    stale.resolve({ messages: [message("updated")], cursor: "stale-cursor" });
    await syncing;
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual([]);
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("committed");
    expect(await store.getMessage(scope, "updated")).toMatchObject({
      isRead: true,
      isStarred: true,
    });
  });

  it("guards another store instance's in-flight sync and mutation against clearing", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const page = deferred<MailSyncPage>();
    const action = deferred<MailMutationResult>();
    remote.syncFolder.mockReturnValue(page.promise);
    remote.mutateMessage.mockReturnValue(action.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const syncing = connector.local!.synchronize("inbox");
    const mutating = connector.mutateMessage!("saved", { type: "star", value: true });
    const mutationFailed = expect(mutating).rejects.toThrow("updated on the provider");
    await vi.waitFor(() => {
      expect(remote.syncFolder).toHaveBeenCalledOnce();
      expect(remote.mutateMessage).toHaveBeenCalledOnce();
    });
    const secondStore = createLocalMailStore();
    await secondStore.clearAccount(scope);
    page.resolve({ messages: [message("stale")], cursor: "stale-cursor" });
    action.resolve({ message: message("saved", { isStarred: true }), folderIds: ["inbox"] });
    await Promise.all([syncing, mutationFailed]);
    expect((await secondStore.search(scope, { query: "" })).messages).toEqual([]);
    expect(await secondStore.getConnection(scope)).toEqual(connection);
  });

  it("rejects another wrapper's pre-action snapshot using the durable sync revision", async () => {
    await store.saveConnection(scope, connection);
    await store.applySyncPage(scope, "inbox", {
      messages: [message("saved")],
      cursor: "committed",
    });
    const remote = provider();
    const page = deferred<MailSyncPage>();
    remote.syncFolder.mockReturnValue(page.promise);
    const original = createLocalMailConnector(remote.remote, connection, { scope, store });
    const syncing = original.local!.synchronize("inbox");
    const rejected = expect(syncing).rejects.toThrow("Saved mail changed");
    await vi.waitFor(() => expect(remote.syncFolder).toHaveBeenCalledOnce());
    const other = provider();
    other.mutateMessage.mockResolvedValue({
      message: message("saved", { isRead: true, isStarred: true }),
      folderIds: ["inbox"],
    });
    const replacement = createLocalMailConnector(other.remote, connection, {
      scope,
      store: createLocalMailStore(),
    });
    await replacement.mutateMessage!("saved", { type: "star", value: true });
    page.resolve({ messages: [message("saved")], cursor: "stale-cursor" });
    await rejected;
    expect(await store.getMessage(scope, "saved")).toMatchObject({ isRead: true, isStarred: true });
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("committed");
  });

  it("keeps read access after update consent and capability-specific forbidden responses", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const authentication = vi.fn();
    remote.enableUpdating.mockRejectedValueOnce(
      new Error("Mail update permission was not granted.")
    );
    remote.mutateMessage.mockRejectedValueOnce(
      new MailRequestError("Mail update permission was denied.", 403, "insufficientPermissions")
    );
    const connector = createLocalMailConnector(remote.remote, connection, {
      scope,
      store,
      onAuthenticationError: authentication,
    });
    await expect(connector.enableUpdating!("saved")).rejects.toThrow("update permission");
    await expect(connector.mutateMessage!("saved", { type: "read", value: true })).rejects.toThrow(
      "update permission"
    );
    expect(authentication).not.toHaveBeenCalled();
    expect((await connector.getMessage("saved")).bodyText).toContain("Complete saved body");
    await connector.local!.synchronize("inbox");
    expect(remote.syncFolder).toHaveBeenCalledOnce();
  });

  it("publishes committed mutation and clear versions and refreshes a sibling store without BroadcastChannel delivery", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const confirmed = deferred<MailMutationResult>();
    remote.mutateMessage.mockReturnValueOnce(confirmed.promise);
    const writer = createLocalMailConnector(remote.remote, connection, { scope, store });
    const reader = createLocalMailConnector(provider().remote, connection, {
      scope,
      store: createLocalMailStore(),
      connected: false,
    });
    const stopWriter = writer.local!.subscribe(vi.fn());
    const stopReader = reader.local!.subscribe(vi.fn());

    try {
      expect(FakeBroadcastChannel.instances.map((channel) => channel.name)).toEqual([
        "verto.mail.library.changes",
        "verto.mail.library.changes",
      ]);
      await reader.listMessages("inbox");
      expect(reader.local!.getStatus("inbox").count).toBe(1);
      const updating = writer.mutateMessage!("saved", { type: "archive" });
      await vi.waitFor(() => expect(remote.mutateMessage).toHaveBeenCalledOnce());
      expect(publishedLibraryChanges()).toEqual([]);
      confirmed.resolve({
        message: message("saved", { isRead: true, isStarred: true }),
        folderIds: ["archive"],
      });
      await updating;
      const mutationVersion = await store.getVersion(scope);
      const changes = publishedLibraryChanges();
      expect(changes).toEqual([
        { scope, type: "mutation", version: mutationVersion, source: expect.any(String) },
      ]);
      expect(Object.keys(changes[0]).sort()).toEqual(["scope", "source", "type", "version"]);
      await vi.waitFor(() => {
        expect(reader.local!.getStatus("inbox").count).toBe(0);
        expect(reader.local!.getStatus("archive").count).toBe(1);
      });
      expect(await reader.getMessage("saved")).toMatchObject({ isRead: true, isStarred: true });
      await writer.local!.clear();
      expect(publishedLibraryChanges()).toEqual([
        changes[0],
        {
          scope,
          type: "clear",
          version: await store.getVersion(scope),
          source: changes[0].source,
        },
      ]);
      await vi.waitFor(() =>
        expect(reader.local!.getStatus("archive")).toMatchObject({
          count: 0,
          message: "Saved mail cleared.",
        })
      );
    } finally {
      stopWriter();
      stopReader();
    }
    expect(FakeBroadcastChannel.instances.every((channel) => channel.closed)).toBe(true);
  });

  it("receives another runtime's mutation, refreshes counts and metadata, and rejects pre-event detail and sync results", async () => {
    const countedConnection = {
      ...connection,
      folders: connection.folders.map((folder) => ({
        ...folder,
        unreadCount: folder.id === "inbox" ? 1 : 0,
      })),
    };
    await store.saveConnection(scope, countedConnection);
    await store.applySyncPage(scope, "inbox", {
      messages: [message("saved")],
      cursor: "committed",
    });
    const remote = provider();
    const page = deferred<MailSyncPage>();
    const body = deferred<MailMessage>();
    remote.syncFolder.mockReturnValueOnce(page.promise);
    remote.getMessage.mockReturnValueOnce(body.promise);
    const connector = createLocalMailConnector(remote.remote, countedConnection, { scope, store });
    const changed = vi.fn();
    const unsubscribe = connector.local!.subscribe(changed);

    try {
      const syncing = connector.local!.synchronize("inbox");
      const reading = connector.getMessage("uncached");
      const rejectedDetail = expect(reading).rejects.toThrow("Saved mail changed");
      await vi.waitFor(() => {
        expect(remote.syncFolder).toHaveBeenCalledOnce();
        expect(remote.getMessage).toHaveBeenCalledOnce();
      });
      const otherStore = createLocalMailStore();
      await otherStore.applyMutation(scope, "saved", {
        message: message("saved", { isRead: true, isStarred: true }),
        folderIds: ["archive"],
      });
      changed.mockClear();
      deliverLibraryChange({
        scope,
        type: "mutation",
        version: await otherStore.getVersion(scope),
        source: "another-runtime",
      });
      await vi.waitFor(() => {
        expect(changed).toHaveBeenCalled();
        expect(connector.local!.getStatus("inbox").count).toBe(0);
        expect(connector.local!.getStatus("archive").count).toBe(1);
      });
      expect((await connector.local!.getConnection!())?.folders).toContainEqual({
        id: "inbox",
        name: "Inbox",
        kind: "inbox",
        unreadCount: 0,
      });
      expect((await connector.restore())?.folders).toEqual(
        (await otherStore.getConnection(scope))?.folders
      );
      page.resolve({ messages: [message("saved"), message("late")], cursor: "stale-cursor" });
      body.resolve(message("uncached"));
      await Promise.all([syncing, rejectedDetail]);
      expect((await otherStore.getFolder(scope, "inbox"))?.cursor).toBe("committed");
      expect(await otherStore.getMessage(scope, "late")).toBeUndefined();
      expect(await connector.getMessage("saved")).toMatchObject({ isRead: true, isStarred: true });
      expect(remote.syncFolder).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it("receives clear from another runtime and keeps the cleared cache quiet while stale requests settle", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const page = deferred<MailSyncPage>();
    const body = deferred<MailMessage>();
    remote.syncFolder.mockReturnValueOnce(page.promise);
    remote.getMessage.mockReturnValueOnce(body.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const unsubscribe = connector.local!.subscribe(vi.fn());

    try {
      const syncing = connector.local!.synchronize("inbox");
      const reading = connector.getMessage("uncached");
      const rejectedDetail = expect(reading).rejects.toThrow("Saved mail changed");
      await vi.waitFor(() => {
        expect(remote.syncFolder).toHaveBeenCalledOnce();
        expect(remote.getMessage).toHaveBeenCalledOnce();
      });
      const otherStore = createLocalMailStore();
      await otherStore.clearAccount(scope);
      deliverLibraryChange({
        scope,
        type: "clear",
        version: await otherStore.getVersion(scope),
        source: "another-runtime",
      });
      await vi.waitFor(() =>
        expect(connector.local!.getStatus("inbox")).toEqual({
          phase: "idle",
          count: 0,
          message: "Saved mail cleared.",
        })
      );
      page.resolve({ messages: [message("late")], cursor: "late-cursor" });
      body.resolve(message("uncached"));
      await Promise.all([syncing, rejectedDetail]);
      expect(await connector.listMessages("inbox")).toEqual({ messages: [] });
      expect(await connector.listMessages("inbox")).toEqual({ messages: [] });
      expect((await connector.local!.search(undefined, "")).messages).toEqual([]);
      expect(await otherStore.getFolder(scope, "inbox")).toBeUndefined();
      expect(await otherStore.getMessage(scope, "late")).toBeUndefined();
      expect(connector.local!.getStatus("inbox").message).toBe("Saved mail cleared.");
      expect(remote.syncFolder).toHaveBeenCalledOnce();
    } finally {
      unsubscribe();
    }
  });

  it("ignores another account's notification without invalidating pending provider work", async () => {
    await store.saveConnection(scope, connection);
    const remote = provider();
    const page = deferred<MailSyncPage>();
    const body = deferred<MailMessage>();
    remote.syncFolder.mockReturnValueOnce(page.promise);
    remote.getMessage.mockReturnValueOnce(body.promise);
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const changed = vi.fn();
    const unsubscribe = connector.local!.subscribe(changed);

    try {
      const syncing = connector.local!.synchronize("inbox");
      const reading = connector.getMessage("uncached");
      await vi.waitFor(() => {
        expect(remote.syncFolder).toHaveBeenCalledOnce();
        expect(remote.getMessage).toHaveBeenCalledOnce();
      });
      changed.mockClear();
      deliverLibraryChange({
        scope: "microsoft:other-account",
        type: "clear",
        version: { generation: 10, revision: 50 },
        source: "another-runtime",
      });
      expect(changed).not.toHaveBeenCalled();
      page.resolve({ messages: [message("fresh")], cursor: "fresh-cursor" });
      body.resolve(message("uncached"));
      await expect(reading).resolves.toMatchObject({ id: "uncached" });
      await syncing;
      expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("fresh-cursor");
      expect(await store.getMessage(scope, "fresh")).toMatchObject({ id: "fresh" });
    } finally {
      unsubscribe();
    }
  });

  it("ignores duplicate and out-of-order mutation events for work started after the latest durable revision", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const remote = provider();
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const changed = vi.fn();
    const unsubscribe = connector.local!.subscribe(changed);

    try {
      network.onLine = false;
      await connector.listMessages("inbox");
      const otherStore = createLocalMailStore();
      await otherStore.applyMutation(scope, "saved", {
        message: message("saved", { isRead: true }),
        folderIds: ["inbox"],
      });
      const older = await otherStore.getVersion(scope);
      await otherStore.applyMutation(scope, "saved", {
        message: message("saved", { isRead: true, isStarred: true }),
        folderIds: ["inbox"],
      });
      const latest = await otherStore.getVersion(scope);
      changed.mockClear();
      deliverLibraryChange({
        scope,
        type: "mutation",
        version: latest,
        source: "another-runtime",
      });
      await vi.waitFor(() => expect(changed).toHaveBeenCalled());
      network.onLine = true;
      const page = deferred<MailSyncPage>();
      const body = deferred<MailMessage>();
      remote.syncFolder.mockReturnValueOnce(page.promise);
      remote.getMessage.mockReturnValueOnce(body.promise);
      const syncing = connector.local!.synchronize("inbox");
      const reading = connector.getMessage("uncached");
      await vi.waitFor(() => {
        expect(remote.syncFolder).toHaveBeenCalledOnce();
        expect(remote.getMessage).toHaveBeenCalledOnce();
      });
      changed.mockClear();
      for (const version of [latest, older])
        deliverLibraryChange({ scope, type: "mutation", version, source: "another-runtime" });
      expect(changed).not.toHaveBeenCalled();
      page.resolve({
        messages: [message("saved", { isRead: true, isStarred: true }), message("fresh")],
        cursor: "fresh-cursor",
      });
      body.resolve(message("uncached"));
      await expect(reading).resolves.toMatchObject({ id: "uncached" });
      await syncing;
      expect((await otherStore.getFolder(scope, "inbox"))?.cursor).toBe("fresh-cursor");
      expect(await otherStore.getMessage(scope, "fresh")).toMatchObject({ id: "fresh" });
    } finally {
      unsubscribe();
    }
  });

  it("keeps a standalone detail read started after the latest durable revision when mutation notices arrive late", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    network.onLine = false;
    const remote = provider();
    const connector = createLocalMailConnector(remote.remote, connection, { scope, store });
    const unsubscribe = connector.local!.subscribe(vi.fn());

    try {
      await connector.listMessages("inbox");
      const otherStore = createLocalMailStore();
      await otherStore.applyMutation(scope, "saved", {
        message: message("saved", { isRead: true }),
        folderIds: ["inbox"],
      });
      const older = await otherStore.getVersion(scope);
      await otherStore.applyMutation(scope, "saved", {
        message: message("saved", { isRead: true, isStarred: true }),
        folderIds: ["inbox"],
      });
      const latest = await otherStore.getVersion(scope);
      network.onLine = true;
      const body = deferred<MailMessage>();
      remote.getMessage.mockReturnValueOnce(body.promise);
      const reading = connector.getMessage("uncached");
      await vi.waitFor(() => expect(remote.getMessage).toHaveBeenCalledOnce());
      for (const version of [older, latest])
        deliverLibraryChange({ scope, type: "mutation", version, source: "another-runtime" });
      body.resolve(message("uncached"));
      await expect(reading).resolves.toMatchObject({ id: "uncached" });
      expect(remote.syncFolder).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
