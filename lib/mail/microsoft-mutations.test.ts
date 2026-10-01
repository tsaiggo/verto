import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailMessageAction, MailOutgoing } from "./model";
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
    acquireTokenSilent: vi.fn(),
    acquireTokenPopup: vi.fn(),
    loginRedirect: vi.fn(),
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
  to: ["bob@example.com"],
  cc: [],
  bcc: [],
  subject: "Hello",
  bodyText: "Body",
};

function provider() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/sendMail")) return new Response(null, { status: 202 });
    if (init?.method === "PATCH" || init?.method === "POST")
      return Response.json(
        { id: init.method === "POST" ? "moved/id" : "message/id" },
        { status: init.method === "POST" ? 201 : 200 }
      );
    if (url.includes("/attachments?"))
      return Response.json({
        value: [
          {
            id: "file",
            name: "report.pdf",
            size: 3,
            contentType: "application/pdf",
            "@odata.type": "#microsoft.graph.fileAttachment",
          },
        ],
      });
    if (url.includes("/messages/"))
      return Response.json({
        id: url.includes("moved%2Fid") ? "moved/id" : "message/id",
        parentFolderId: "actual/folder",
        subject: "Authoritative subject",
        isRead: false,
        flag: { flagStatus: "flagged" },
        body: { content: "Full authoritative body", contentType: "text" },
        hasAttachments: true,
      });
    throw new Error("Unexpected request");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  const result = async ({ scopes }: { scopes: string[] }) => ({
    accessToken: scopes.includes("Mail.ReadWrite")
      ? "update-token"
      : scopes.includes("Mail.Send")
        ? "send-token"
        : "read-token",
    scopes,
    account: auth.account,
  });
  auth.acquireTokenSilent.mockReset().mockImplementation(result);
  auth.acquireTokenPopup.mockReset().mockImplementation(result);
  vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID", "client");
  vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Outlook message mutations", () => {
  it("reuses the account's updating grant across explicit action clicks", async () => {
    provider();
    const connector = createMicrosoftMailConnector();
    await connector.enableUpdating!("message/id");
    await connector.mutateMessage!("message/id", { type: "read", value: true });
    await connector.enableUpdating!("message/id");
    await connector.mutateMessage!("message/id", { type: "star", value: true });
    expect(auth.acquireTokenPopup).toHaveBeenCalledTimes(1);
    expect(auth.acquireTokenSilent).toHaveBeenCalledTimes(2);
  });

  it.each<[MailMessageAction, string, object]>([
    [{ type: "read", value: true }, "PATCH", { isRead: true }],
    [{ type: "read", value: false }, "PATCH", { isRead: false }],
    [{ type: "star", value: true }, "PATCH", { flag: { flagStatus: "flagged" } }],
    [{ type: "star", value: false }, "PATCH", { flag: { flagStatus: "notFlagged" } }],
    [{ type: "archive" }, "POST", { destinationId: "archive" }],
    [{ type: "trash" }, "POST", { destinationId: "deleteditems" }],
  ])(
    "writes %j using Mail.ReadWrite then fetches the returned ID and full membership",
    async (action, method, body) => {
      const fetchMock = provider();
      const connector = createMicrosoftMailConnector();
      await expect(connector.mutateMessage!("message/id", action)).rejects.toThrow(
        "Enable Outlook updating"
      );
      expect(auth.acquireTokenSilent).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      await connector.enableUpdating!("message/id");
      expect(auth.acquireTokenPopup).toHaveBeenCalledWith({
        account: auth.account,
        scopes: ["Mail.ReadWrite"],
        prompt: "consent",
      });
      const result = await connector.mutateMessage!("message/id", action);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        `https://graph.microsoft.com/v1.0/me/messages/message%2Fid${method === "POST" ? "/move" : ""}`
      );
      expect(init?.method).toBe(method);
      expect(JSON.parse(init?.body as string)).toEqual(body);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer update-token");
      const id = method === "POST" ? "moved/id" : "message/id";
      expect(fetchMock.mock.calls[1][0]).toContain(`/messages/${encodeURIComponent(id)}?`);
      expect(fetchMock.mock.calls[2][0]).toContain(
        `/messages/${encodeURIComponent(id)}/attachments?`
      );
      expect(result).toMatchObject({
        message: {
          id,
          subject: "Authoritative subject",
          bodyText: "Full authoritative body",
          isRead: false,
          isStarred: true,
          attachments: [{ id: "file" }],
        },
        folderIds: ["actual/folder"],
      });
      expect(auth.acquireTokenSilent).toHaveBeenLastCalledWith({
        account: auth.account,
        scopes: ["Mail.ReadWrite"],
      });
      expect(fetchMock.mock.calls.every(([, request]) => request?.method !== "DELETE")).toBe(true);
    }
  );

  it("keeps send and read access when update permission is cancelled or bound to a different account", async () => {
    const fetchMock = provider();
    const connector = createMicrosoftMailConnector();
    await connector.enableSending!();
    auth.acquireTokenPopup.mockRejectedValueOnce(new Error("secret-token"));
    await expect(connector.enableUpdating!()).rejects.toThrow("update permission was cancelled");
    await connector.getMessage("message/id");
    await connector.sendMessage!(outgoing);
    expect(new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get("Authorization")).toBe(
      "Bearer send-token"
    );
    auth.acquireTokenPopup.mockResolvedValueOnce({
      accessToken: "secret-token",
      scopes: ["Mail.ReadWrite"],
      account: { ...auth.account, homeAccountId: "other-account" },
    });
    await expect(connector.enableUpdating!()).rejects.toThrow("account you already connected");
    await connector.sendMessage!(outgoing);
    await expect(connector.mutateMessage!("message/id", { type: "archive" })).rejects.toThrow(
      "Enable Outlook updating"
    );
  });

  it("rejects denied update scopes without changing an existing connection", async () => {
    provider();
    const connector = createMicrosoftMailConnector();
    auth.acquireTokenPopup.mockResolvedValueOnce({
      accessToken: "secret-token",
      scopes: ["Mail.Read"],
      account: auth.account,
    });
    await expect(connector.enableUpdating!()).rejects.toThrow("update permission was not granted");
    await connector.getMessage("message/id");
    await connector.enableUpdating!();
    auth.acquireTokenSilent.mockResolvedValueOnce({
      accessToken: "secret-token",
      scopes: ["Mail.Read"],
      account: auth.account,
    });
    await expect(
      connector.mutateMessage!("message/id", { type: "read", value: true })
    ).rejects.toThrow("update permission was not granted");
  });

  it("does not return a success after a failed mutation or missing authoritative membership", async () => {
    const fetchMock = provider();
    const connector = createMicrosoftMailConnector();
    await connector.enableUpdating!();
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 503 }));
    await expect(
      connector.mutateMessage!("message/id", { type: "read", value: true })
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock
      .mockImplementationOnce(async () => Response.json({ id: "moved/id" }))
      .mockImplementationOnce(async () =>
        Response.json({ id: "moved/id", body: { content: "Body" } })
      );
    await expect(connector.mutateMessage!("message/id", { type: "archive" })).rejects.toThrow(
      "unreadable update"
    );
  });

  it("rejects invalid actions before requesting a token or touching mail", async () => {
    const fetchMock = provider();
    await expect(
      createMicrosoftMailConnector().mutateMessage!("message/id", {
        type: "star",
        value: "true",
      } as unknown as MailMessageAction)
    ).rejects.toThrow("invalid");
    expect(auth.acquireTokenSilent).not.toHaveBeenCalled();
    expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Outlook silent token failures", () => {
  it.each(["network_error", "post_request_failed", "monitor_window_timeout"])(
    "permits retry after transient %s without claiming the session expired",
    async (errorCode) => {
      const fetchMock = provider();
      const connector = createMicrosoftMailConnector();
      auth.acquireTokenSilent.mockRejectedValueOnce({ errorCode, message: "secret-token" });
      const error = await connector.getMessage("message/id").catch((error: unknown) => error);
      expect(error).toBeInstanceOf(MailConnectionUnavailableError);
      expect(isRetryableMailConnectionError(error)).toBe(true);
      expect(String(error)).toContain("Check your connection and try again");
      expect(String(error)).not.toContain("secret-token");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
      expect((await connector.getMessage("message/id")).bodyText).toBe("Full authoritative body");
    }
  );

  it.each([
    "interaction_required",
    "login_required",
    "consent_required",
    "no_account_error",
    "no_tokens_found",
  ])("asks for explicit reconnect on authentication failure %s", async (errorCode) => {
    const fetchMock = provider();
    auth.acquireTokenSilent.mockRejectedValueOnce({ errorCode, message: "secret-token" });
    const error = await createMicrosoftMailConnector()
      .getMessage("message/id")
      .catch((error: unknown) => error);
    expect(String(error)).toContain("Your Outlook session expired. Reconnect to continue.");
    expect(error).not.toBeInstanceOf(MailConnectionUnavailableError);
    expect(isRetryableMailConnectionError(error)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.acquireTokenPopup).not.toHaveBeenCalled();
  });

  it("recognizes InteractionRequiredAuthError even when its server code differs", async () => {
    auth.acquireTokenSilent.mockRejectedValueOnce({
      name: "InteractionRequiredAuthError",
      errorCode: "bad_token",
      message: "secret-token",
    });
    const error = await createMicrosoftMailConnector()
      .getMessage("message/id")
      .catch((error: unknown) => error);
    expect(String(error)).toContain("session expired. Reconnect");
    expect(isRetryableMailConnectionError(error)).toBe(false);
  });
});
