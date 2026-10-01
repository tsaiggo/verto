import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailMessageAction, MailOutgoing } from "./model";

const auth = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("./google-auth", () => ({
  authorizeGoogleMail: auth.authorize,
  loadGoogleIdentity: vi.fn(),
}));
import { createGoogleMailConnector } from "./google";

const READ = "https://www.googleapis.com/auth/gmail.readonly";
const SEND = "https://www.googleapis.com/auth/gmail.send";
const UPDATE = "https://www.googleapis.com/auth/gmail.modify";
const outgoing: MailOutgoing = {
  to: ["bob@example.com"],
  cc: [],
  bcc: [],
  subject: "Hello",
  bodyText: "Body",
};

function fullMessage(labels: string[] = ["INBOX", "STARRED", "Label_custom"]) {
  return {
    id: "message/id",
    labelIds: labels,
    snippet: "Preview",
    payload: {
      mimeType: "multipart/mixed",
      headers: [{ name: "Subject", value: "Authoritative subject" }],
      parts: [
        { mimeType: "text/plain", body: { data: btoa("Full authoritative body") } },
        {
          filename: "report.pdf",
          mimeType: "application/pdf",
          body: { attachmentId: "file", size: 3 },
        },
      ],
    },
  };
}

function provider(labels?: string[]) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/profile")) return Response.json({ emailAddress: "alice@gmail.com" });
    if (url.endsWith("/labels")) return Response.json({ labels: [] });
    if (url.includes("/messages/message%2Fid?")) return Response.json(fullMessage(labels));
    if (init?.method === "POST") return Response.json({ id: "message/id" });
    throw new Error("Unexpected request");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  auth.authorize.mockReset().mockImplementation(async ({ scope }: { scope: string }) => ({
    token: scope === READ ? "read-token" : scope === SEND ? "send-token" : "update-token",
    expiresAt: Date.now() + 3600000,
  }));
  vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID", "client");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Gmail message mutations", () => {
  it("reuses granted updating permission across explicit action clicks", async () => {
    provider();
    const connector = createGoogleMailConnector();
    await connector.connect();
    await connector.enableUpdating!("message/id");
    await connector.mutateMessage!("message/id", { type: "read", value: true });
    await connector.enableUpdating!("message/id");
    await connector.mutateMessage!("message/id", { type: "star", value: true });
    expect(auth.authorize.mock.calls.filter(([options]) => options.scope === UPDATE)).toHaveLength(
      1
    );
  });

  it.each<[MailMessageAction, string, object | undefined]>([
    [{ type: "read", value: true }, "modify", { removeLabelIds: ["UNREAD"] }],
    [{ type: "read", value: false }, "modify", { addLabelIds: ["UNREAD"] }],
    [{ type: "star", value: true }, "modify", { addLabelIds: ["STARRED"] }],
    [{ type: "star", value: false }, "modify", { removeLabelIds: ["STARRED"] }],
    [{ type: "archive" }, "modify", { removeLabelIds: ["INBOX"] }],
    [{ type: "trash" }, "trash", undefined],
  ])(
    "writes %j with modify permission and rereads full details and actual labels",
    async (action, path, body) => {
      const fetchMock = provider(["UNREAD", "STARRED", "Label_custom"]);
      const connector = createGoogleMailConnector();
      await connector.connect();
      await expect(connector.mutateMessage!("message/id", action)).rejects.toThrow(
        "Enable Gmail updating"
      );
      expect(fetchMock).not.toHaveBeenCalled();
      await connector.enableUpdating!("message/id");
      expect(auth.authorize).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: UPDATE,
          requiredScopes: [READ, UPDATE],
          prompt: "consent",
        })
      );
      fetchMock.mockClear();
      const result = await connector.mutateMessage!("message/id", action);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/message%2Fid/${path}`
      );
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer update-token");
      expect(init?.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body);
      expect(fetchMock.mock.calls[1][0]).toContain("?format=full");
      expect(result).toMatchObject({
        message: {
          id: "message/id",
          subject: "Authoritative subject",
          bodyText: "Full authoritative body",
          isRead: false,
          isStarred: true,
          attachments: [{ id: "file" }],
        },
        folderIds: ["UNREAD", "STARRED", "Label_custom", "ARCHIVE"],
      });
    }
  );

  it("returns virtual Archive in folders but excludes trash, spam, drafts and inbox messages from Archive membership", async () => {
    const fetchMock = provider(["TRASH", "UNREAD"]);
    const connector = createGoogleMailConnector();
    await connector.connect();
    expect((await connector.restore())?.folders).toContainEqual(
      expect.objectContaining({ id: "ARCHIVE", kind: "archive" })
    );
    await connector.enableUpdating!();
    expect((await connector.mutateMessage!("message/id", { type: "trash" })).folderIds).toEqual([
      "TRASH",
      "UNREAD",
    ]);
    expect(fetchMock.mock.calls.every(([url]) => !url.endsWith("/delete"))).toBe(true);
  });

  it("keeps send and read access when updating is cancelled or granted for another account", async () => {
    const fetchMock = provider();
    const connector = createGoogleMailConnector();
    await connector.connect();
    await connector.enableSending!();
    auth.authorize.mockRejectedValueOnce(
      new Error("Google sign-in was cancelled or could not be completed.")
    );
    await expect(connector.enableUpdating!()).rejects.toThrow("cancelled");
    await connector.getMessage("message/id");
    await connector.sendMessage!(outgoing);
    expect(new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get("Authorization")).toBe(
      "Bearer send-token"
    );
    fetchMock.mockImplementationOnce(async () =>
      Response.json({ emailAddress: "other@gmail.com" })
    );
    await expect(connector.enableUpdating!()).rejects.toThrow("account you already connected");
    await connector.sendMessage!(outgoing);
  });

  it.each([true, false])(
    "retains granted permissions when expanding updating before sending=%s",
    async (sendFirst) => {
      provider();
      const connector = createGoogleMailConnector();
      await connector.connect();
      if (sendFirst) {
        await connector.enableSending!();
        await connector.enableUpdating!();
      } else {
        await connector.enableUpdating!();
        await connector.enableSending!();
      }
      expect(auth.authorize).toHaveBeenLastCalledWith(
        expect.objectContaining({
          requiredScopes: sendFirst ? [READ, UPDATE, SEND] : [READ, SEND, UPDATE],
        })
      );
      await connector.sendMessage!(outgoing);
      await connector.mutateMessage!("message/id", { type: "read", value: true });
    }
  );

  it("does not return an optimistic result on a failed write or an unreadable full reread", async () => {
    const fetchMock = provider();
    const connector = createGoogleMailConnector();
    await connector.connect();
    await connector.enableUpdating!();
    fetchMock.mockClear().mockImplementationOnce(async () => new Response(null, { status: 503 }));
    await expect(
      connector.mutateMessage!("message/id", { type: "read", value: true })
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock
      .mockImplementationOnce(async () => Response.json({ id: "message/id" }))
      .mockImplementationOnce(async () => Response.json({ id: "message/id" }));
    await expect(connector.mutateMessage!("message/id", { type: "archive" })).rejects.toThrow(
      "unreadable update"
    );
  });

  it("rejects invalid actions before authorizing or making a request", async () => {
    const fetchMock = provider();
    const connector = createGoogleMailConnector();
    await expect(
      connector.mutateMessage!("message/id", {
        type: "read",
        value: "true",
      } as unknown as MailMessageAction)
    ).rejects.toThrow("invalid");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.authorize).not.toHaveBeenCalled();
  });
});
