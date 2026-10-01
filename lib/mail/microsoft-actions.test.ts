import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailOutgoing } from "./model";

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
    clearCache: vi.fn(async () => undefined),
  };
});
vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: vi.fn(function () {
    return auth;
  }),
}));
import { createMicrosoftMailConnector } from "./microsoft";

const outgoing: MailOutgoing = {
  to: ["Bob <BOB@example.com>"],
  cc: ["copy@example.com"],
  bcc: ["hidden@example.com"],
  subject: 'Hello "世界"',
  bodyText: "<script>literal</script>\nSecond line",
};

beforeEach(() => {
  vi.clearAllMocks();
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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Outlook send actions", () => {
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
