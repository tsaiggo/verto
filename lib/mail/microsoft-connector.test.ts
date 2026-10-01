import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  const account = { homeAccountId: "account-1", username: "alice@outlook.com" };
  return {
    account,
    initialize: vi.fn(async () => undefined),
    handleRedirectPromise: vi.fn(async () => null),
    getActiveAccount: vi.fn(() => account),
    getAllAccounts: vi.fn(() => [account]),
    setActiveAccount: vi.fn(),
    acquireTokenSilent: vi.fn(async () => ({
      accessToken: "graph-token",
      scopes: ["Mail.Read", "User.Read"],
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Outlook connector", () => {
  it.each([
    "https://evil.example/steal",
    "https://graph.microsoft.com/v1.0/me/mailFolders/other/messages?$skip=30",
    "https://graph.microsoft.com/v1.0/me/mailfolders('other')/messages?$skip=30",
    "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox-id/messages?$skip=30",
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages/delta?$skiptoken=x",
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages/steal",
    "https://user:password@graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages",
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages#fragment",
    "invalid",
  ])("rejects invalid list continuation %s before acquiring a token", async (pageUrl) => {
    vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID", "microsoft-client");
    auth.acquireTokenSilent.mockClear();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createMicrosoftMailConnector().listMessages("inbox-id", pageUrl)).rejects.toThrow(
      "pagination link was invalid"
    );
    expect(auth.acquireTokenSilent).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts opaque OData list links for the same folder and rejects a foreign returned link before publishing it", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID", "microsoft-client");
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
    const next =
      "https://graph.microsoft.com/v1.0/me/mailfolders('folder%2Fid')/messages?$skiptoken=opaque";
    const fetchMock = vi.fn(async (url: string) => {
      expect(new URL(url).origin).toBe("https://graph.microsoft.com");
      return Response.json({ value: [], "@odata.nextLink": next });
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = createMicrosoftMailConnector();
    expect((await connector.listMessages("folder/id")).nextPageUrl).toBe(next);
    await connector.listMessages("folder/id", next);
    expect(fetchMock.mock.calls[1][0]).toBe(next);
    fetchMock.mockImplementationOnce(async () =>
      Response.json({
        value: [],
        "@odata.nextLink":
          "https://graph.microsoft.com/v1.0/me/mailFolders/other/messages?$skip=30",
      })
    );
    await expect(connector.listMessages("folder/id")).rejects.toThrow(
      "pagination link was invalid"
    );
  });

  it("restores an account, reads folders and messages, and rejects foreign pagination URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID", "microsoft-client");
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer graph-token");
      if (url.includes("/me?$select=")) {
        return Response.json({ id: "user-1", displayName: "Alice", mail: "alice@outlook.com" });
      }
      const standard = ["inbox", "sentitems", "drafts", "archive", "deleteditems"];
      const standardName = standard.find((name) => url.includes(`/me/mailFolders/${name}?`));
      if (standardName) {
        return Response.json({
          id: `${standardName}-id`,
          displayName: standardName,
          unreadItemCount: 2,
        });
      }
      if (url.includes("/me/mailFolders?$select=")) {
        return Response.json({
          value: [
            { id: "inbox-id", displayName: "Inbox", unreadItemCount: 2 },
            { id: "custom-id", displayName: "Research", unreadItemCount: 1, childFolderCount: 1 },
          ],
        });
      }
      if (url.includes("/me/mailFolders/custom-id/childFolders?")) {
        return Response.json({
          value: [{ id: "nested-id", displayName: "2026", unreadItemCount: 0 }],
        });
      }
      if (url.includes("/mailFolders/inbox-id/messages?")) {
        return Response.json({
          value: [
            {
              id: "m1",
              subject: "Update",
              from: { emailAddress: { address: "bob@example.com" } },
              isRead: false,
            },
          ],
          "@odata.nextLink":
            "https://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages?$skip=30",
        });
      }
      if (url.includes("/me/messages/m1?")) {
        expect(new Headers(init?.headers).get("Prefer")).toBe('outlook.body-content-type="text"');
        return Response.json({
          id: "m1",
          subject: "Update",
          body: { contentType: "text", content: "Plain body" },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = createMicrosoftMailConnector();
    expect(connector.isConfigured()).toBe(true);
    const connection = await connector.restore();
    expect(auth.initialize).toHaveBeenCalledOnce();
    expect(auth.handleRedirectPromise).toHaveBeenCalledOnce();
    expect(connection?.account).toMatchObject({
      address: "alice@outlook.com",
      displayName: "Alice",
    });
    expect(connection?.folders).toContainEqual({
      id: "custom-id",
      name: "Research",
      kind: "custom",
      unreadCount: 1,
    });
    expect(connection?.folders).toContainEqual({
      id: "nested-id",
      name: "Research / 2026",
      kind: "custom",
      unreadCount: 0,
    });
    expect(connection?.folders.filter((folder) => folder.id === "inbox-id")).toHaveLength(1);

    const page = await connector.listMessages("inbox-id");
    expect(page).toMatchObject({ messages: [{ id: "m1", subject: "Update", isRead: false }] });
    expect(page.nextPageUrl).toContain("$skip=30");
    expect(await connector.getMessage("m1")).toMatchObject({ bodyText: "Plain body" });
    await expect(connector.listMessages("inbox-id", "https://example.com/steal")).rejects.toThrow(
      "pagination link was invalid"
    );
    await connector.connect();
    expect(auth.loginRedirect).toHaveBeenCalledWith({ scopes: ["Mail.Read", "User.Read"] });
    await connector.disconnect();
    expect(auth.clearCache).toHaveBeenCalledWith({ account: auth.account });
  });
});
