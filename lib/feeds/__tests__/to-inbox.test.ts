import { describe, it, expect } from "vitest";

import { parsedFeedToInboxItems } from "@/lib/feeds/to-inbox";
import type { ParsedFeed, ParsedFeedEntry } from "@/lib/feeds/parse";

const FEED_URL = "https://blog.example.com/feed.xml";
const NOW = "2026-06-01T00:00:00.000Z";

function entry(over: Partial<ParsedFeedEntry> = {}): ParsedFeedEntry {
  return { id: "", title: "Title", link: "https://blog.example.com/a", ...over };
}

function feed(
  entries: ParsedFeedEntry[],
  over: Partial<ParsedFeed> = {},
): ParsedFeed {
  return { title: "My Feed", entries, ...over };
}

describe("parsedFeedToInboxItems", () => {
  it("maps an entry into a complete unread InboxItem at options.now", () => {
    const items = parsedFeedToInboxItems(
      feed([
        entry({
          id: "urn:1",
          title: "Hello",
          link: "https://blog.example.com/a",
          author: "Jane",
          publishedAt: "2026-01-01T00:00:00.000Z",
          summary: "Hi there",
        }),
      ]),
      FEED_URL,
      { now: NOW },
    );

    expect(items).toEqual([
      {
        id: "urn:1",
        feedUrl: FEED_URL,
        sourceName: "My Feed",
        title: "Hello",
        url: "https://blog.example.com/a",
        author: "Jane",
        publishedAt: "2026-01-01T00:00:00.000Z",
        summary: "Hi there",
        status: "unread",
        createdAt: NOW,
      },
    ]);
  });

  it("omits optional fields the entry does not carry", () => {
    const [item] = parsedFeedToInboxItems(feed([entry()]), FEED_URL, { now: NOW });

    expect(item.author).toBeUndefined();
    expect(item.publishedAt).toBeUndefined();
    expect(item.summary).toBeUndefined();
  });

  it("uses the feed title as sourceName, falling back to the feed host", () => {
    const titled = parsedFeedToInboxItems(feed([entry()]), FEED_URL, { now: NOW });
    expect(titled[0].sourceName).toBe("My Feed");

    const blank = parsedFeedToInboxItems(
      feed([entry()], { title: "   " }),
      FEED_URL,
      { now: NOW },
    );
    expect(blank[0].sourceName).toBe("blog.example.com");
  });

  it("skips entries with no title or a whitespace-only title", () => {
    const items = parsedFeedToInboxItems(
      feed([
        entry({ title: "   ", link: "https://blog.example.com/a" }),
        entry({ title: "Keep", link: "https://blog.example.com/b" }),
      ]),
      FEED_URL,
      { now: NOW },
    );

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Keep");
  });

  it("resolves a relative entry link against the feed site URL", () => {
    const [item] = parsedFeedToInboxItems(
      feed([entry({ link: "/posts/1" })], { siteUrl: "https://blog.example.com" }),
      FEED_URL,
      { now: NOW },
    );

    expect(item.url).toBe("https://blog.example.com/posts/1");
  });

  it("skips a relative link when the feed has no site URL to resolve against", () => {
    const items = parsedFeedToInboxItems(
      feed([entry({ link: "/posts/1" })]),
      FEED_URL,
      { now: NOW },
    );

    expect(items).toHaveLength(0);
  });

  it("skips non-http(s) links even when a base is present", () => {
    const items = parsedFeedToInboxItems(
      feed([entry({ link: "javascript:alert(1)" })], {
        siteUrl: "https://blog.example.com",
      }),
      FEED_URL,
      { now: NOW },
    );

    expect(items).toHaveLength(0);
  });

  it("collapses duplicate ids, keeping the first occurrence", () => {
    const items = parsedFeedToInboxItems(
      feed([
        entry({ id: "dup", title: "First", link: "https://blog.example.com/1" }),
        entry({ id: "dup", title: "Second", link: "https://blog.example.com/2" }),
      ]),
      FEED_URL,
      { now: NOW },
    );

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("First");
  });

  it("falls back to the resolved url as id when the entry has no id", () => {
    const [item] = parsedFeedToInboxItems(
      feed([entry({ id: "", link: "https://blog.example.com/x" })]),
      FEED_URL,
      { now: NOW },
    );

    expect(item.id).toBe("https://blog.example.com/x");
  });

  it("preserves feed order", () => {
    const items = parsedFeedToInboxItems(
      feed([
        entry({ id: "a", link: "https://blog.example.com/a" }),
        entry({ id: "b", link: "https://blog.example.com/b" }),
        entry({ id: "c", link: "https://blog.example.com/c" }),
      ]),
      FEED_URL,
      { now: NOW },
    );

    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("defaults createdAt to a valid timestamp when now is not given", () => {
    const [item] = parsedFeedToInboxItems(feed([entry()]), FEED_URL);

    expect(typeof item.createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);
  });
});
