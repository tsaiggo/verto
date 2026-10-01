import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleMailConnector, gmailMessageDetail } from "./google";
import type { MailOutgoing } from "./model";

const READ = "https://www.googleapis.com/auth/gmail.readonly";
const SEND = "https://www.googleapis.com/auth/gmail.send";
const outgoing: MailOutgoing = {
  to: ["Bob <bob@example.com>"],
  cc: ["copy@example.com"],
  bcc: ["hidden@example.com"],
  subject: "你好 — Project",
  bodyText: "Hello <script>literal</script>\n第二行",
};

function googleIdentity(sendScopes = `${READ} ${SEND}`) {
  const init = vi.fn(
    (config: {
      scope: string;
      include_granted_scopes?: boolean;
      callback: (response: object) => void;
    }) => ({
      requestAccessToken: vi.fn(() =>
        config.callback({
          access_token: config.scope === READ ? "read-token" : "send-token",
          scope: config.scope === READ ? READ : sendScopes,
          expires_in: 3600,
        })
      ),
    })
  );
  vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID", "client");
  vi.stubGlobal("window", {
    google: {
      accounts: {
        oauth2: { initTokenClient: init, revoke: vi.fn((_token, callback) => callback()) },
      },
    },
  });
  return init;
}

function responseFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/profile")) return Response.json({ emailAddress: "alice@gmail.com" });
    if (url.includes("/messages/original?"))
      return Response.json({
        id: "original",
        threadId: "thread-1",
        payload: {
          headers: [
            { name: "Message-ID", value: "<original@example.com>" },
            { name: "References", value: "<earlier@example.com>\r\nX-Injected: bad" },
          ],
        },
      });
    if (url.endsWith("/messages/send")) {
      expect(init?.method).toBe("POST");
      return Response.json({ id: "sent-id" });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Gmail send actions", () => {
  it("requests incremental send permission only on explicit enable, then sends UTF-8 MIME with native reply metadata", async () => {
    const init = googleIdentity();
    const fetchMock = responseFetch();
    const connector = createGoogleMailConnector();
    await connector.connect();
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0].scope).toBe(READ);
    await expect(connector.sendMessage!({ ...outgoing })).rejects.toThrow("Enable Gmail sending");
    expect(fetchMock).not.toHaveBeenCalled();
    await connector.enableSending!();
    expect(init.mock.calls[1][0]).toMatchObject({ scope: SEND, include_granted_scopes: true });
    await connector.sendMessage!({
      ...outgoing,
      replyToMessageId: "original",
      internetMessageId: "<original@example.com>",
    });
    const [url, options] = fetchMock.mock.calls.find(([url]) => url.endsWith("/messages/send"))!;
    expect(url).not.toContain("send-token");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer send-token");
    const payload = JSON.parse(options?.body as string);
    expect(payload.threadId).toBe("thread-1");
    const raw = atob(payload.raw.replace(/-/g, "+").replace(/_/g, "/"));
    expect(raw).toContain("From: alice@gmail.com\r\nTo: bob@example.com");
    expect(raw).toContain("Cc: copy@example.com\r\nBcc: hidden@example.com");
    expect(raw).toContain("In-Reply-To: <original@example.com>");
    expect(raw).toContain("References: <earlier@example.com>\r\n <original@example.com>");
    expect(raw).not.toContain("X-Injected");
    const encodedSubject = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(raw)![1];
    expect(
      new TextDecoder().decode(Uint8Array.from(atob(encodedSubject), (char) => char.charCodeAt(0)))
    ).toBe(outgoing.subject);
    const encodedBody = raw.split("\r\n\r\n")[1].replace(/\s/g, "");
    expect(
      new TextDecoder().decode(Uint8Array.from(atob(encodedBody), (char) => char.charCodeAt(0)))
    ).toBe(outgoing.bodyText.replace(/\n/g, "\r\n"));
    await connector.disconnect();
    const sentRequests = fetchMock.mock.calls.filter(([url]) =>
      url.endsWith("/messages/send")
    ).length;
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("session expired");
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/messages/send"))).toHaveLength(
      sentRequests
    );
  });

  it("rejects partially denied grants without enabling sending or exposing OAuth errors", async () => {
    googleIdentity(READ);
    const fetchMock = responseFetch();
    const connector = createGoogleMailConnector();
    await connector.connect();
    await expect(connector.enableSending!()).rejects.toThrow("send permission was not granted");
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("Enable Gmail sending");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates recipients and headers before any request", async () => {
    googleIdentity();
    const fetchMock = responseFetch();
    const connector = createGoogleMailConnector();
    await connector.connect();
    for (const message of [
      { ...outgoing, to: ["bob@example.com\r\nBcc: attacker@example.com"] },
      { ...outgoing, subject: "Hello\nBcc: attacker@example.com" },
      { ...outgoing, internetMessageId: "<parent@example.com>\r\nX-Bad: yes" },
      { ...outgoing, to: [], cc: [], bcc: [] },
    ])
      await expect(connector.sendMessage!(message)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires send consent for the connected account", async () => {
    googleIdentity();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) =>
        Response.json({
          emailAddress:
            new Headers(init.headers).get("Authorization") === "Bearer read-token"
              ? "alice@gmail.com"
              : "other@gmail.com",
        })
      )
    );
    const connector = createGoogleMailConnector();
    await connector.connect();
    await expect(connector.enableSending!()).rejects.toThrow("account you already connected");
    await expect(connector.sendMessage!(outgoing)).rejects.toThrow("Enable Gmail sending");
  });
});

describe("Gmail attachment actions", () => {
  const message = {
    id: "message/id",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "Cc", value: '"Last, First" <copy@example.com>' },
        { name: "Reply-To", value: "reply@example.com" },
        { name: "Message-ID", value: "<parent@example.com>" },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: btoa("Body") } },
        {
          filename: "report.pdf",
          mimeType: "application/pdf",
          body: { attachmentId: "file/id", size: 3 },
        },
        {
          partId: "small",
          filename: "notes.txt",
          mimeType: "text/plain",
          body: { data: btoa("Notes"), size: 5 },
        },
        {
          filename: "pixel.png",
          mimeType: "image/png",
          headers: [{ name: "Content-Disposition", value: "inline; filename=pixel.png" }],
          body: { attachmentId: "pixel" },
        },
      ],
    },
  };

  it("lists nested downloadable files, excludes inline parts, and downloads bytes with read permission", async () => {
    const init = googleIdentity();
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer read-token");
      if (url.includes("/attachments/file%2Fid"))
        return Response.json({ data: btoa(String.fromCharCode(0, 255, 42)) });
      return Response.json(message);
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = createGoogleMailConnector();
    await connector.connect();
    const detail = await connector.getMessage("message/id");
    expect(detail).toMatchObject({
      cc: ["copy@example.com"],
      replyTo: ["reply@example.com"],
      internetMessageId: "<parent@example.com>",
      bodyText: "Body",
    });
    expect(detail.attachments).toEqual([
      { id: "file/id", name: "report.pdf", mimeType: "application/pdf", size: 3 },
      { id: "part:small", name: "notes.txt", mimeType: "text/plain", size: 5 },
    ]);
    const pdf = await connector.getAttachment!("message/id", detail.attachments![0]);
    expect(pdf.type).toBe("application/pdf");
    expect([...new Uint8Array(await pdf.arrayBuffer())]).toEqual([0, 255, 42]);
    const notes = await connector.getAttachment!("message/id", detail.attachments![1]);
    expect(await notes.text()).toBe("Notes");
    await expect(
      connector.getAttachment!("message/id", {
        id: "pixel",
        name: "pixel.png",
        mimeType: "image/png",
        size: 0,
      })
    ).rejects.toThrow("no longer available");
    expect(init).toHaveBeenCalledTimes(1);
    expect(
      gmailMessageDetail({ id: "inline-only", payload: { parts: [message.payload.parts[3]] } })
        .hasAttachments
    ).toBe(false);
  });
});
