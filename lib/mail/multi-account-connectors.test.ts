import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleMailConnector } from "./google";
import type { MailOutgoing } from "./model";

const auth = vi.hoisted(() => {
  const first = {
    homeAccountId: "personal.tenant",
    username: "personal@outlook.com",
    name: "Personal",
  };
  const second = { homeAccountId: "work.tenant", username: "work@outlook.com", name: "Work" };
  return {
    first,
    second,
    initialize: vi.fn(async () => undefined),
    handleRedirectPromise: vi.fn(async () => null),
    getActiveAccount: vi.fn(() => second),
    getAllAccounts: vi.fn(() => [first, second]),
    setActiveAccount: vi.fn(),
    acquireTokenSilent: vi.fn(
      async ({ account, scopes }: { account: typeof first; scopes: string[] }) => ({
        accessToken: `${account.homeAccountId}:${scopes.includes("Mail.Send") ? "send" : "read"}`,
        scopes,
        account,
      })
    ),
    acquireTokenPopup: vi.fn(async ({ account }: { account: typeof first }) => ({
      accessToken: `${account.homeAccountId}:send`,
      scopes: ["Mail.Send"],
      account,
    })),
    loginPopup: vi.fn(async () => ({
      accessToken: "work.tenant:read",
      account: second,
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
import { createMicrosoftMailConnector, getCachedMicrosoftMailConnectors } from "./microsoft";

const outgoing: MailOutgoing = {
  to: ["recipient@example.com"],
  cc: [],
  bcc: [],
  subject: "Hello",
  bodyText: "Message",
};
const READ = "https://www.googleapis.com/auth/gmail.readonly";
const SEND = "https://www.googleapis.com/auth/gmail.send";

beforeEach(() => {
  vi.clearAllMocks();
  auth.getActiveAccount.mockReturnValue(auth.second);
  auth.getAllAccounts.mockReturnValue([auth.first, auth.second]);
  auth.acquireTokenSilent.mockImplementation(async ({ account, scopes }) => ({
    accessToken: `${account.homeAccountId}:${scopes.includes("Mail.Send") ? "send" : "read"}`,
    scopes,
    account,
  }));
  auth.acquireTokenPopup.mockImplementation(async ({ account }) => ({
    accessToken: `${account.homeAccountId}:send`,
    scopes: ["Mail.Send"],
    account,
  }));
  auth.loginPopup.mockResolvedValue({
    accessToken: "work.tenant:read",
    account: auth.second,
    scopes: ["Mail.Read", "User.Read"],
  });
  vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID", "microsoft-client");
  vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID", "google-client");
  vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function graphFetch() {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    const token = new Headers(options?.headers).get("Authorization") || "";
    const account = token.includes(auth.first.homeAccountId) ? auth.first : auth.second;
    if (options?.method === "POST") return new Response(null, { status: 202 });
    if (url.includes("/me?$select="))
      return Response.json({
        id: "same-local-profile-id",
        mail: account.username,
        displayName: account.name,
      });
    if (url.includes("/messages?"))
      return Response.json({ value: [{ id: "same-message-id", subject: account.name }] });
    if (url.includes("/mailFolders?")) return Response.json({ value: [] });
    const folder = /\/mailFolders\/([^?]+)\?/.exec(url)?.[1];
    if (folder) return Response.json({ id: folder, displayName: folder });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("account-bound Outlook connectors", () => {
  it("restores both cached accounts and binds requests to each account instead of shared MSAL active state", async () => {
    const fetchMock = graphFetch();
    const cached = await getCachedMicrosoftMailConnectors();
    expect(cached.map((item) => item.account.id)).toEqual([
      auth.first.homeAccountId,
      auth.second.homeAccountId,
    ]);
    const connections = await Promise.all(cached.map((item) => item.restore()));
    expect(connections.map((item) => item?.account.id)).toEqual([
      auth.first.homeAccountId,
      auth.second.homeAccountId,
    ]);
    expect(connections.map((item) => item?.account.address)).toEqual([
      auth.first.username,
      auth.second.username,
    ]);
    expect((await cached[0].listMessages("inbox")).messages[0].subject).toBe("Personal");
    expect((await cached[1].listMessages("inbox")).messages[0].subject).toBe("Work");
    await cached[0].enableSending!();
    auth.getActiveAccount.mockReturnValue(auth.second);
    await cached[0].sendMessage!(outgoing);
    const send = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(new Headers(send[1]?.headers).get("Authorization")).toBe("Bearer personal.tenant:send");
    expect(auth.acquireTokenSilent).toHaveBeenLastCalledWith({
      account: auth.first,
      scopes: ["Mail.Send"],
    });
    expect(auth.setActiveAccount).not.toHaveBeenCalled();
  });

  it("disconnects the requested account's cache without clearing another active account", async () => {
    graphFetch();
    const personal = createMicrosoftMailConnector({ accountId: auth.first.homeAccountId });
    const work = createMicrosoftMailConnector({ accountId: auth.second.homeAccountId });
    await Promise.all([personal.restore(), work.restore()]);
    await work.enableSending!();
    await personal.disconnect();
    expect(auth.clearCache).toHaveBeenCalledWith({ account: auth.first });
    expect(auth.setActiveAccount).not.toHaveBeenCalled();
    expect(await personal.restore()).toBeNull();
    expect((await work.listMessages("inbox")).messages[0].subject).toBe("Work");
    await work.sendMessage!(outgoing);
    expect(auth.acquireTokenSilent).toHaveBeenLastCalledWith({
      account: auth.second,
      scopes: ["Mail.Send"],
    });
  });

  it("adds an Outlook account through an explicit chooser and keeps its identity after another account becomes active", async () => {
    graphFetch();
    const work = createMicrosoftMailConnector({ selectAccount: true });
    await work.connect();
    expect(auth.loginPopup).toHaveBeenCalledWith({
      scopes: ["Mail.Read", "User.Read"],
      prompt: "select_account",
    });
    expect(auth.loginRedirect).not.toHaveBeenCalled();
    auth.getActiveAccount.mockReturnValue(auth.first);
    expect((await work.restore())?.account.address).toBe(auth.second.username);
    expect(auth.setActiveAccount).not.toHaveBeenCalled();
  });

  it("rejects consent for a different account while keeping the mailbox's read scope usable", async () => {
    graphFetch();
    const personal = createMicrosoftMailConnector({ accountId: auth.first.homeAccountId });
    await personal.restore();
    auth.acquireTokenPopup.mockResolvedValueOnce({
      accessToken: "work.tenant:send",
      scopes: ["Mail.Send"],
      account: auth.second,
    });
    await expect(personal.enableSending!()).rejects.toThrow("account you already connected");
    await expect(personal.sendMessage!(outgoing)).rejects.toThrow("Enable Outlook sending");
    expect((await personal.listMessages("inbox")).messages[0].subject).toBe("Personal");
  });

  it("does not silently substitute a different cached account when a bound account is missing", async () => {
    auth.getAllAccounts.mockReturnValue([auth.second]);
    const missing = createMicrosoftMailConnector({ accountId: auth.first.homeAccountId });
    expect(await missing.restore()).toBeNull();
    await expect(missing.listMessages("inbox")).rejects.toThrow("Outlook is not connected");
    expect(auth.acquireTokenSilent).not.toHaveBeenCalled();
  });
});

describe("account-bound Gmail connectors", () => {
  function gmailIdentity() {
    let readNumber = 0;
    const revoke = vi.fn((_token: string, callback: () => void) => callback());
    const init = vi.fn(
      (config: { scope: string; login_hint?: string; callback: (response: object) => void }) => ({
        requestAccessToken: vi.fn((options?: { prompt?: string }) => {
          const token =
            config.scope === READ
              ? `read-${++readNumber}`
              : config.login_hint === "personal@gmail.com"
                ? "send-1"
                : "send-2";
          config.callback({
            access_token: token,
            expires_in: 3600,
            scope: config.scope === READ ? READ : `${READ} ${SEND}`,
          });
          return options;
        }),
      })
    );
    vi.stubGlobal("window", {
      google: { accounts: { oauth2: { initTokenClient: init, revoke } } },
    });
    return { init, revoke };
  }

  function gmailFetch() {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      const token = new Headers(options?.headers).get("Authorization") || "";
      const personal = token.endsWith("-1");
      if (url.endsWith("/profile"))
        return Response.json({ emailAddress: personal ? "personal@gmail.com" : "work@gmail.com" });
      if (url.endsWith("/labels")) return Response.json({ labels: [] });
      if (url.includes("/messages/") && options?.method !== "POST")
        return Response.json({
          id: "message",
          payload: { headers: [{ name: "Subject", value: personal ? "Personal" : "Work" }] },
        });
      if (url.endsWith("/messages/send")) return Response.json({ id: "sent" });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("keeps separate tokens and send consent for two Gmail accounts and revokes only the disconnected one", async () => {
    const identity = gmailIdentity();
    const fetchMock = gmailFetch();
    const personal = createGoogleMailConnector({ selectAccount: true });
    const work = createGoogleMailConnector({ selectAccount: true });
    await personal.connect();
    await work.connect();
    expect(identity.init.mock.results[0].value.requestAccessToken).toHaveBeenCalledWith({
      prompt: "select_account",
    });
    expect((await personal.restore())?.account.address).toBe("personal@gmail.com");
    expect((await work.restore())?.account.address).toBe("work@gmail.com");
    await personal.enableSending!();
    await expect(work.sendMessage!(outgoing)).rejects.toThrow("Enable Gmail sending");
    await personal.sendMessage!(outgoing);
    const send = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(new Headers(send[1]?.headers).get("Authorization")).toBe("Bearer send-1");
    expect(identity.init.mock.calls[2][0]).toMatchObject({
      scope: SEND,
      login_hint: "personal@gmail.com",
    });
    await personal.disconnect();
    expect(identity.revoke).toHaveBeenCalledWith("send-1", expect.any(Function));
    expect(identity.revoke).toHaveBeenCalledOnce();
    expect((await work.getMessage("message")).subject).toBe("Work");
    expect(await personal.restore()).toBeNull();
  });

  it("rejects reconnecting a remembered Gmail identity with another selected account", async () => {
    gmailIdentity();
    gmailFetch();
    const work = createGoogleMailConnector({ accountAddress: "work@gmail.com" });
    await work.connect();
    await expect(work.restore()).rejects.toThrow("Gmail account you selected");
  });
});
