import { describe, it, expect, vi } from "vitest";

import { fetchFeed, FeedFetchError } from "@/lib/feeds/fetch";
import { FeedParseError } from "@/lib/feeds/parse";
import type { FetchLike } from "@/lib/tauri";

const VALID_RSS = `<rss version="2.0"><channel><title>Feed</title>
  <link>https://e.com</link>
  <item><title>One</title><link>https://e.com/1</link></item>
</channel></rss>`;

/** A `FetchLike` that records its calls and returns a fresh `Response` each time. */
function mockFetch(respond: (url: string, init?: RequestInit) => Response): {
  fetchImpl: FetchLike;
  calls: Array<{ url: string; init?: RequestInit }>;
} {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: FetchLike = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  });
  return { fetchImpl, calls };
}

describe("fetchFeed", () => {
  it("fetches the body and returns the parsed feed", async () => {
    const { fetchImpl } = mockFetch(() => new Response(VALID_RSS, { status: 200 }));

    const feed = await fetchFeed("https://e.com/feed.xml", fetchImpl);

    expect(feed.title).toBe("Feed");
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0].link).toBe("https://e.com/1");
  });

  it("sends a feed-oriented Accept header", async () => {
    const { fetchImpl, calls } = mockFetch(() => new Response(VALID_RSS, { status: 200 }));

    await fetchFeed("https://e.com/feed.xml", fetchImpl);

    const accept = (calls[0].init?.headers as Record<string, string>).Accept;
    expect(accept).toMatch(/application\/rss\+xml/);
    expect(accept).toMatch(/application\/atom\+xml/);
  });

  it("throws FeedFetchError carrying the status on a non-OK response", async () => {
    const { fetchImpl } = mockFetch(
      () => new Response("nope", { status: 404, statusText: "Not Found" })
    );

    const err = await fetchFeed("https://e.com/feed.xml", fetchImpl).catch((e) => e);

    expect(err).toBeInstanceOf(FeedFetchError);
    expect(err.status).toBe(404);
    expect(err.message).toMatch(/404/);
  });

  it("wraps a transport error as FeedFetchError without a status", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new TypeError("network down");
    });

    const err = await fetchFeed("https://e.com/feed.xml", fetchImpl).catch((e) => e);

    expect(err).toBeInstanceOf(FeedFetchError);
    expect(err.status).toBeUndefined();
    expect(err.message).toMatch(/Could not reach feed/);
  });

  it("rejects a non-http(s) URL up front without calling fetch", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => new Response(VALID_RSS));

    await expect(fetchFeed("ftp://e.com/feed.xml", fetchImpl)).rejects.toBeInstanceOf(
      FeedFetchError
    );
    await expect(fetchFeed("not a url", fetchImpl)).rejects.toBeInstanceOf(FeedFetchError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lets a FeedParseError surface for an OK-but-unparseable body", async () => {
    const { fetchImpl } = mockFetch(
      () => new Response("<html><body>nope</body></html>", { status: 200 })
    );

    const err = await fetchFeed("https://e.com/feed.xml", fetchImpl).catch((e) => e);

    expect(err).toBeInstanceOf(FeedParseError);
    expect(err).not.toBeInstanceOf(FeedFetchError);
  });
});
