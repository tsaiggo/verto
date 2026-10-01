import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleMailConnector, type GmailMessage } from "./google";

vi.mock("./google-auth", () => ({
  authorizeGoogleMail: vi.fn(async () => ({
    token: "read-token",
    expiresAt: Date.now() + 3600000,
  })),
  loadGoogleIdentity: vi.fn(),
}));

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

function message(id: string, labels = ["INBOX", "UNREAD"], body = "Full plain body"): GmailMessage {
  return {
    id,
    labelIds: labels,
    internalDate: "1700000000000",
    snippet: "A preview",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "Subject", value: `Subject ${id}` },
        { name: "From", value: "Sender <sender@example.com>" },
        { name: "To", value: "alice@gmail.com" },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: btoa(body) } },
        {
          filename: "file.pdf",
          mimeType: "application/pdf",
          body: { attachmentId: "attachment", size: 123 },
        },
      ],
    },
  };
}

async function connector() {
  const value = createGoogleMailConnector();
  await value.connect();
  return value;
}

afterEach(() => vi.unstubAllGlobals());

describe("Gmail folder synchronization", () => {
  it("snapshots virtual Archive using a search query and tracks archive entry and departure from account-wide history", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      if (url.endsWith("/profile")) return Response.json({ historyId: "100" });
      if (parsed.pathname.endsWith("/messages")) {
        expect(parsed.searchParams.get("q")).toBe("-in:inbox -in:trash -in:spam -in:drafts");
        expect(parsed.searchParams.has("labelIds")).toBe(false);
        return Response.json({ messages: [{ id: "archived" }] });
      }
      if (parsed.pathname.endsWith("/history")) {
        expect(parsed.searchParams.has("labelId")).toBe(false);
        return Response.json({
          historyId: "200",
          history: [
            {
              labelsRemoved: [{ message: { id: "newly-archived" }, labelIds: ["INBOX"] }],
              labelsAdded: ["inbox", "trash", "spam", "draft"].map((id) => ({ message: { id } })),
            },
          ],
        });
      }
      const id = parsed.pathname.split("/").pop()!;
      const labels: Record<string, string[]> = {
        inbox: ["INBOX"],
        trash: ["TRASH"],
        spam: ["SPAM"],
        draft: ["DRAFT"],
      };
      return Response.json(message(id, labels[id] ?? ["UNREAD", "STARRED", "Label_custom"]));
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    expect(await source.syncFolder!("ARCHIVE")).toMatchObject({
      reset: true,
      cursor: "100",
      messages: [{ id: "archived", isStarred: true }],
    });
    const changes = await source.syncFolder!("ARCHIVE", { cursor: "100" });
    expect(changes).toMatchObject({
      cursor: "200",
      messages: [{ id: "newly-archived", isRead: false, isStarred: true }],
    });
    expect(new Set(changes.removedIds)).toEqual(new Set(["inbox", "trash", "spam", "draft"]));
  });

  it("captures a baseline before a complete paginated snapshot, then applies read changes, moves and deletions", async () => {
    let incremental = false;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      expect(url.origin).toBe("https://gmail.googleapis.com");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer read-token");
      expect(init?.redirect).toBe("error");
      if (url.pathname.endsWith("/profile")) return Response.json({ historyId: "100" });
      if (url.pathname.endsWith("/messages")) {
        expect(url.searchParams.get("labelIds")).toBe("INBOX");
        expect(url.searchParams.get("includeSpamTrash")).toBe("true");
        if (url.searchParams.has("pageToken")) {
          expect(url.searchParams.get("pageToken")).toBe("list/page 2");
          return Response.json({ messages: [{ id: "b" }] });
        }
        return Response.json({
          messages: [{ id: "a" }, { id: "a" }],
          nextPageToken: "list/page 2",
        });
      }
      if (url.pathname.endsWith("/history")) {
        incremental = true;
        expect(url.searchParams.get("startHistoryId")).toBe("100");
        expect(url.searchParams.has("labelId")).toBe(false);
        expect(url.searchParams.has("labelIds")).toBe(false);
        if (url.searchParams.has("pageToken")) {
          expect(url.searchParams.get("pageToken")).toBe("history/page 2");
          return Response.json({
            history: [{ messagesAdded: [{ message: { id: "late" } }] }],
            historyId: "130",
          });
        }
        return Response.json({
          historyId: "120",
          nextPageToken: "history/page 2",
          history: [
            {
              messages: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "missing" }],
              labelsAdded: [{ message: { id: "a" } }],
              labelsRemoved: [{ message: { id: "b" } }],
              messagesDeleted: [{ message: { id: "c" } }],
            },
          ],
        });
      }
      const id = decodeURIComponent(url.pathname.split("/").pop()!);
      expect(url.searchParams.get("format")).toBe("full");
      if (id === "missing") return new Response(null, { status: 404 });
      return Response.json(
        message(
          id,
          incremental ? (id === "b" ? ["SENT"] : ["INBOX"]) : undefined,
          incremental ? "Updated full body" : undefined
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();

    const initial = await source.syncFolder!("INBOX");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/profile`);
    expect(initial).toMatchObject({
      reset: true,
      messages: [{ id: "a", isRead: false, bodyText: "Full plain body" }],
    });
    expect(initial.messages[0].attachments).toEqual([
      { id: "attachment", name: "file.pdf", mimeType: "application/pdf", size: 123 },
    ]);
    expect(initial.cursor).toBeUndefined();
    expect(initial.nextPageUrl).not.toContain("read-token");
    const final = await source.syncFolder!("INBOX", { pageUrl: initial.nextPageUrl });
    expect(final).toMatchObject({ messages: [{ id: "b" }], cursor: "100" });
    expect(final.reset).toBeUndefined();
    expect(final.nextPageUrl).toBeUndefined();
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/profile"))).toHaveLength(1);

    const changes = await source.syncFolder!("INBOX", { cursor: final.cursor });
    expect(changes.messages).toMatchObject([
      { id: "a", isRead: true, bodyText: "Updated full body" },
    ]);
    expect(new Set(changes.removedIds)).toEqual(new Set(["b", "c", "missing"]));
    expect(changes.reset).toBeUndefined();
    expect(changes.cursor).toBeUndefined();
    const complete = await source.syncFolder!("INBOX", {
      cursor: final.cursor,
      pageUrl: changes.nextPageUrl,
    });
    expect(complete).toMatchObject({
      messages: [{ id: "late", bodyText: "Updated full body" }],
      cursor: "130",
    });
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/messages/a?"))).toHaveLength(2);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/messages/c?"))).toBe(false);
  });

  it("replaces an expired history cursor with a new snapshot, and propagates a snapshot failure", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/history?")) return new Response(null, { status: 404 });
      if (url.endsWith("/profile")) return Response.json({ historyId: "200" });
      if (url.includes("/messages?")) return Response.json({ messages: [{ id: "fresh" }] });
      return Response.json(message("fresh"));
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    expect(await source.syncFolder!("INBOX", { cursor: "1" })).toMatchObject({
      reset: true,
      cursor: "200",
      messages: [{ id: "fresh" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/profile")
        ? Response.json({ historyId: "300" })
        : new Response(null, { status: 404 })
    );
    await expect(source.syncFolder!("INBOX", { cursor: "1" })).rejects.toThrow(
      "Mail request failed (404)"
    );
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/profile"))).toHaveLength(2);
  });

  it.each([401, 403, 429, 500])(
    "propagates history failure %i without restarting or returning a new cursor",
    async (status) => {
      const fetchMock = vi.fn(async () => new Response(null, { status }));
      vi.stubGlobal("fetch", fetchMock);
      const source = await connector();
      await expect(source.syncFolder!("INBOX", { cursor: "100" })).rejects.toMatchObject({
        status,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("does not return a final cursor when a changed message could not be fetched", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/history?")
        ? Response.json({ history: [{ messages: [{ id: "a" }] }], historyId: "200" })
        : new Response(null, { status: 503 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    await expect(source.syncFolder!("INBOX", { cursor: "100" })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects arbitrary URLs, malformed cursors and continuations for another folder before fetching", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/profile")
        ? Response.json({ historyId: "100" })
        : Response.json({ messages: [], nextPageToken: "page2" })
    );
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    const first = await source.syncFolder!("INBOX");
    fetchMock.mockClear();
    for (const pageUrl of ["https://evil.example/steal", "gmail-sync:%", first.nextPageUrl]) {
      await expect(source.syncFolder!("SENT", { pageUrl })).rejects.toThrow(
        "continuation was invalid"
      );
    }
    await expect(
      source.syncFolder!("INBOX", { cursor: "https://evil.example/steal" })
    ).rejects.toThrow("cursor was invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds full detail fetch concurrency even for a large page", async () => {
    let active = 0;
    let peak = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/profile")) return Response.json({ historyId: "100" });
      if (url.includes("/messages?"))
        return Response.json({
          messages: Array.from({ length: 23 }, (_, id) => ({ id: String(id) })),
        });
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return Response.json(message(decodeURIComponent(new URL(url).pathname.split("/").pop()!)));
    });
    vi.stubGlobal("fetch", fetchMock);
    const source = await connector();
    expect((await source.syncFolder!("INBOX")).messages).toHaveLength(23);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });
});
