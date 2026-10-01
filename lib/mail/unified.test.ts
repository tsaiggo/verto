import { describe, expect, it, vi } from "vitest";
import type { LocalMailControl, LocalMailStatus } from "./local-types";
import type {
  MailAttachment,
  MailConnection,
  MailConnector,
  MailMessage,
  MailProviderId,
} from "./model";
import {
  createUnifiedMailConnector,
  scopedMailId,
  unifiedMailConnection,
  type MailAccountBinding,
} from "./unified";

function message(id: string, receivedAt = "2026-10-01T08:00:00.000Z"): MailMessage {
  return {
    id,
    receivedAt,
    subject: `Subject ${id}`,
    from: "Sender <sender@example.com>",
    to: ["reader@example.com"],
    preview: "Message preview",
    bodyText: "Full message body",
    isRead: false,
    hasAttachments: false,
  };
}

function mailbox(provider: MailProviderId, address: string, inboxId: string, unreadCount = 0) {
  const connection: MailConnection = {
    account: { id: `${provider}:opaque-owner`, address, displayName: address, provider },
    folders: [
      { id: `${inboxId}-sent`, name: "Sent", kind: "sent", unreadCount: 99 },
      { id: inboxId, name: "Inbox", kind: "inbox", unreadCount },
    ],
  };
  const listMessages = vi.fn<MailConnector["listMessages"]>().mockResolvedValue({ messages: [] });
  const getMessage = vi
    .fn<MailConnector["getMessage"]>()
    .mockImplementation(async (id) => message(id));
  const getAttachment = vi.fn<NonNullable<MailConnector["getAttachment"]>>();
  const connector: MailConnector = {
    id: provider,
    label: provider === "google" ? "Gmail" : "Outlook",
    isConfigured: () => true,
    connect: vi.fn(async () => {}),
    restore: vi.fn(async () => connection),
    disconnect: vi.fn(async () => {}),
    listMessages,
    getMessage,
    getAttachment,
    sendMessage: vi.fn(async () => {}),
  };
  const binding: MailAccountBinding = { id: `${provider}:${address}`, connection, connector };
  return { binding, listMessages, getMessage, getAttachment };
}

function accounts() {
  return [
    mailbox("google", "personal@example.com", "INBOX", 3),
    mailbox("microsoft", "work@example.com", "opaque-graph-inbox-id", 5),
  ] as const;
}

describe("owning-account message actions", () => {
  it("grants update permission and applies changes only to the scoped mailbox", async () => {
    const [personal, work] = accounts();
    const updatePersonal = vi.fn();
    const updateWork = vi.fn(async () => {});
    const mutatePersonal = vi.fn();
    const mutateWork = vi.fn(async () => ({
      message: { ...message("updated-id"), isStarred: true },
      folderIds: ["opaque-graph-inbox-id"],
    }));
    personal.binding.connector.enableUpdating = updatePersonal;
    personal.binding.connector.mutateMessage = mutatePersonal;
    work.binding.connector.enableUpdating = updateWork;
    work.binding.connector.mutateMessage = mutateWork;
    const connector = createUnifiedMailConnector([personal.binding, work.binding]);
    const id = scopedMailId(work.binding.id, "source-id");
    await connector.enableUpdating!(id);
    const result = await connector.mutateMessage!(id, { type: "star", value: true });
    expect(updateWork).toHaveBeenCalledWith("source-id");
    expect(mutateWork).toHaveBeenCalledWith("source-id", { type: "star", value: true });
    expect(updatePersonal).not.toHaveBeenCalled();
    expect(mutatePersonal).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      message: {
        id: scopedMailId(work.binding.id, "updated-id"),
        sourceMessageId: "updated-id",
        mailAccount: work.binding.connection.account,
        isStarred: true,
      },
      folderIds: ["INBOX"],
    });
  });

  it("removes an archived message from combined Inbox membership", async () => {
    const [personal] = accounts();
    personal.binding.connector.mutateMessage = vi.fn(async () => ({
      message: message("archived-id"),
      folderIds: ["archive"],
    }));
    const connector = createUnifiedMailConnector([personal.binding]);
    const result = await connector.mutateMessage!(scopedMailId(personal.binding.id, "id"), {
      type: "archive",
    });
    expect(result.folderIds).toEqual([]);
    expect(result.message.mailAccount).toEqual(personal.binding.connection.account);
  });

  it("rejects disconnected and unscoped actions before requesting consent or changing mail", async () => {
    const [personal] = accounts();
    personal.binding.status = "error";
    withLocal(personal);
    const enable = vi.fn();
    const mutate = vi.fn();
    personal.binding.connector.enableUpdating = enable;
    personal.binding.connector.mutateMessage = mutate;
    const connector = createUnifiedMailConnector([personal.binding]);
    const id = scopedMailId(personal.binding.id, "message");
    await expect(connector.enableUpdating!(id)).rejects.toThrow("Reconnect");
    await expect(connector.mutateMessage!(id, { type: "trash" })).rejects.toThrow("Reconnect");
    await expect(connector.mutateMessage!("message", { type: "trash" })).rejects.toThrow(
      "identify its mailbox"
    );
    expect(enable).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});

function withLocal(account: ReturnType<typeof mailbox>, initial: Partial<LocalMailStatus> = {}) {
  let status: LocalMailStatus = { phase: "idle", count: 5, lastSyncedAt: 100, ...initial };
  const listeners = new Set<() => void>();
  const unsubscribe = vi.fn();
  const local = {
    scope: account.binding.id,
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        unsubscribe();
      };
    }),
    getStatus: vi.fn<LocalMailControl["getStatus"]>().mockImplementation(() => ({ ...status })),
    synchronize: vi.fn<LocalMailControl["synchronize"]>().mockResolvedValue(),
    search: vi.fn<LocalMailControl["search"]>().mockResolvedValue({ messages: [] }),
    clear: vi.fn<LocalMailControl["clear"]>().mockResolvedValue(),
  } satisfies LocalMailControl;
  account.binding.connector = { ...account.binding.connector, local };
  return {
    ...account,
    local,
    unsubscribe,
    emit(patch: Partial<LocalMailStatus> = {}) {
      status = { ...status, ...patch };
      for (const listener of listeners) listener();
    },
  };
}

const attachment: MailAttachment = {
  id: "same-attachment-id",
  name: "notes.txt",
  mimeType: "text/plain",
  size: 12,
};

describe("combined Mail inbox ownership", () => {
  it("keeps identical provider message IDs distinct and preserves their mailbox identity", async () => {
    const [personal, work] = accounts();
    personal.listMessages.mockResolvedValue({ messages: [message("shared-provider-id")] });
    work.listMessages.mockResolvedValue({ messages: [message("shared-provider-id")] });
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    const page = await combined.listMessages("INBOX");

    expect(new Set(page.messages.map((item) => item.id)).size).toBe(2);
    expect(page.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: scopedMailId(personal.binding.id, "shared-provider-id"),
          sourceMessageId: "shared-provider-id",
          mailAccount: personal.binding.connection.account,
        }),
        expect.objectContaining({
          id: scopedMailId(work.binding.id, "shared-provider-id"),
          sourceMessageId: "shared-provider-id",
          mailAccount: work.binding.connection.account,
        }),
      ])
    );
  });

  it("dispatches reads and attachment downloads only to the owner even when IDs collide", async () => {
    const [personal, work] = accounts();
    const blob = new Blob(["Mailbox-specific attachment"]);
    work.getAttachment.mockResolvedValue(blob);
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);
    const scopedId = scopedMailId(work.binding.id, "shared-provider-id");

    await expect(combined.getMessage(scopedId)).resolves.toMatchObject({
      id: scopedId,
      sourceMessageId: "shared-provider-id",
      bodyText: "Full message body",
      mailAccount: work.binding.connection.account,
    });
    await expect(combined.getAttachment!(scopedId, attachment)).resolves.toBe(blob);

    expect(work.getMessage).toHaveBeenCalledExactlyOnceWith("shared-provider-id");
    expect(work.getAttachment).toHaveBeenCalledExactlyOnceWith("shared-provider-id", attachment);
    expect(personal.getMessage).not.toHaveBeenCalled();
    expect(personal.getAttachment).not.toHaveBeenCalled();
  });

  it("round-trips quoted and delimiter-containing account/message IDs without ambiguous ownership", async () => {
    const [personal, work] = accounts();
    personal.binding.id = 'personal:mailbox/"a:b"';
    work.binding.id = 'personal:mailbox/"a';
    const rawId = 'message:b"/[]\\next';
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    await combined.getMessage(scopedMailId(personal.binding.id, rawId));

    expect(personal.getMessage).toHaveBeenCalledExactlyOnceWith(rawId);
    expect(work.getMessage).not.toHaveBeenCalled();
    expect(scopedMailId("a:b", "c")).not.toBe(scopedMailId("a", "b:c"));
  });

  it.each([
    "raw-provider-id",
    "null",
    '"provider-id"',
    "[]",
    '["account"]',
    '["account", "message", "extra"]',
    '["account", 123]',
  ])("rejects an unscoped or malformed message identity: %s", async (id) => {
    const [personal, work] = accounts();
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    await expect(combined.getMessage(id)).rejects.toThrow("does not identify its mailbox");
    await expect(combined.getAttachment!(id, attachment)).rejects.toThrow(
      "does not identify its mailbox"
    );
    expect(personal.getMessage).not.toHaveBeenCalled();
    expect(work.getMessage).not.toHaveBeenCalled();
  });

  it("rejects stale and unavailable mailbox owners instead of falling back to another account", async () => {
    const [personal, work] = accounts();
    personal.binding.status = "error";
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    await expect(
      combined.getMessage(scopedMailId("disconnected-owner", "shared-provider-id"))
    ).rejects.toThrow("mailbox is unavailable");
    await expect(
      combined.getMessage(scopedMailId(personal.binding.id, "shared-provider-id"))
    ).rejects.toThrow("mailbox is unavailable");
    await expect(
      combined.getAttachment!(scopedMailId(personal.binding.id, "shared-provider-id"), attachment)
    ).rejects.toThrow("mailbox is unavailable");
    expect(personal.getMessage).not.toHaveBeenCalled();
    expect(work.getMessage).not.toHaveBeenCalled();
    expect(personal.getAttachment).not.toHaveBeenCalled();
    expect(work.getAttachment).not.toHaveBeenCalled();
  });

  it("reports unsupported attachments for their own account without trying another provider", async () => {
    const [personal, work] = accounts();
    delete work.binding.connector.getAttachment;
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    await expect(
      combined.getAttachment!(scopedMailId(work.binding.id, "message"), attachment)
    ).rejects.toThrow("Attachments are unavailable for this mailbox");
    expect(personal.getAttachment).not.toHaveBeenCalled();
  });

  it("keeps the aggregate read-only and requires an explicit account for connection actions", async () => {
    const [personal, work] = accounts();
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    expect(combined.sendMessage).toBeUndefined();
    expect(combined.enableSending).toBeUndefined();
    await expect(combined.connect()).rejects.toThrow("Choose an account to connect");
    await expect(combined.disconnect()).rejects.toThrow("Choose an account to disconnect");
    expect(personal.binding.connector.connect).not.toHaveBeenCalled();
    expect(work.binding.connector.disconnect).not.toHaveBeenCalled();
  });
});

describe("combined Mail inbox pages", () => {
  it("uses each account's own inbox folder and sums only inbox unread counts", async () => {
    const [personal, work] = accounts();
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    await combined.listMessages("INBOX");

    expect(personal.listMessages).toHaveBeenCalledExactlyOnceWith("INBOX", undefined);
    expect(work.listMessages).toHaveBeenCalledExactlyOnceWith("opaque-graph-inbox-id", undefined);
    expect(unifiedMailConnection([personal.binding, work.binding]).folders).toEqual([
      { id: "INBOX", name: "All inboxes", kind: "inbox", unreadCount: 8 },
    ]);
  });

  it("merges newest first and continues only the providers that still have pages", async () => {
    const [personal, work] = accounts();
    personal.listMessages
      .mockResolvedValueOnce({
        messages: [
          message("personal-old", "2026-09-28T08:00:00Z"),
          message("personal-new", "2026-10-01T08:00:00Z"),
        ],
        nextPageUrl: "gmail-next-page",
      })
      .mockResolvedValueOnce({ messages: [message("personal-page-2", "2026-09-20T08:00:00Z")] });
    work.listMessages.mockResolvedValue({
      messages: [message("work-middle", "2026-09-30T08:00:00Z")],
    });
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    const first = await combined.listMessages("INBOX");
    const second = await combined.listMessages("INBOX", first.nextPageUrl);

    expect(first.messages.map((item) => item.sourceMessageId)).toEqual([
      "personal-new",
      "work-middle",
      "personal-old",
    ]);
    expect(JSON.parse(first.nextPageUrl!)).toEqual({ [personal.binding.id]: "gmail-next-page" });
    expect(personal.listMessages).toHaveBeenLastCalledWith("INBOX", "gmail-next-page");
    expect(work.listMessages).toHaveBeenCalledTimes(1);
    expect(second.messages.map((item) => item.sourceMessageId)).toEqual(["personal-page-2"]);
    expect(second.nextPageUrl).toBeUndefined();
  });

  it("preserves independent cursors when both providers have more mail", async () => {
    const [personal, work] = accounts();
    personal.listMessages
      .mockResolvedValueOnce({ messages: [], nextPageUrl: "gmail-cursor" })
      .mockResolvedValueOnce({ messages: [message("gmail-page-2", "2026-09-20T08:00:00Z")] });
    work.listMessages
      .mockResolvedValueOnce({
        messages: [],
        nextPageUrl: "https://graph.microsoft.com/next?$skip=10",
      })
      .mockResolvedValueOnce({ messages: [message("outlook-page-2", "2026-09-25T08:00:00Z")] });
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    const first = await combined.listMessages("INBOX");
    const second = await combined.listMessages("INBOX", first.nextPageUrl);

    expect(personal.listMessages).toHaveBeenLastCalledWith("INBOX", "gmail-cursor");
    expect(work.listMessages).toHaveBeenLastCalledWith(
      "opaque-graph-inbox-id",
      "https://graph.microsoft.com/next?$skip=10"
    );
    expect(second.messages.map((item) => item.sourceMessageId)).toEqual([
      "outlook-page-2",
      "gmail-page-2",
    ]);
  });

  it("keeps the healthy inbox usable and identifies a failed account in a partial page", async () => {
    const [personal, work] = accounts();
    personal.listMessages.mockResolvedValue({
      messages: [message("available")],
      nextPageUrl: "healthy-next",
    });
    work.listMessages.mockRejectedValue(new Error("Outlook session expired."));
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    const page = await combined.listMessages("INBOX");

    expect(page.messages.map((item) => item.sourceMessageId)).toEqual(["available"]);
    expect(page.accountWarnings).toEqual([
      {
        accountId: work.binding.id,
        address: "work@example.com",
        message: "Outlook session expired.",
      },
    ]);
    expect(JSON.parse(page.nextPageUrl!)).toEqual({ [personal.binding.id]: "healthy-next" });
  });

  it("does not call an account already marked unavailable and keeps its recovery message", async () => {
    const [personal, work] = accounts();
    work.binding.status = "error";
    work.binding.message = "Sign in to your work account again.";
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    const page = await combined.listMessages("INBOX");

    expect(work.listMessages).not.toHaveBeenCalled();
    expect(personal.listMessages).toHaveBeenCalledTimes(1);
    expect(page.accountWarnings?.[0]).toMatchObject({
      accountId: work.binding.id,
      message: "Sign in to your work account again.",
    });
  });

  it("reports an account with no readable inbox without requesting the wrong folder", async () => {
    const [personal, work] = accounts();
    work.binding.connection.folders = [{ id: "outlook-sent", name: "Sent", kind: "sent" }];
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    const page = await combined.listMessages("INBOX");

    expect(work.listMessages).not.toHaveBeenCalled();
    expect(page.accountWarnings?.[0]).toMatchObject({
      accountId: work.binding.id,
      message: "This mailbox has no readable inbox.",
    });
  });

  it("raises a recoverable error when every inbox fails instead of showing a successful empty page", async () => {
    const [personal, work] = accounts();
    personal.listMessages.mockRejectedValue(new Error("Gmail needs sign-in."));
    work.listMessages.mockRejectedValue("Network unavailable");
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);

    await expect(combined.listMessages("INBOX")).rejects.toThrow(
      "None of your inboxes could be loaded"
    );
    expect(personal.listMessages).toHaveBeenCalledTimes(1);
    expect(work.listMessages).toHaveBeenCalledTimes(1);
  });

  it.each([
    "invalid-json",
    "null",
    "[]",
    "123",
    "{}",
    '{"disconnected-account":"stale-cursor"}',
    '{"google:personal@example.com":123}',
    '{"google:personal@example.com":null}',
    '{"google:personal@example.com":""}',
  ])(
    "rejects malformed or stale combined cursors before contacting a mailbox: %s",
    async (cursor) => {
      const [personal, work] = accounts();
      const combined = createUnifiedMailConnector([personal.binding, work.binding]);

      await expect(combined.listMessages("INBOX", cursor)).rejects.toThrow(
        "combined inbox page expired"
      );
      expect(personal.listMessages).not.toHaveBeenCalled();
      expect(work.listMessages).not.toHaveBeenCalled();
    }
  );
});

describe("combined saved Mail", () => {
  it("offers aggregate controls only when every account has saved-mail controls", () => {
    const [personal, work] = accounts();
    expect(createUnifiedMailConnector([]).local).toBeUndefined();
    expect(createUnifiedMailConnector([personal.binding, work.binding]).local).toBeUndefined();
    withLocal(personal);
    expect(createUnifiedMailConnector([personal.binding, work.binding]).local).toBeUndefined();
    withLocal(work);
    expect(createUnifiedMailConnector([personal.binding, work.binding]).local).toBeDefined();
  });

  it("reads cached inboxes and bodies for unavailable accounts while the owner enforces online attachments", async () => {
    const [first, second] = accounts();
    const personal = withLocal(first);
    const work = withLocal(second);
    for (const account of [personal, work]) {
      account.binding.status = "error";
      account.binding.message = "Reconnect to sync.";
      account.listMessages.mockResolvedValue({ messages: [message("saved")] });
    }
    personal.getAttachment.mockRejectedValue(
      new Error("Reconnect before downloading attachments.")
    );
    const combined = createUnifiedMailConnector([personal.binding, work.binding]);
    const page = await combined.listMessages("INBOX");
    expect(page.messages).toHaveLength(2);
    expect(page.accountWarnings).toHaveLength(2);
    expect(unifiedMailConnection([personal.binding, work.binding]).folders[0].unreadCount).toBe(8);
    await expect(
      combined.getMessage(scopedMailId(personal.binding.id, "saved"))
    ).resolves.toMatchObject({ bodyText: "Full message body" });
    await expect(
      combined.getAttachment!(scopedMailId(personal.binding.id, "saved"), attachment)
    ).rejects.toThrow("Reconnect before downloading");
    expect(work.getAttachment).not.toHaveBeenCalled();
    personal.emit({ phase: "offline" });
    expect(combined.local!.getStatus("INBOX").message).toContain(
      "personal@example.com: Reconnect to sync."
    );
  });

  it("keeps status snapshots stable, sums real inbox counts and reports the earliest completed sync", () => {
    const [first, second] = accounts();
    const personal = withLocal(first, { count: 3, lastSyncedAt: 200 });
    const work = withLocal(second, { count: 7, lastSyncedAt: 100 });
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    const initial = local.getStatus("INBOX");
    expect(initial).toEqual({ phase: "idle", count: 10, lastSyncedAt: 100 });
    expect(local.getStatus("INBOX")).toBe(initial);
    expect(personal.local.getStatus).toHaveBeenCalledWith("INBOX");
    expect(work.local.getStatus).toHaveBeenCalledWith("opaque-graph-inbox-id");
    work.emit({ count: 9, lastSyncedAt: undefined });
    const changed = local.getStatus("INBOX");
    expect(changed).toEqual({ phase: "idle", count: 12 });
    expect(changed).not.toBe(initial);
    expect(local.getStatus("INBOX")).toBe(changed);
  });

  it("subscribes once to each mailbox, forwards changes and releases subscriptions when the last listener leaves", () => {
    const [first, second] = accounts();
    const personal = withLocal(first);
    const work = withLocal(second);
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    const a = vi.fn();
    const b = vi.fn();
    const leaveA = local.subscribe(a);
    const leaveB = local.subscribe(b);
    expect(personal.local.subscribe).toHaveBeenCalledTimes(1);
    expect(work.local.subscribe).toHaveBeenCalledTimes(1);
    work.emit({ phase: "syncing" });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    leaveA();
    expect(work.unsubscribe).not.toHaveBeenCalled();
    personal.emit();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledTimes(2);
    leaveB();
    expect(personal.unsubscribe).toHaveBeenCalledOnce();
    expect(work.unsubscribe).toHaveBeenCalledOnce();
  });

  it("keeps offline/error warnings honest while another mailbox is still syncing", () => {
    const [first, second] = accounts();
    const personal = withLocal(first, { phase: "syncing", count: 2 });
    const work = withLocal(second, {
      phase: "offline",
      count: 8,
      message: "Reconnect your work account.",
    });
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    expect(local.getStatus("INBOX")).toMatchObject({
      phase: "syncing",
      count: 10,
      message: "work@example.com: Reconnect your work account.",
    });
    personal.emit({ phase: "idle" });
    expect(local.getStatus("INBOX").phase).toBe("offline");
    work.emit({ phase: "error", message: "Storage could not be read." });
    expect(local.getStatus("INBOX")).toMatchObject({
      phase: "error",
      message: "work@example.com: Storage could not be read.",
    });
  });

  it("syncs each real inbox and reports partial failure without discarding the successful mailbox", async () => {
    const [first, second] = accounts();
    const personal = withLocal(first);
    const work = withLocal(second);
    work.local.synchronize.mockRejectedValue(new Error("Outlook permission expired."));
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    const changed = vi.fn();
    const unsubscribe = local.subscribe(changed);
    const pending = local.synchronize("INBOX");
    expect(local.getStatus("INBOX").phase).toBe("syncing");
    await expect(pending).rejects.toThrow(
      "Some of your inboxes could not be synced. work@example.com: Outlook permission expired."
    );
    expect(personal.local.synchronize).toHaveBeenCalledExactlyOnceWith("INBOX");
    expect(work.local.synchronize).toHaveBeenCalledExactlyOnceWith("opaque-graph-inbox-id");
    expect(local.getStatus("INBOX")).toMatchObject({
      phase: "error",
      count: 10,
      message: "work@example.com: Outlook permission expired.",
    });
    expect(changed).toHaveBeenCalledTimes(2);
    work.emit({ phase: "syncing" });
    expect(local.getStatus("INBOX").phase).toBe("syncing");
    work.emit({ phase: "idle", lastSyncedAt: 300 });
    expect(local.getStatus("INBOX").phase).toBe("idle");
    work.local.synchronize.mockResolvedValue();
    await expect(local.synchronize("INBOX")).resolves.toBeUndefined();
    expect(local.getStatus("INBOX").phase).toBe("idle");
    unsubscribe();
  });

  it("rejects apparent sync success when a mailbox remains offline and requires an account for clearing", async () => {
    const [first, second] = accounts();
    const personal = withLocal(first, { phase: "offline", message: "Offline cached inbox." });
    const work = withLocal(second, { phase: "error", message: "Sync failed." });
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    await expect(local.synchronize("INBOX")).rejects.toThrow(
      "None of your inboxes could be synced."
    );
    expect(local.getStatus("INBOX").message).toContain(
      "personal@example.com: Offline cached inbox."
    );
    await expect(local.clear()).rejects.toThrow("Choose an account to clear its saved mail");
    expect(personal.local.clear).not.toHaveBeenCalled();
    expect(work.local.clear).not.toHaveBeenCalled();
  });

  it("searches saved bodies across all folders, preserves owners and continues only accounts with more matches", async () => {
    const [first, second] = accounts();
    const personal = withLocal(first);
    const work = withLocal(second);
    personal.binding.status = "error";
    personal.local.search.mockImplementation(async (_folder, query, _unread, cursor) => {
      const saved = {
        ...message(cursor ? "older" : "saved"),
        bodyText: "Unique body search term",
        receivedAt: cursor ? "2026-09-01T00:00:00Z" : "2026-10-01T00:00:00Z",
      };
      return {
        messages: saved.bodyText.includes(query) ? [saved] : [],
        ...(!cursor ? { nextPageUrl: "local:30" } : {}),
      };
    });
    work.local.search.mockResolvedValue({
      messages: [{ ...message("saved"), receivedAt: "2026-09-30T00:00:00Z" }],
    });
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    const page = await local.search(undefined, "body search", true);
    expect(personal.local.search).toHaveBeenCalledWith(undefined, "body search", true, undefined);
    expect(work.local.search).toHaveBeenCalledWith(undefined, "body search", true, undefined);
    expect(page.messages.map((item) => item.id)).toEqual([
      scopedMailId(personal.binding.id, "saved"),
      scopedMailId(work.binding.id, "saved"),
    ]);
    expect(page.messages[0].mailAccount).toBe(personal.binding.connection.account);
    const next = await local.search(undefined, "body search", true, page.nextPageUrl);
    expect(next.messages[0].sourceMessageId).toBe("older");
    expect(personal.local.search).toHaveBeenLastCalledWith(
      undefined,
      "body search",
      true,
      "local:30"
    );
    expect(work.local.search).toHaveBeenCalledTimes(1);
    expect(next.nextPageUrl).toBeUndefined();
  });

  it("maps inbox search to each real inbox and retains account warnings when one saved search fails", async () => {
    const [first, second] = accounts();
    const personal = withLocal(first);
    const work = withLocal(second);
    personal.local.search.mockResolvedValue({ messages: [message("saved")] });
    work.local.search.mockRejectedValue(new Error("Saved work inbox is unreadable."));
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    const page = await local.search("INBOX", "body");
    expect(personal.local.search).toHaveBeenCalledWith("INBOX", "body", false, undefined);
    expect(work.local.search).toHaveBeenCalledWith(
      "opaque-graph-inbox-id",
      "body",
      false,
      undefined
    );
    expect(page.accountWarnings?.[0]).toMatchObject({
      accountId: work.binding.id,
      message: "Saved work inbox is unreadable.",
    });
    personal.local.search.mockRejectedValue(new Error("Saved personal inbox is unreadable."));
    await expect(local.search("INBOX", "body")).rejects.toThrow(
      "None of your inboxes could be loaded"
    );
  });

  it("rejects foreign cursors and mismatched query/folder/filter context before any saved search", async () => {
    const [first, second] = accounts();
    const personal = withLocal(first);
    const work = withLocal(second);
    personal.local.search.mockResolvedValue({ messages: [], nextPageUrl: "local:30" });
    const local = createUnifiedMailConnector([personal.binding, work.binding]).local!;
    const page = await local.search("INBOX", "body", true);
    personal.local.search.mockClear();
    work.local.search.mockClear();
    const parsed = JSON.parse(page.nextPageUrl!);
    for (const cursor of [
      "invalid",
      "null",
      "[]",
      "{}",
      JSON.stringify({ [personal.binding.id]: "local:30" }),
      JSON.stringify({ ...parsed, cursors: { foreign: "local:30" } }),
      JSON.stringify({ ...parsed, cursors: { [personal.binding.id]: 30 } }),
      JSON.stringify({ ...parsed, query: "other" }),
      JSON.stringify({ ...parsed, scope: "demo:foreign" }),
    ]) {
      await expect(local.search("INBOX", "body", true, cursor)).rejects.toThrow(
        "saved search page expired"
      );
    }
    await expect(local.search(undefined, "body", true, page.nextPageUrl)).rejects.toThrow(
      "saved search page expired"
    );
    await expect(local.search("INBOX", "body", false, page.nextPageUrl)).rejects.toThrow(
      "saved search page expired"
    );
    expect(personal.local.search).not.toHaveBeenCalled();
    expect(work.local.search).not.toHaveBeenCalled();
  });
});
