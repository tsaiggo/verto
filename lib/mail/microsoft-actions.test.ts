import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailOutgoing } from "./model";
import { createDraft } from "./drafts";
import { parseMailRecipients } from "./addresses";
import { MailConnectionUnavailableError, isRetryableMailConnectionError } from "./http";

const auth = vi.hoisted(() => {
  const account = { homeAccountId: "account-1", username: "alice@outlook.com" };
  return {
    account,
    initialize: vi.fn(async () => undefined),
    handleRedirectPromise: vi.fn(async () => null),
    getActiveAccount: vi.fn(() => account),
    getAllAccounts: vi.fn(() => [account]),
    setActiveAccount: vi.fn(),
    acquireTokenSilent: vi.fn(async ({ scopes }: { scopes: string[] }) => ({
      accessToken: scopes.includes("Mail.Send") ? "send-token" : "read-token",
      scopes,
      account,
    })),
    acquireTokenPopup: vi.fn(async () => ({
      accessToken: "send-token",
      scopes: ["Mail.Send"],
      account,
    })),
    loginRedirect: vi.fn(async () => undefined),
    loginPopup: vi.fn(async () => ({ account })),
    clearCache: vi.fn(async () => undefined),
  };
});
vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: vi.fn(function () {
    return auth;
  }),
}));
import { createMicrosoftMailConnector } from "./microsoft";
import { createMailConnector } from "./connectors";

const outgoing: MailOutgoing = {
  to: ["Bob <BOB@example.com>"],
  cc: ["copy@example.com"],
  bcc: ["hidden@example.com"],
  subject: 'Hello "世界"',
  bodyText: "<script>literal</script>\nSecond line",
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.getActiveAccount.mockReturnValue(auth.account);
  auth.getAllAccounts.mockReturnValue([auth.account]);
  auth.loginPopup.mockResolvedValue({ account: auth.account });
  auth.acquireTokenSilent.mockImplementation(async ({ scopes }) => ({
    accessToken: scopes.includes("Mail.Send") ? "send-token" : "read-token",
    scopes,
    account: auth.account,
  }));
  auth.acquireTokenPopup.mockImplementation(async () => ({
    accessToken: "send-token",
    scopes: ["Mail.Send"],
    account: auth.account,
  }));
  vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID", "client");
  vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
});

describe("Outlook mailbox identity through the connector factory", () => {
  const smtpAddress = "primary@company.example";

  function mailboxFetch() {
    const fetchMock = vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/v1.0/me")
        return Response.json({
          id: "graph-user",
          displayName: "Primary mailbox",
          mail: smtpAddress,
          userPrincipalName: auth.account.username,
        });
      if (path === "/v1.0/me/mailFolders") return Response.json({ value: [] });
      const name = path.split("/").at(-1);
      return Response.json({ id: `folder-${name}`, displayName: name });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("silently restores the saved opaque account when its SMTP address differs from the MSAL username", async () => {
    mailboxFetch();
    auth.getActiveAccount.mockReturnValue({
      homeAccountId: "other-account",
      username: smtpAddress,
    });
    const connector = createMailConnector("microsoft", smtpAddress, "account-1");
    expect((await connector.restore())?.account).toEqual({
      id: "account-1",
      address: smtpAddress,
      displayName: "Primary mailbox",
      provider: "microsoft",
    });
    expect(auth.acquireTokenSilent).toHaveBeenCalledWith({
      account: auth.account,
      scopes: ["Mail.Read", "User.Read"],
    });
    expect(auth.loginPopup).not.toHaveBeenCalled();
    expect(auth.loginRedirect).not.toHaveBeenCalled();
    expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
  });

  it("accepts explicit reconnect for the saved opaque account despite a different MSAL username", async () => {
    mailboxFetch();
    const connector = createMailConnector("microsoft", smtpAddress, "account-1");
    await connector.connect();
    expect(auth.loginPopup).toHaveBeenCalledExactlyOnceWith({
      scopes: ["Mail.Read", "User.Read"],
      prompt: "select_account",
    });
    expect((await connector.restore())?.account).toMatchObject({
      id: "account-1",
      address: smtpAddress,
    });
  });

  it("rejects a different opaque account even when its username matches the saved SMTP address", async () => {
    const fetchMock = mailboxFetch();
    auth.loginPopup.mockResolvedValueOnce({
      account: { homeAccountId: "wrong-account", username: smtpAddress },
    });
    const connector = createMailConnector("microsoft", smtpAddress, "account-1");
    await expect(connector.connect()).rejects.toThrow(
      "sign-in was cancelled or could not be completed"
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.acquireTokenSilent).not.toHaveBeenCalled();
  });

  it("retains the username check when reconnecting without a saved opaque account", async () => {
    const fetchMock = mailboxFetch();
    await expect(createMailConnector("microsoft", smtpAddress).connect()).rejects.toThrow(
      "sign-in was cancelled or could not be completed"
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(
      createMailConnector("microsoft", auth.account.username).connect()
    ).resolves.toBeUndefined();
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Outlook send actions", () => {
  it("keeps a temporary inbox restore failure retryable instead of reporting missing authorization", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/mailFolders/inbox?")) return new Response(null, { status: 503 });
        if (url.includes("/mailFolders/")) return Response.json({ id: url, displayName: "Folder" });
        return Response.json({ id: "profile", mail: auth.account.username, displayName: "Alice" });
      })
    );
    const connector = createMicrosoftMailConnector();
    const failure = await connector.restore().catch((error: unknown) => error);
    expect(isRetryableMailConnectionError(failure)).toBe(true);
    expect(failure).toMatchObject({ status: 503 });
    expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
    expect(auth.loginRedirect).not.toHaveBeenCalled();
  });

  it("connects with read scopes and enables sending separately before making a send or native reply request", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("https://graph.microsoft.com/");
      expect(init?.method).toBe("POST");
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    await connector.connect();
    expect(auth.loginRedirect).toHaveBeenCalledWith({ scopes: ["Mail.Read", "User.Read"] });
    expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("Enable Outlook sending");
    expect(fetchMock).not.toHaveBeenCalled();
    await connector.enableSending!();
    expect(auth.acquireTokenPopup).toHaveBeenCalledWith({
      account: auth.account,
      scopes: ["Mail.Send"],
      prompt: "consent",
    });
    await connector.sendMessage!(outgoing);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
    expect(options.method).toBe("POST");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer send-token");
    expect(JSON.parse(options.body as string)).toEqual({
      message: {
        subject: outgoing.subject,
        body: { contentType: "Text", content: outgoing.bodyText },
        toRecipients: [{ emailAddress: { address: "bob@example.com" } }],
        ccRecipients: [{ emailAddress: { address: "copy@example.com" } }],
        bccRecipients: [{ emailAddress: { address: "hidden@example.com" } }],
      },
      saveToSentItems: true,
    });
    await connector.sendMessage!({
      ...outgoing,
      replyToMessageId: "original/id",
      internetMessageId: "<parent@example.com>",
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://graph.microsoft.com/v1.0/me/messages/original%2Fid/reply"
    );
    expect(
      JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)
    ).not.toHaveProperty("comment");
    expect(auth.acquireTokenSilent).toHaveBeenLastCalledWith({
      account: auth.account,
      scopes: ["Mail.Send"],
    });
    await connector.disconnect();
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("Enable Outlook sending");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects denied consent and missing silent token scopes without posting", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    auth.acquireTokenPopup.mockResolvedValueOnce({
      accessToken: "secret-token",
      scopes: ["Mail.Read"],
      account: auth.account,
    });
    await expect(connector.enableSending!()).rejects.toThrow("send permission was not granted");
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("Enable Outlook sending");
    await connector.enableSending!();
    auth.acquireTokenSilent.mockResolvedValueOnce({
      accessToken: "secret-token",
      scopes: ["Mail.Read"],
      account: auth.account,
    });
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow(
      "send permission was not granted"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects send permission for another account and sanitizes SDK errors", async () => {
    const connector = createMicrosoftMailConnector();
    auth.acquireTokenPopup.mockResolvedValueOnce({
      accessToken: "token",
      scopes: ["Mail.Send"],
      account: { ...auth.account, homeAccountId: "other-account" },
    });
    await expect(connector.enableSending!()).rejects.toThrow("account you already connected");
    auth.acquireTokenPopup.mockRejectedValueOnce(new Error("secret-token"));
    await expect(connector.enableSending!()).rejects.toThrow("cancelled or could not be granted");
  });

  it("validates outgoing fields without requesting tokens or sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    await expect(connector.sendMessage!({ ...outgoing, to: ["broken-address"] })).rejects.toThrow(
      "valid email addresses"
    );
    await expect(
      connector.sendMessage!({ ...outgoing, subject: "Header\r\nBcc: bad@example.com" })
    ).rejects.toThrow("control characters");
    expect(auth.acquireTokenSilent).not.toHaveBeenCalled();
    expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects read tokens missing the granted read scope", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    auth.acquireTokenSilent.mockResolvedValueOnce({
      accessToken: "token",
      scopes: ["User.Read"],
      account: auth.account,
    });
    await expect(createMicrosoftMailConnector().listMessages("inbox")).rejects.toThrow(
      "read permission was not granted"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Outlook moved reply targets", () => {
  const internetMessageId = "<o'brien@example.com>";
  const reply = { ...outgoing, replyToMessageId: "original/id", internetMessageId };
  const missing = () => Response.json({ error: { code: "ErrorItemNotFound" } }, { status: 404 });

  function lookupFetch(page: (url: URL) => Response | Promise<Response>, retryStatus = 202) {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/original%2Fid/reply")) return missing();
      if (new URL(url).pathname === "/v1.0/me/messages") {
        expect(init?.method).toBeUndefined();
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer read-token");
        return page(new URL(url));
      }
      expect(url).toBe("https://graph.microsoft.com/v1.0/me/messages/moved%2Fid/reply");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer send-token");
      return new Response(null, { status: retryStatus });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it.each(["archive", "trash", "external"] as const)(
    "replies to the same original message after a %s move with an existing reply-all draft",
    async (move) => {
      let currentId = "original/id";
      const message = () => ({
        id: currentId,
        internetMessageId,
        subject: "Project details",
        from: { emailAddress: { address: "sender@example.com" } },
        toRecipients: [{ emailAddress: { address: "alice@outlook.com" } }],
        ccRecipients: [{ emailAddress: { address: "copy@example.com" } }],
        body: { content: "Original body", contentType: "Text" },
        parentFolderId: currentId === "original/id" ? "inbox" : move,
        isRead: true,
      });
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/original%2Fid/move")) {
          currentId = "moved/id";
          return Response.json(message());
        }
        if (new URL(url).pathname === "/v1.0/me/messages") {
          expect(new URL(url).searchParams.get("$filter")).toBe(
            "internetMessageId eq '<o''brien@example.com>'"
          );
          return Response.json({ value: [message()] });
        }
        if (url.endsWith("/original%2Fid/reply")) return missing();
        if (url.endsWith("/moved%2Fid/reply")) {
          expect(init?.method).toBe("POST");
          return new Response(null, { status: 202 });
        }
        return Response.json(message());
      });
      vi.stubGlobal("fetch", fetchMock);
      const connector = createMicrosoftMailConnector();
      const original = await connector.getMessage("original/id");
      const draft = createDraft("replyAll", original, {
        provider: "microsoft",
        address: "alice@outlook.com",
      });
      if (move === "external") currentId = "moved/id";
      else {
        auth.acquireTokenPopup.mockResolvedValueOnce({
          accessToken: "update-token",
          scopes: ["Mail.ReadWrite"],
          account: auth.account,
        });
        await connector.enableUpdating!();
        expect((await connector.mutateMessage!(original.id, { type: move })).message.id).toBe(
          "moved/id"
        );
      }
      expect(draft.replyToMessageId).toBe("original/id");
      await connector.enableSending!();
      await connector.sendMessage!({
        to: parseMailRecipients(draft.to),
        cc: parseMailRecipients(draft.cc),
        bcc: [],
        subject: draft.subject,
        bodyText: "My reply" + draft.bodyText,
        replyToMessageId: draft.replyToMessageId,
        internetMessageId: draft.internetMessageId,
      });
      const replies = fetchMock.mock.calls.filter(([url]) => url.endsWith("/reply"));
      expect(replies.map(([url]) => url)).toEqual([
        "https://graph.microsoft.com/v1.0/me/messages/original%2Fid/reply",
        "https://graph.microsoft.com/v1.0/me/messages/moved%2Fid/reply",
      ]);
      expect(JSON.parse(replies[1][1]?.body as string)).toEqual({
        message: {
          subject: "Re: Project details",
          body: { contentType: "Text", content: "My reply" + draft.bodyText },
          toRecipients: [{ emailAddress: { address: "sender@example.com" } }],
          ccRecipients: [{ emailAddress: { address: "copy@example.com" } }],
          bccRecipients: [],
        },
      });
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/sendMail"))).toBe(false);
    }
  );

  it("escapes the exact Internet Message ID and follows only its mailbox lookup pages", async () => {
    const fetchMock = lookupFetch((url) => {
      expect(url.searchParams.get("$filter")).toBe("internetMessageId eq '<o''brien@example.com>'");
      expect(url.searchParams.get("$select")).toBe("id,internetMessageId");
      expect(url.searchParams.get("$top")).toBe("2");
      if (url.searchParams.has("$skip"))
        return Response.json({ value: [{ id: "moved/id", internetMessageId }] });
      url.searchParams.set("$skip", "2");
      return Response.json({ value: [], "@odata.nextLink": url.toString() });
    });
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    await connector.sendMessage!(reply);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(auth.acquireTokenSilent.mock.calls.map(([request]) => request)).toEqual([
      { account: auth.account, scopes: ["Mail.Send"] },
      { account: auth.account, scopes: ["Mail.Read", "User.Read"] },
    ]);
  });

  it.each([
    { name: "no matching original", value: [], error: "no longer available" },
    {
      name: "two matching originals",
      value: [
        { id: "first", internetMessageId },
        { id: "second", internetMessageId },
      ],
      error: "More than one",
    },
    {
      name: "a different Internet Message ID",
      value: [{ id: "moved/id", internetMessageId: "<other@example.com>" }],
      error: "unreadable",
    },
  ])("rejects $name without posting another reply", async ({ value, error }) => {
    const fetchMock = lookupFetch(() => Response.json({ value }));
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    await expect(connector.sendMessage!(reply)).rejects.toThrow(error);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects ambiguity appearing on a later lookup page", async () => {
    const fetchMock = lookupFetch((url) => {
      const id = url.searchParams.has("$skip") ? "second" : "first";
      if (id === "second") return Response.json({ value: [{ id, internetMessageId }] });
      url.searchParams.set("$skip", "2");
      return Response.json({
        value: [{ id, internetMessageId }],
        "@odata.nextLink": url.toString(),
      });
    });
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    await expect(connector.sendMessage!(reply)).rejects.toThrow("More than one");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    "https://attacker.example/v1.0/me/messages",
    "https://graph.microsoft.com/v1.0/users/other/messages",
    "https://user:password@graph.microsoft.com/v1.0/me/messages",
    "https://graph.microsoft.com/v1.0/me/messages#fragment",
    "https://graph.microsoft.com/v1.0/me/messages?$filter=internetMessageId+eq+'other'",
  ])("rejects an unsafe lookup continuation %s before following it", async (nextLink) => {
    const fetchMock = lookupFetch(() =>
      Response.json({ value: [{ id: "moved/id", internetMessageId }], "@odata.nextLink": nextLink })
    );
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    await expect(connector.sendMessage!(reply)).rejects.toThrow("lookup link was invalid");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 429, 503])("never retries an initial %i reply failure", async (status) => {
    const fetchMock = vi.fn(async () => new Response(null, { status }));
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    await expect(connector.sendMessage!(reply)).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a reply whose network result is uncertain", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("secret-token");
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    const error = await connector.sendMessage!(reply).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(MailConnectionUnavailableError);
    expect(isRetryableMailConnectionError(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a missing original without an Internet Message ID as a failure", async () => {
    const fetchMock = vi.fn(async () => missing());
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    await expect(
      connector.sendMessage!({ ...reply, internetMessageId: undefined })
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not use a lookup token belonging to a different account", async () => {
    const fetchMock = lookupFetch(() => Response.json({ value: [] }));
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    auth.acquireTokenSilent
      .mockImplementationOnce(async ({ scopes }) => ({
        accessToken: "send-token",
        scopes,
        account: auth.account,
      }))
      .mockResolvedValueOnce({
        accessToken: "other-read-token",
        scopes: ["Mail.Read", "User.Read"],
        account: { ...auth.account, homeAccountId: "other-account" },
      });
    await expect(connector.sendMessage!(reply)).rejects.toThrow("account changed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry after disconnect while the original lookup is pending", async () => {
    let resolveLookup!: (response: Response) => void;
    const lookup = new Promise<Response>((resolve) => {
      resolveLookup = resolve;
    });
    const fetchMock = lookupFetch(() => lookup);
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    const sending = connector.sendMessage!(reply);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await connector.disconnect();
    resolveLookup(Response.json({ value: [{ id: "moved/id", internetMessageId }] }));
    await expect(sending).rejects.toThrow("connection was cancelled");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates a recovered reply failure without another retry", async () => {
    const fetchMock = lookupFetch(
      () => Response.json({ value: [{ id: "moved/id", internetMessageId }] }),
      503
    );
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    await expect(connector.sendMessage!(reply)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("Outlook attachment actions", () => {
  const file = {
    id: "file/id",
    name: "report.pdf",
    contentType: "application/pdf",
    size: 3,
    "@odata.type": "#microsoft.graph.fileAttachment",
  };
  it("lists attachment metadata on demand and downloads actual bytes without send consent", async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer read-token");
      if (url.includes("/messages/message%2Fid?"))
        return Response.json({
          id: "message/id",
          from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
          ccRecipients: [{ emailAddress: { address: "copy@example.com" } }],
          replyTo: [{ emailAddress: { address: "reply@example.com" } }],
          internetMessageId: "<parent@example.com>",
          hasAttachments: true,
        });
      if (url.includes("/attachments?$select="))
        return Response.json({
          value: [
            file,
            { ...file, id: "inline", isInline: true },
            { ...file, id: "link", "@odata.type": "#microsoft.graph.referenceAttachment" },
          ],
        });
      if (url.endsWith("/attachments/file%2Fid")) return Response.json(file);
      if (url.endsWith("/attachments/file%2Fid/$value"))
        return new Response(Uint8Array.from([0, 255, 42]), {
          headers: { "Content-Type": "application/pdf" },
        });
      throw new Error("Unexpected request");
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    const detail = await connector.getMessage("message/id");
    expect(detail).toMatchObject({
      from: "Alice <alice@example.com>",
      cc: ["copy@example.com"],
      replyTo: ["reply@example.com"],
      internetMessageId: "<parent@example.com>",
      attachments: [{ id: "file/id", name: "report.pdf", mimeType: "application/pdf", size: 3 }],
    });
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/$value"))).toBe(false);
    const blob = await connector.getAttachment!("message/id", detail.attachments![0]);
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 255, 42]);
    expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
  });

  it("rejects foreign attachment pagination before exposing a token", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/messages/message?")
        ? Response.json({ id: "message", hasAttachments: true })
        : Response.json({ value: [], "@odata.nextLink": "https://attacker.example/steal" })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(createMicrosoftMailConnector().getMessage("message")).rejects.toThrow(
      "attachment pagination link was invalid"
    );
    expect(
      fetchMock.mock.calls.every(([url]) => url.startsWith("https://graph.microsoft.com/"))
    ).toBe(true);
  });
});
