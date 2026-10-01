import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  const account = { homeAccountId: "account-1", username: "alice@outlook.com" };
  return {
    initialize: vi.fn(async () => undefined),
    handleRedirectPromise: vi.fn(async () => null),
    getActiveAccount: vi.fn(() => account),
    getAllAccounts: vi.fn(() => [account]),
    setActiveAccount: vi.fn(),
    acquireTokenSilent: vi.fn(async () => ({
      accessToken: "graph-token",
      scopes: ["Mail.Read", "User.Read"],
    })),
  };
});

vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: vi.fn(function () {
    return auth;
  }),
}));

import { createMicrosoftMailConnector } from "./microsoft";

const BASE = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages/delta";
const KEY_BASE = "https://graph.microsoft.com/v1.0/me/mailfolders('inbox-id')/messages/delta";

function connector() {
  vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID", "client");
  vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
  return createMicrosoftMailConnector();
}

function message(id: string, isRead = false) {
  return {
    id,
    parentFolderId: "inbox-id",
    subject: `Subject ${id}`,
    from: { emailAddress: { address: "sender@example.com" } },
    toRecipients: [{ emailAddress: { address: "alice@outlook.com" } }],
    receivedDateTime: "2026-01-01T00:00:00Z",
    bodyPreview: "Preview",
    body: { contentType: "text", content: "Full body" },
    isRead,
    hasAttachments: true,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Outlook folder synchronization", () => {
  it("removes old-folder membership when a message moves between delta enumeration and its full reread", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/messages/delta?")
        ? Response.json({ value: [{ id: "moved" }], "@odata.deltaLink": `${BASE}?$deltatoken=new` })
        : Response.json({ ...message("moved"), parentFolderId: "archive-id" })
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await connector().syncFolder!("inbox-id", { cursor: `${BASE}?$deltatoken=old` })
    ).toEqual({ messages: [], removedIds: ["moved"], cursor: `${BASE}?$deltatoken=new` });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not advance the delta cursor when the full reread omits authoritative folder membership", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/messages/delta?")
        ? Response.json({ value: [{ id: "a" }], "@odata.deltaLink": `${BASE}?$deltatoken=new` })
        : Response.json({ id: "a", body: { content: "Full body" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      connector().syncFolder!("inbox-id", { cursor: `${BASE}?$deltatoken=old` })
    ).rejects.toThrow("unreadable sync response");
  });

  it("completes a full delta round, then fetches partial read updates and removes deleted or missing messages", async () => {
    let incremental = false;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      expect(url.origin).toBe("https://graph.microsoft.com");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer graph-token");
      expect(init?.redirect).toBe("error");
      if (url.pathname.endsWith("/messages/delta")) {
        expect(new Headers(init?.headers).get("Prefer")).toContain(
          'outlook.body-content-type="text"'
        );
        if (url.searchParams.has("$select")) {
          expect(url.searchParams.get("$select")).toContain("isRead");
          expect(url.searchParams.get("$select")).toContain("body");
          return Response.json({
            value: [{ id: "a" }, { id: "a" }],
            "@odata.nextLink": `${KEY_BASE}?$skiptoken=full-2`,
          });
        }
        if (url.searchParams.get("$skiptoken") === "full-2")
          return Response.json({
            value: [{ id: "b" }],
            "@odata.deltaLink": `${KEY_BASE}?$deltatoken=state-1`,
          });
        if (url.searchParams.get("$deltatoken") === "state-1") {
          incremental = true;
          return Response.json({
            value: [
              { id: "a", isRead: true },
              { id: "b", "@removed": { reason: "deleted" } },
              { id: "missing" },
            ],
            "@odata.nextLink": `${BASE}?$skiptoken=changes-2`,
          });
        }
        return Response.json({ value: [], "@odata.deltaLink": `${BASE}?$deltatoken=state-2` });
      }
      if (url.pathname.endsWith("/attachments"))
        return Response.json({
          value: [
            {
              id: "file",
              name: "report.pdf",
              contentType: "application/pdf",
              size: 42,
              "@odata.type": "#microsoft.graph.fileAttachment",
            },
            {
              id: "inline",
              name: "pixel.png",
              isInline: true,
              "@odata.type": "#microsoft.graph.fileAttachment",
            },
          ],
        });
      const id = decodeURIComponent(url.pathname.split("/").pop()!);
      if (id === "missing") return new Response(null, { status: 404 });
      return Response.json(message(id, incremental));
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = connector();
    const first = await source.syncFolder!("inbox-id");
    expect(first).toMatchObject({
      reset: true,
      messages: [{ id: "a", isRead: false, bodyText: "Full body" }],
    });
    expect(first.messages[0].attachments).toEqual([
      { id: "file", name: "report.pdf", mimeType: "application/pdf", size: 42 },
    ]);
    expect(first.cursor).toBeUndefined();
    expect(first.nextPageUrl).toBe(`${KEY_BASE}?$skiptoken=full-2`);
    const complete = await source.syncFolder!("inbox-id", { pageUrl: first.nextPageUrl });
    expect(complete).toMatchObject({
      messages: [{ id: "b" }],
      cursor: `${KEY_BASE}?$deltatoken=state-1`,
    });
    expect(complete.reset).toBeUndefined();
    expect(complete.nextPageUrl).toBeUndefined();
    const changes = await source.syncFolder!("inbox-id", { cursor: complete.cursor });
    expect(changes.messages).toMatchObject([{ id: "a", isRead: true, bodyText: "Full body" }]);
    expect(new Set(changes.removedIds)).toEqual(new Set(["b", "missing"]));
    expect(changes.cursor).toBeUndefined();
    expect(changes.reset).toBeUndefined();
    const next = await source.syncFolder!("inbox-id", {
      cursor: complete.cursor,
      pageUrl: changes.nextPageUrl,
    });
    expect(next).toMatchObject({ messages: [], cursor: `${BASE}?$deltatoken=state-2` });
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/me/messages/a?"))).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/me/messages/b?"))).toHaveLength(1);
  });

  it.each([410, 400])(
    "starts one replacement round for an expired delta cursor (%i)",
    async (status) => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes("$deltatoken=old"))
          return Response.json(
            { error: { code: "syncStateNotFound", message: "secret provider detail" } },
            { status }
          );
        if (url.includes("$skiptoken=new-page"))
          return Response.json({ value: [], "@odata.deltaLink": `${BASE}?$deltatoken=new` });
        return Response.json({ value: [], "@odata.nextLink": `${BASE}?$skiptoken=new-page` });
      });
      vi.stubGlobal("fetch", fetchMock);
      const source = connector();
      const reset = await source.syncFolder!("inbox-id", { cursor: `${BASE}?$deltatoken=old` });
      expect(reset).toEqual({
        messages: [],
        removedIds: [],
        reset: true,
        nextPageUrl: `${BASE}?$skiptoken=new-page`,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toContain("?$select=");
      const final = await source.syncFolder!("inbox-id", { pageUrl: reset.nextPageUrl });
      expect(final.cursor).toBe(`${BASE}?$deltatoken=new`);
      expect(final.reset).toBeUndefined();
    }
  );

  it("restarts an expired interrupted page and propagates failure of the replacement request", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 410 }));
    vi.stubGlobal("fetch", fetchMock);
    const source = connector();
    await expect(
      source.syncFolder!("inbox-id", { pageUrl: `${BASE}?$skiptoken=old-page` })
    ).rejects.toMatchObject({ status: 410 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 404, 429, 500])(
    "propagates delta error %i without restarting or advancing the cursor",
    async (status) => {
      const fetchMock = vi.fn(async () => new Response(null, { status }));
      vi.stubGlobal("fetch", fetchMock);
      const source = connector();
      await expect(
        source.syncFolder!("inbox-id", { cursor: `${BASE}?$deltatoken=old` })
      ).rejects.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("does not misidentify detail errors as expired delta cursors or return a new cursor after a detail failure", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/messages/delta?")
        ? Response.json({ value: [{ id: "a" }], "@odata.deltaLink": `${BASE}?$deltatoken=new` })
        : new Response(null, { status: 410 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const source = connector();
    await expect(
      source.syncFolder!("inbox-id", { cursor: `${BASE}?$deltatoken=old` })
    ).rejects.toMatchObject({ status: 410 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects foreign, cross-folder and endpoint-changing state links before acquiring a token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const source = connector();
    const links = [
      "https://evil.example/steal",
      "http://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages/delta",
      "https://graph.microsoft.com.evil.example/v1.0/me/mailFolders/inbox-id/messages/delta",
      "https://graph.microsoft.com/v1.0/me/mailFolders/other/messages/delta?$deltatoken=x",
      "https://graph.microsoft.com/v1.0/me/mailfolders('other')/messages/delta?$skiptoken=x",
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages",
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages/delta/steal",
      `${BASE}#fragment`,
      "https://user:password@graph.microsoft.com/v1.0/me/mailFolders/inbox-id/messages/delta",
      "invalid",
    ];
    for (const link of links) {
      await expect(source.syncFolder!("inbox-id", { pageUrl: link })).rejects.toThrow(
        "continuation was invalid"
      );
      await expect(source.syncFolder!("inbox-id", { cursor: link })).rejects.toThrow(
        "continuation was invalid"
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.acquireTokenSilent).not.toHaveBeenCalled();
  });

  it.each(["nextLink", "deltaLink"])(
    "rejects a malicious provider %s before fetching message details",
    async (kind) => {
      const fetchMock = vi.fn(async () =>
        Response.json({ value: [{ id: "a" }], [`@odata.${kind}`]: "https://evil.example/steal" })
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(connector().syncFolder!("inbox-id")).rejects.toThrow("continuation was invalid");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("rejects a response with no checkpoint and bounds concurrent detail requests", async () => {
    const fetchMock = vi.fn(async () => Response.json({ value: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const source = connector();
    await expect(source.syncFolder!("inbox-id")).rejects.toThrow("unreadable sync response");
    let active = 0;
    let peak = 0;
    fetchMock.mockImplementation(async (url?: string) => {
      if (url?.includes("/messages/delta?"))
        return Response.json({
          value: Array.from({ length: 23 }, (_, id) => ({ id: String(id) })),
          "@odata.deltaLink": `${BASE}?$deltatoken=new`,
        });
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return Response.json({
        ...message(new URL(url!).pathname.split("/").pop()!),
        hasAttachments: false,
      });
    });
    expect((await source.syncFolder!("inbox-id")).messages).toHaveLength(23);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });
});
