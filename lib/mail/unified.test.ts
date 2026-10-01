import { describe, expect, it, vi } from "vitest";
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
