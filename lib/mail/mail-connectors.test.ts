import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleMailConnector, gmailMessageDetail, gmailMessageSummary } from "./google";
import { mailHtmlToText } from "./html";
import { graphMessageDetail, graphMessageSummary } from "./microsoft";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gmail normalization", () => {
  it("reads a UTF-8 plain-text part and preserves unread and attachment state", () => {
    const body = "你好，Verto";
    const encoded = btoa(
      Array.from(new TextEncoder().encode(body), (byte) => String.fromCharCode(byte)).join("")
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const message = {
      id: "g1",
      labelIds: ["INBOX", "UNREAD"],
      internalDate: "1700000000000",
      snippet: "Preview",
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "Alice <alice@example.com>" },
          { name: "To", value: "bob@example.com" },
          { name: "Subject", value: "Hello" },
        ],
        parts: [
          { mimeType: "text/plain", body: { data: encoded } },
          { mimeType: "application/pdf", body: { attachmentId: "attachment-1" } },
        ],
      },
    };

    expect(gmailMessageDetail(message)).toMatchObject({
      subject: "Hello",
      from: "Alice <alice@example.com>",
      to: ["bob@example.com"],
      bodyText: body,
      isRead: false,
      hasAttachments: true,
    });
  });

  it("falls back to the snippet when a message has only HTML", () => {
    expect(
      gmailMessageDetail({ id: "g2", snippet: "Safe preview", payload: { mimeType: "text/html" } })
        .bodyText
    ).toBe("Safe preview");
  });

  it("converts HTML-only email to text without browser DOM or remote content", () => {
    const html =
      '<p>Hello &amp; welcome</p><img src="https://tracker.example/pixel"><script>alert(1)</script><p>Second line</p>';
    const encoded = btoa(html).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(mailHtmlToText(html)).toBe("Hello & welcome\n\nSecond line");
    expect(
      gmailMessageDetail({
        id: "html-only",
        snippet: "Short preview",
        payload: { mimeType: "text/html", body: { data: encoded } },
      }).bodyText
    ).toBe("Hello & welcome\n\nSecond line");
  });

  it("decodes the declared charset for a plain-text part", () => {
    expect(
      gmailMessageDetail({
        id: "latin1",
        payload: {
          mimeType: "text/plain",
          headers: [{ name: "Content-Type", value: "text/plain; charset=iso-8859-1" }],
          body: { data: btoa("café") },
        },
      }).bodyText
    ).toBe("café");
  });
});

describe("Gmail connector", () => {
  it("requests only the read scope, loads folders and paged messages, and revokes on disconnect", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID", "google-client");
    const requestAccessToken = vi.fn();
    const revoke = vi.fn((_token: string, callback: () => void) => callback());
    vi.stubGlobal("window", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn(
              (config: { scope: string; callback: (response: object) => void }) => {
                expect(config.scope).toBe("https://www.googleapis.com/auth/gmail.readonly");
                requestAccessToken.mockImplementation(() =>
                  config.callback({
                    access_token: "read-token",
                    expires_in: 3600,
                    scope: "https://www.googleapis.com/auth/gmail.readonly",
                  })
                );
                return { requestAccessToken };
              }
            ),
            revoke,
          },
        },
      },
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer read-token");
      if (url.endsWith("/profile")) return Response.json({ emailAddress: "alice@gmail.com" });
      if (url.endsWith("/labels")) {
        return Response.json({
          labels: [{ id: "INBOX", name: "INBOX", type: "system", messagesUnread: 2 }],
        });
      }
      if (url.includes("/messages?")) {
        expect(url).toContain("labelIds=INBOX");
        return Response.json({ messages: [{ id: "g1" }], nextPageToken: "next-page" });
      }
      if (url.includes("/messages/g1?format=metadata")) {
        return Response.json({
          id: "g1",
          labelIds: ["UNREAD"],
          payload: { headers: [{ name: "Subject", value: "A note" }] },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = createGoogleMailConnector();
    expect(connector.isConfigured()).toBe(true);
    await connector.connect();
    expect(requestAccessToken).toHaveBeenCalledOnce();
    const connection = await connector.restore();
    expect(connection?.account.address).toBe("alice@gmail.com");
    expect(connection?.folders[0]).toMatchObject({ id: "INBOX", unreadCount: 2 });
    const page = await connector.listMessages("INBOX");
    expect(page).toMatchObject({
      messages: [{ id: "g1", subject: "A note", isRead: false }],
      nextPageUrl: "next-page",
    });
    await connector.disconnect();
    expect(revoke).toHaveBeenCalledWith("read-token", expect.any(Function));
    expect(await connector.restore()).toBeNull();
    expect(gmailMessageSummary({ id: "g3" }).isRead).toBe(true);
  });
});

describe("Outlook normalization", () => {
  it("maps Microsoft Graph message fields to the shared mail view", () => {
    const graph = {
      id: "m1",
      subject: "Project update",
      from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
      toRecipients: [{ emailAddress: { address: "bob@example.com" } }],
      receivedDateTime: "2026-09-26T09:00:00Z",
      bodyPreview: "Progress",
      body: { contentType: "text", content: "Full update" },
      isRead: false,
      hasAttachments: true,
    };
    expect(graphMessageSummary(graph)).toMatchObject({
      from: "Alice",
      preview: "Progress",
      isRead: false,
      hasAttachments: true,
    });
    expect(graphMessageDetail(graph)).toMatchObject({
      to: ["bob@example.com"],
      bodyText: "Full update",
    });
    expect(
      graphMessageDetail({
        id: "html-only",
        body: { contentType: "html", content: "<p>Full &amp; safe</p><script>track()</script>" },
      }).bodyText
    ).toBe("Full & safe");
  });
});
