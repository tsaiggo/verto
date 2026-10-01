import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalMailStore, getLocalMailStore } from "./local-store";
import type { LocalMailStore } from "./local-types";
import type { MailConnection, MailMessage } from "./model";

const scope = "google:reader@example.com";
const connection: MailConnection = {
  account: {
    id: "reader",
    address: "reader@example.com",
    displayName: "Reader",
    provider: "google",
  },
  folders: [
    { id: "inbox", name: "Inbox", kind: "inbox" },
    { id: "archive", name: "Archive", kind: "archive" },
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
    bodyText: "The complete plain text body.",
    isRead: false,
    hasAttachments: false,
    ...changes,
  };
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("verto.mail.library");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function rows(name: string): Promise<unknown[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(name, "readonly").objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

describe("persistent local mail library", () => {
  let store: LocalMailStore;

  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    store = createLocalMailStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reopens saved connections, bodies, membership, and interrupted sync state", async () => {
    await store.saveConnection(scope, connection);
    await store.applySyncPage(scope, "inbox", { messages: [message("old")], cursor: "completed" });
    const completedAt = (await store.getFolder(scope, "inbox"))?.lastSyncedAt;
    await store.applySyncPage(scope, "inbox", {
      reset: true,
      messages: [message("new", { bodyText: "Only stored in the full body" })],
      nextPageUrl: "provider:next-page",
      cursor: "must-not-advance",
    });

    const reopened = createLocalMailStore();
    expect(await reopened.getConnection(scope)).toEqual(connection);
    expect((await reopened.getMessage(scope, "new"))?.bodyText).toBe(
      "Only stored in the full body"
    );
    expect(await reopened.getFolder(scope, "inbox")).toEqual({
      scope,
      folderId: "inbox",
      messageIds: ["old", "new"],
      replacementIds: ["new"],
      cursor: "completed",
      nextPageUrl: "provider:next-page",
      lastSyncedAt: completedAt,
    });

    await reopened.applySyncPage(scope, "inbox", {
      messages: [message("last")],
      cursor: "finished",
    });
    expect(await store.getFolder(scope, "inbox")).toMatchObject({
      messageIds: ["new", "last"],
      cursor: "finished",
      lastSyncedAt: expect.any(Number),
    });
    expect(await store.getFolder(scope, "inbox")).not.toHaveProperty("nextPageUrl");
    expect(await store.getFolder(scope, "inbox")).not.toHaveProperty("replacementIds");
    expect((await store.listMessages(scope, "inbox")).messages.map((item) => item.id)).toEqual([
      "last",
      "new",
    ]);
    expect(await store.getMessage(scope, "old")).toBeUndefined();
  });

  it("collects replacement IDs through every chunk and commits an empty final snapshot", async () => {
    await store.saveMessages(scope, "inbox", [message("old"), message("shared")]);
    await store.saveMessages(scope, "archive", [message("shared")]);
    await store.applySyncPage(scope, "inbox", {
      reset: true,
      messages: [message("one")],
      nextPageUrl: "page-2",
    });
    await store.applySyncPage(scope, "inbox", {
      messages: [message("two")],
      nextPageUrl: "page-3",
    });
    expect((await store.getFolder(scope, "inbox"))?.replacementIds).toEqual(["one", "two"]);
    expect((await store.listMessages(scope, "inbox")).messages).toHaveLength(4);
    await store.applySyncPage(scope, "inbox", { messages: [], cursor: "round-1" });
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual(["one", "two"]);
    expect((await store.listMessages(scope, "archive")).messages.map((item) => item.id)).toEqual([
      "shared",
    ]);
    expect((await store.search(scope, { query: "" })).messages.map((item) => item.id)).toEqual([
      "one",
      "shared",
      "two",
    ]);

    await store.applySyncPage(scope, "inbox", { reset: true, messages: [], cursor: "round-2" });
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual([]);
    expect((await store.search(scope, { query: "" })).messages.map((item) => item.id)).toEqual([
      "shared",
    ]);
  });

  it("upserts duplicate IDs, updates read flags across folders, and unlinks only the selected folder", async () => {
    await store.saveMessages(scope, "inbox", [message("shared"), message("deleted")]);
    await store.saveMessages(scope, "archive", [message("shared")]);
    await store.applySyncPage(scope, "inbox", {
      messages: [
        message("shared", { subject: "First update" }),
        message("shared", { subject: "Latest update", isRead: true }),
      ],
      removedIds: ["shared", "deleted"],
      cursor: "new-cursor",
    });
    expect((await store.listMessages(scope, "inbox")).messages).toEqual([]);
    expect((await store.listMessages(scope, "archive")).messages[0]).toMatchObject({
      id: "shared",
      subject: "Latest update",
      isRead: true,
    });
    expect((await store.search(scope, { query: "", unreadOnly: true })).messages).toEqual([]);
    expect(await store.getMessage(scope, "deleted")).toBeUndefined();
    expect((await store.getFolder(scope, "inbox"))?.cursor).toBe("new-cursor");
  });

  it("applies removals to a pending replacement so the final page cannot restore deleted IDs", async () => {
    await store.applySyncPage(scope, "inbox", {
      reset: true,
      messages: [message("keep"), message("remove")],
      nextPageUrl: "next",
    });
    await store.applySyncPage(scope, "inbox", {
      messages: [message("remove")],
      removedIds: ["remove"],
      cursor: "done",
    });
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual(["keep"]);
  });

  it("collects deleted and replaced bodies only after their last folder membership is removed", async () => {
    await store.saveMessages(scope, "inbox", [message("old"), message("shared")]);
    await store.saveMessages(scope, "archive", [message("shared")]);
    await store.applySyncPage(scope, "inbox", {
      reset: true,
      messages: [message("new")],
      nextPageUrl: "next",
    });
    expect(await rows("messages")).toHaveLength(3);
    expect(await store.getMessage(scope, "old")).toBeDefined();
    await store.applySyncPage(scope, "inbox", { messages: [], cursor: "completed" });
    expect(
      ((await rows("messages")) as Array<{ id: string }>).map((item) => item.id).sort()
    ).toEqual(["new", "shared"]);
    expect((await store.getMessage(scope, "shared"))?.bodyText).toContain(
      "complete plain text body"
    );

    await store.applySyncPage(scope, "archive", {
      messages: [],
      removedIds: ["shared"],
      cursor: "deleted",
    });
    await store.applySyncPage(scope, "inbox", {
      messages: [message("transient")],
      removedIds: ["transient"],
    });
    expect(((await rows("messages")) as Array<{ id: string }>).map((item) => item.id)).toEqual([
      "new",
    ]);
    expect((await store.listMessages(scope, "inbox")).messages.map((item) => item.id)).toEqual([
      "new",
    ]);
  });

  it("partitions identical IDs and folders by exact account and demo scopes", async () => {
    const scopes = [scope, "microsoft:reader@example.com", `demo:${scope}`];
    for (const owner of scopes) {
      await store.saveConnection(owner, connection);
      await store.saveMessages(owner, "inbox", [message("same", { bodyText: owner })]);
      await store.saveMessages(owner, "archive", [
        message("same", { bodyText: owner }),
        message("other"),
      ]);
    }
    for (const owner of scopes) {
      expect((await store.search(owner, { query: "" })).messages).toHaveLength(2);
      expect((await store.getMessage(owner, "same"))?.bodyText).toBe(owner);
    }
    expect(
      (await store.listAccounts()).map((item) => ({ scope: item.scope, count: item.messageCount }))
    ).toEqual(expect.arrayContaining(scopes.map((owner) => ({ scope: owner, count: 2 }))));
    await store.clearAccount(scope);
    expect(await store.getConnection(scope)).toEqual(connection);
    expect(await store.getFolder(scope, "inbox")).toBeUndefined();
    expect((await store.search(scope, { query: "" })).messages).toEqual([]);
    expect(await rows("messages")).toHaveLength(4);
    expect(await rows("folders")).toHaveLength(4);
    expect((await store.listAccounts()).map((item) => item.scope).sort()).toEqual(scopes.sort());
  });

  it("persists only allowed mail fields and never extra OAuth tokens", async () => {
    await store.saveConnection(scope, {
      ...connection,
      accessToken: "secret-access",
      account: { ...connection.account, refreshToken: "secret-refresh" },
      folders: connection.folders.map((folder) => ({ ...folder, token: "secret-folder" })),
    } as MailConnection);
    await store.saveMessages(scope, "inbox", [
      {
        ...message("safe"),
        accessToken: "secret-message",
        mailAccount: { ...connection.account, token: "secret-mail-account" },
        attachments: [
          {
            id: "file",
            name: "file.txt",
            mimeType: "text/plain",
            size: 5,
            accessToken: "secret-file",
          },
        ],
      } as unknown as MailMessage,
    ]);
    const serialized = JSON.stringify([await rows("accounts"), await rows("messages")]);
    expect(serialized).not.toContain("secret-");
    expect(serialized).not.toContain("accessToken");
    expect((await store.getMessage(scope, "safe"))?.attachments).toEqual([
      { id: "file", name: "file.txt", mimeType: "text/plain", size: 5 },
    ]);
  });

  it("searches complete bodies, CJK, case, Unicode accents, sender, subject, to, and cc", async () => {
    await store.saveMessages(scope, "inbox", [
      message("body", {
        bodyText: "A long invisible body about CAFÉ. 开发计划讨论。",
        preview: "No matching preview",
      }),
      message("subject", { subject: "Résumé review" }),
      message("sender", { from: "Zoë <zoe@example.com>" }),
      message("to", { to: ["Élodie <elodie@example.com>"] }),
      message("cc", { cc: ["Renée <renee@example.com>"] }),
    ]);
    for (const [query, id] of [
      ["cafe", "body"],
      ["开发计划", "body"],
      ["résumé", "subject"],
      ["ZOE", "sender"],
      ["ELODIE", "to"],
      ["renee", "cc"],
    ]) {
      expect((await store.search(scope, { query })).messages.map((item) => item.id)).toEqual([id]);
    }
    expect(
      (await store.search(scope, { query: "cafe 开发计划" })).messages.map((item) => item.id)
    ).toEqual(["body"]);
  });

  it("searches all saved folders once per message and honors folder and unread filters", async () => {
    await store.saveMessages(scope, "inbox", [
      message("shared"),
      message("read", { isRead: true }),
    ]);
    await store.saveMessages(scope, "archive", [message("shared"), message("archive")]);
    expect((await store.search(scope, { query: "" })).messages.map((item) => item.id)).toEqual([
      "archive",
      "read",
      "shared",
    ]);
    expect(
      (await store.search(scope, { folderId: "inbox", query: "", unreadOnly: true })).messages.map(
        (item) => item.id
      )
    ).toEqual(["shared"]);
    expect((await store.search(scope, { folderId: "missing", query: "" })).messages).toEqual([]);
    expect(await store.listMessages(scope, "missing")).toEqual({ messages: [] });
  });

  it("orders newest first with stable ID ties and returns local offsets with a default page of 50", async () => {
    const messages = Array.from({ length: 53 }, (_, index) =>
      message(`id-${String(index).padStart(2, "0")}`)
    );
    messages.push(message("newest", { receivedAt: "2026-10-02T08:00:00.000Z" }));
    await store.saveMessages(scope, "inbox", messages.reverse());
    const first = await store.search(scope, { query: "" });
    expect(first.messages).toHaveLength(50);
    expect(first.messages.slice(0, 3).map((item) => item.id)).toEqual(["newest", "id-00", "id-01"]);
    expect(first.nextPageUrl).toBe("local:50");
    const second = await store.search(scope, { query: "", offset: 50 });
    expect(second.messages.map((item) => item.id)).toEqual(["id-49", "id-50", "id-51", "id-52"]);
    expect(second.nextPageUrl).toBeUndefined();
    expect(await store.listMessages(scope, "inbox", 50)).toEqual(second);
    expect((await store.listMessages(scope, "inbox", 0, 2)).nextPageUrl).toBe("local:2");
    await expect(store.search(scope, { query: "", limit: 0 })).rejects.toThrow("pagination");
    await expect(store.listMessages(scope, "inbox", -1)).rejects.toThrow("pagination");
  });

  it("aborts all writes after a quota failure without advancing a pending round", async () => {
    await store.applySyncPage(scope, "inbox", { messages: [message("old")], cursor: "completed" });
    await store.applySyncPage(scope, "inbox", {
      reset: true,
      messages: [message("first")],
      nextPageUrl: "page-2",
    });
    const before = await store.getFolder(scope, "inbox");
    const originalPut = FakeObjectStore.prototype.put;
    const put = vi.spyOn(FakeObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.name === "messages" && value.id === "failure")
        throw new DOMException("Disk full", "QuotaExceededError");
      return originalPut.call(this, value, key);
    });
    await expect(
      store.applySyncPage(scope, "inbox", {
        messages: [message("would-leak"), message("failure")],
        nextPageUrl: "must-not-advance",
        cursor: "must-not-advance",
      })
    ).rejects.toThrow("Disk full");
    put.mockRestore();
    expect(await store.getFolder(scope, "inbox")).toEqual(before);
    expect(await rows("messages")).toHaveLength(2);

    await store.applySyncPage(scope, "inbox", { messages: [message("last")], cursor: "finished" });
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual(["first", "last"]);
  });

  it("clears an account atomically when scoped deletion fails", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const originalDelete = FakeObjectStore.prototype.delete;
    vi.spyOn(FakeObjectStore.prototype, "delete").mockImplementation(function (
      this: IDBObjectStore,
      key
    ) {
      if (this.name === "messages") throw new DOMException("Deletion blocked", "UnknownError");
      return originalDelete.call(this, key);
    });
    await expect(store.clearAccount(scope)).rejects.toThrow("Deletion blocked");
    vi.restoreAllMocks();
    expect(await store.getConnection(scope)).toEqual(connection);
    expect((await store.listMessages(scope, "inbox")).messages.map((item) => item.id)).toEqual([
      "saved",
    ]);
  });

  it("rejects missing IndexedDB and invalid input without replacing saved state", async () => {
    await store.saveMessages(scope, "inbox", [message("saved")]);
    await expect(
      store.applySyncPage(scope, "inbox", {
        reset: true,
        messages: [message("bad", { bodyText: undefined as unknown as string })],
      })
    ).rejects.toThrow("full text body");
    expect((await store.listMessages(scope, "inbox")).messages.map((item) => item.id)).toEqual([
      "saved",
    ]);
    await expect(store.saveMessages("", "inbox", [message("bad")])).rejects.toThrow(
      "account scope"
    );
    vi.stubGlobal("indexedDB", undefined);
    await expect(createLocalMailStore().listAccounts()).rejects.toThrow("unavailable");
  });

  it("rejects open failures and can retry once persistent storage becomes available", async () => {
    const factory = indexedDB;
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("Storage is disabled", "SecurityError");
      },
    });
    await expect(store.listAccounts()).rejects.toThrow("Storage is disabled");
    vi.stubGlobal("indexedDB", factory);
    expect(await store.listAccounts()).toEqual([]);
  });

  it("reports a blocked upgrade and safely closes its delayed connection", async () => {
    const request = {} as IDBOpenDBRequest;
    vi.stubGlobal("indexedDB", { open: () => request });
    const pending = createLocalMailStore().listAccounts();
    await Promise.resolve();
    request.onblocked?.(new Event("blocked") as IDBVersionChangeEvent);
    await expect(pending).rejects.toThrow("blocked");
    const lateDatabase = { close: vi.fn() };
    Object.assign(request, { result: lateDatabase });
    request.onsuccess?.(new Event("success"));
    expect(lateDatabase.close).toHaveBeenCalledOnce();
  });

  it("closes on a version change and surfaces a newer incompatible database", async () => {
    await store.saveMessages(scope, "inbox", [message("saved")]);
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.mail.library", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("The local store did not release its connection"));
    });
    upgraded.close();
    await expect(store.getMessage(scope, "saved")).rejects.toThrow();
  });

  it("provides one lazy singleton", () => {
    expect(getLocalMailStore()).toBe(getLocalMailStore());
  });

  it("prunes deleted folders and unreferenced bodies while preserving remaining copies", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("shared")]);
    await store.saveMessages(scope, "archive", [message("shared"), message("gone")]);
    await store.saveConnection(scope, { ...connection, folders: connection.folders.slice(0, 1) });
    expect(await store.getFolder(scope, "archive")).toBeUndefined();
    expect((await store.search(scope, { query: "" })).messages.map((item) => item.id)).toEqual([
      "shared",
    ]);
    expect(((await rows("messages")) as Array<{ id: string }>).map((item) => item.id)).toEqual([
      "shared",
    ]);
  });

  it("keeps metadata after clearing and rejects stale writes from a separate store instance", async () => {
    await store.saveConnection(scope, connection);
    const old = await store.getVersion(scope);
    const second = createLocalMailStore();
    await second.clearAccount(scope);
    expect(await second.getConnection(scope)).toEqual(connection);
    expect(await second.getVersion(scope)).toEqual({ generation: 1, revision: 1 });
    await expect(
      store.applySyncPage(scope, "inbox", { messages: [message("stale")] }, old)
    ).rejects.toThrow("Saved mail changed");
    await expect(store.saveConnection(scope, connection, old.generation)).rejects.toThrow(
      "Saved mail changed"
    );
    await expect(
      store.applyMutation(
        scope,
        "stale",
        { message: message("stale"), folderIds: ["inbox"] },
        old.generation
      )
    ).rejects.toThrow("Saved mail changed");
    expect((await second.search(scope, { query: "" })).messages).toEqual([]);
    expect((await second.listAccounts())[0]).toMatchObject({ scope, connection, messageCount: 0 });
  });

  it("persists read and star flags atomically across authoritative memberships and increments only revision", async () => {
    const counted = {
      ...connection,
      folders: connection.folders.map((folder) => ({ ...folder, unreadCount: 3 })),
    };
    await store.saveConnection(scope, counted);
    await store.saveMessages(scope, "inbox", [message("updated"), message("unrelated")]);
    await store.saveMessages(scope, "archive", [message("updated")]);
    const version = await store.getVersion(scope);
    await store.applyMutation(
      scope,
      "updated",
      {
        message: message("updated", { isRead: true, isStarred: true }),
        folderIds: ["inbox", "archive", "UNREAD"],
      },
      version.generation
    );
    expect(await store.getMessage(scope, "updated")).toMatchObject({
      isRead: true,
      isStarred: true,
    });
    expect((await store.listMessages(scope, "archive")).messages[0]).toMatchObject({
      isRead: true,
      isStarred: true,
    });
    expect(
      (await store.search(scope, { query: "", unreadOnly: true })).messages.map((item) => item.id)
    ).toEqual(["unrelated"]);
    expect((await store.getConnection(scope))?.folders.map((folder) => folder.unreadCount)).toEqual(
      [2, 2]
    );
    expect(await store.getVersion(scope)).toEqual({ generation: 0, revision: 1 });
    await expect(
      store.applySyncPage(scope, "inbox", { messages: [message("updated")] }, version)
    ).rejects.toThrow("Saved mail changed");
    expect((await createLocalMailStore().getMessage(scope, "updated"))?.isStarred).toBe(true);
  });

  it("claims one message atomically across independent stores and releases only the owner", async () => {
    await store.saveConnection(scope, connection);
    const second = createLocalMailStore();
    const expiry = Date.now() + 60_000;
    expect(
      await Promise.all([
        store.claimMutation(scope, "one", "first-owner", expiry, 0),
        second.claimMutation(scope, "one", "second-owner", expiry, 0),
      ])
    ).toEqual([true, false]);
    expect(await second.claimMutation(scope, "two", "second-owner", expiry, 0)).toBe(true);
    expect(await second.claimMutation("other-account", "one", "second-owner", expiry, 0)).toBe(
      true
    );
    await second.releaseMutation(scope, "one", "second-owner");
    await store.saveConnection(scope, connection, 0);
    expect(await second.claimMutation(scope, "one", "second-owner", expiry, 0)).toBe(false);
    await createLocalMailStore().releaseMutation(scope, "one", "first-owner");
    expect(await second.claimMutation(scope, "one", "second-owner", expiry, 0)).toBe(true);
    expect(await store.getVersion(scope)).toEqual({ generation: 0, revision: 0 });
  });

  it("renews owned leases and rejects a late cache commit after an expired lease is reclaimed", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("one")]);
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const second = createLocalMailStore();
    expect(await store.claimMutation(scope, "one", "first-owner", now + 100, 0)).toBe(true);
    clock.mockReturnValue(now + 50);
    expect(await store.claimMutation(scope, "one", "first-owner", now + 200, 0)).toBe(true);
    clock.mockReturnValue(now + 150);
    expect(await second.claimMutation(scope, "one", "second-owner", now + 300, 0)).toBe(false);
    clock.mockReturnValue(now + 250);
    expect(await second.claimMutation(scope, "one", "second-owner", now + 400, 0)).toBe(true);
    await expect(
      store.applyMutation(
        scope,
        "one",
        { message: message("one", { isRead: true }), folderIds: ["inbox"] },
        0,
        "first-owner"
      )
    ).rejects.toThrow("belongs to another mail window");
    await store.releaseMutation(scope, "one", "first-owner");
    await second.applyMutation(
      scope,
      "one",
      { message: message("one", { isStarred: true }), folderIds: ["inbox"] },
      0,
      "second-owner"
    );
    expect(await store.getMessage(scope, "one")).toMatchObject({ isRead: false, isStarred: true });
    expect(await store.getVersion(scope)).toEqual({ generation: 0, revision: 1 });
  });

  it("retains an active provider action lease across cache clear and rejects older cache writes", async () => {
    await store.saveConnection(scope, connection);
    const expiry = Date.now() + 60_000;
    expect(await store.claimMutation(scope, "one", "old-owner", expiry, 0)).toBe(true);
    const second = createLocalMailStore();
    await second.clearAccount(scope);
    await expect(store.claimMutation(scope, "one", "old-owner", expiry, 0)).rejects.toThrow(
      "Saved mail changed"
    );
    expect(await second.claimMutation(scope, "one", "new-owner", expiry, 1)).toBe(false);
    await expect(
      store.applyMutation(
        scope,
        "one",
        { message: message("one"), folderIds: ["inbox"] },
        0,
        "old-owner"
      )
    ).rejects.toThrow("Saved mail changed");
    await store.releaseMutation(scope, "one", "old-owner");
    expect(await second.claimMutation(scope, "one", "new-owner", expiry, 1)).toBe(true);
    await second.applyMutation(
      scope,
      "one",
      { message: message("one", { isRead: true }), folderIds: ["inbox"] },
      1,
      "new-owner"
    );
    expect(await store.getMessage(scope, "one")).toMatchObject({ isRead: true });
  });

  it("replaces moved Graph IDs and creates only known authoritative folder membership", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("old"), message("unrelated")]);
    await store.saveMessages("other-account", "inbox", [message("old")]);
    await store.applySyncPage(scope, "inbox", {
      reset: true,
      messages: [message("pending")],
      nextPageUrl: "stale-page",
    });
    await store.applyMutation(scope, "old", {
      message: message("moved", { isStarred: false }),
      folderIds: ["archive", "unknown-provider-label"],
    });
    expect((await store.getFolder(scope, "inbox"))?.messageIds).toEqual(["unrelated", "pending"]);
    expect(await store.getFolder(scope, "inbox")).not.toHaveProperty("replacementIds");
    expect(await store.getFolder(scope, "inbox")).not.toHaveProperty("nextPageUrl");
    expect((await store.getFolder(scope, "archive"))?.messageIds).toEqual(["moved"]);
    expect(await store.getFolder(scope, "unknown-provider-label")).toBeUndefined();
    expect(await store.getMessage(scope, "old")).toBeUndefined();
    expect(await store.getMessage("other-account", "old")).toBeDefined();
    expect(
      ((await rows("messages")) as Array<{ scope: string; id: string }>).some(
        (item) => item.scope === scope && item.id === "old"
      )
    ).toBe(false);
    expect((await store.getMessage(scope, "moved"))?.isStarred).toBe(false);
  });

  it("allows different confirmed mutations from the same clear generation to commit", async () => {
    await store.saveConnection(scope, connection);
    await store.saveMessages(scope, "inbox", [message("one"), message("two")]);
    const firstVersion = await store.getVersion(scope);
    const second = createLocalMailStore();
    await Promise.all([
      store.applyMutation(
        scope,
        "one",
        { message: message("one", { isRead: true }), folderIds: ["inbox"] },
        firstVersion.generation
      ),
      second.applyMutation(
        scope,
        "two",
        { message: message("two", { isStarred: true }), folderIds: ["inbox"] },
        firstVersion.generation
      ),
    ]);
    expect((await store.getMessage(scope, "one"))?.isRead).toBe(true);
    expect((await store.getMessage(scope, "two"))?.isStarred).toBe(true);
    expect(await store.getVersion(scope)).toEqual({ generation: 0, revision: 2 });
  });

  it("rolls back a mutation body, membership, counts and revision when its final account write fails", async () => {
    await store.saveConnection(scope, {
      ...connection,
      folders: connection.folders.map((folder) => ({ ...folder, unreadCount: 2 })),
    });
    await store.saveMessages(scope, "inbox", [message("original")]);
    const before = [await rows("accounts"), await rows("folders"), await rows("messages")];
    const originalPut = FakeObjectStore.prototype.put;
    const put = vi.spyOn(FakeObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.name === "accounts" && value.revision === 1)
        throw new DOMException("Mutation quota exceeded", "QuotaExceededError");
      return originalPut.call(this, value, key);
    });
    await expect(
      store.applyMutation(scope, "original", {
        message: message("new", { isRead: true }),
        folderIds: ["archive"],
      })
    ).rejects.toThrow("Mutation quota exceeded");
    put.mockRestore();
    expect([await rows("accounts"), await rows("folders"), await rows("messages")]).toEqual(before);
  });
});
