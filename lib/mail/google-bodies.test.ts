import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleMailConnector, type GmailMessage } from "./google";

vi.mock("./google-auth", () => ({
  authorizeGoogleMail: vi.fn(async () => ({
    token: "mail-token",
    expiresAt: Date.now() + 3600000,
  })),
  loadGoogleIdentity: vi.fn(),
}));

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

function encoded(text: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join("")
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function message(payload: GmailMessage["payload"], id = "message/id"): GmailMessage {
  return { id, labelIds: ["INBOX"], snippet: "Truncated preview", payload };
}

async function connector() {
  const value = createGoogleMailConnector();
  await value.connect();
  return value;
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID", "development-client"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Gmail complete message bodies", () => {
  it.each(["inline", "detached"])(
    "prefers the %s plain body without requesting or decoding the alternate HTML or file attachments",
    async (kind) => {
      const full = message({
        mimeType: "multipart/mixed",
        parts: [
          {
            mimeType: "text/plain",
            headers: [{ name: "Content-Disposition", value: "attachment" }],
            body: { attachmentId: "text-file", size: 12 },
          },
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/html", body: { attachmentId: "unused-html" } },
              {
                mimeType: "text/plain",
                body:
                  kind === "inline" ? { data: encoded("完整正文") } : { attachmentId: "body/id" },
              },
              { mimeType: "text/html", body: { data: "invalid base64!" } },
            ],
          },
          { mimeType: "application/pdf", filename: "report.pdf", body: { attachmentId: "pdf" } },
        ],
      });
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer mail-token");
        if (url === `${API}/messages/message%2Fid?format=full`) return Response.json(full);
        if (url === `${API}/messages/message%2Fid/attachments/body%2Fid`)
          return Response.json({ data: encoded("完整正文") });
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);
      const source = await connector();
      const detail = await source.getMessage("message/id");
      expect(detail.bodyText).toBe("完整正文");
      expect(detail.attachments).toEqual([
        { id: "text-file", name: "Attachment", mimeType: "text/plain", size: 12 },
        { id: "pdf", name: "report.pdf", mimeType: "application/pdf", size: 0 },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(kind === "inline" ? 1 : 2);
    }
  );

  it("hydrates an HTML-only body while excluding attached text and HTML files from body selection", async () => {
    const full = message({
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", filename: "notes.txt", body: { attachmentId: "notes" } },
        {
          mimeType: "text/html",
          headers: [{ name: "Content-Disposition", value: "attachment; filename=archive.html" }],
          body: { attachmentId: "html-file" },
        },
        {
          mimeType: "multipart/related",
          parts: [{ mimeType: "text/html", body: { attachmentId: "html-body" } }],
        },
      ],
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("?format=full")) return Response.json(full);
      if (url.endsWith("/attachments/html-body"))
        return Response.json({
          data: encoded(
            '<p>Full &amp; safe</p><script>run()</script><img src="https://tracker.example/pixel"><p>第二段</p>'
          ),
        });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    const detail = await source.getMessage("message/id");
    expect(detail.bodyText).toBe("Full & safe\n\n第二段");
    expect(detail.attachments?.map((file) => file.id)).toEqual(["notes", "html-file"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("decodes a detached body with its declared charset and preserves a valid empty body", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/messages/empty?"))
        return Response.json(message({ mimeType: "text/plain", body: { data: "" } }, "empty"));
      if (url.includes("/messages/empty-html?"))
        return Response.json(message({ mimeType: "text/html", body: { data: "" } }, "empty-html"));
      if (url.endsWith("?format=full"))
        return Response.json(
          message({
            mimeType: "text/plain",
            headers: [{ name: "Content-Type", value: 'text/plain; charset="iso-8859-1"' }],
            body: { attachmentId: "latin1" },
          })
        );
      if (url.endsWith("/attachments/latin1")) return Response.json({ data: btoa("café") });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    expect((await source.getMessage("message/id")).bodyText).toBe("café");
    expect((await source.getMessage("empty")).bodyText).toBe("");
    expect((await source.getMessage("empty-html")).bodyText).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([undefined, {}, { attachmentId: "body" }])(
    "rejects missing full body data instead of returning the preview (%j)",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
          url.endsWith("?format=full")
            ? Response.json(message({ mimeType: "text/plain", body }))
            : Response.json({ size: 42 })
        )
      );
      const source = await connector();
      await expect(source.getMessage("message/id")).rejects.toThrow("complete message body");
    }
  );

  it.each(["snapshot", "history"])(
    "does not complete a %s sync when a detached body is missing, unavailable or malformed",
    async (round) => {
      let failure: "missing" | "404" | "503" | "malformed" = "missing";
      const fetchMock = vi.fn(async (url: string) => {
        if (url.endsWith("/profile")) return Response.json({ historyId: "100" });
        if (url.includes("/messages?")) return Response.json({ messages: [{ id: "message/id" }] });
        if (url.includes("/history?"))
          return Response.json({
            historyId: "200",
            history: [{ messagesAdded: [{ message: { id: "message/id" } }] }],
          });
        if (url.endsWith("?format=full"))
          return Response.json(message({ mimeType: "text/plain", body: { attachmentId: "body" } }));
        if (url.endsWith("/attachments/body")) {
          if (failure === "missing") return Response.json({});
          if (failure === "malformed") return Response.json({ data: "invalid base64!" });
          return new Response(null, { status: Number(failure) });
        }
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);
      const source = await connector();
      for (failure of ["missing", "404", "503", "malformed"] as const) {
        await expect(
          source.syncFolder!("INBOX", round === "history" ? { cursor: "100" } : {})
        ).rejects.toThrow();
      }
    }
  );

  it("hydrates bodies during bounded initial and incremental synchronization", async () => {
    const ids = Array.from({ length: 8 }, (_, index) => `mail-${index}`);
    const pending: Array<() => void> = [];
    let active = 0;
    let maximum = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/profile")) return Response.json({ historyId: "100" });
      if (url.includes("/messages?")) return Response.json({ messages: ids.map((id) => ({ id })) });
      if (url.includes("/history?"))
        return Response.json({
          historyId: "200",
          history: [{ messages: ids.map((id) => ({ id })) }],
        });
      if (url.endsWith("?format=full")) {
        const id = new URL(url).pathname.split("/").pop()!;
        return Response.json(
          message({ mimeType: "text/plain", body: { attachmentId: "body" } }, id)
        );
      }
      if (url.endsWith("/attachments/body")) {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => pending.push(resolve));
        active -= 1;
        return Response.json({ data: encoded("Complete synchronized body") });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    for (const cursor of [undefined, "100"]) {
      const operation = source.syncFolder!("INBOX", { cursor });
      await vi.waitFor(() => expect(pending).toHaveLength(4));
      pending.splice(0).forEach((resolve) => resolve());
      await vi.waitFor(() => expect(pending).toHaveLength(4));
      pending.splice(0).forEach((resolve) => resolve());
      const result = await operation;
      expect(result.cursor).toBe(cursor ? "200" : "100");
      expect(result.messages).toHaveLength(8);
      expect(result.messages.every((mail) => mail.bodyText === "Complete synchronized body")).toBe(
        true
      );
    }
    expect(maximum).toBe(4);
  });

  it("keeps the complete body after a message mutation and rejects an incomplete reread", async () => {
    let bodyAvailable = true;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/profile")) return Response.json({ emailAddress: "alice@gmail.com" });
      if (init?.method === "POST") return Response.json({ id: "message/id" });
      if (url.endsWith("?format=full"))
        return Response.json(message({ mimeType: "text/plain", body: { attachmentId: "body" } }));
      if (url.endsWith("/attachments/body"))
        return Response.json(bodyAvailable ? { data: encoded("Body after update") } : {});
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    await source.enableUpdating!();
    expect(
      (await source.mutateMessage!("message/id", { type: "read", value: true })).message.bodyText
    ).toBe("Body after update");
    bodyAvailable = false;
    await expect(
      source.mutateMessage!("message/id", { type: "star", value: true })
    ).rejects.toThrow("complete message body");
  });
});
