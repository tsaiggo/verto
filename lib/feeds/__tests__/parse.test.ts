import { describe, it, expect } from "vitest";

import { parseFeed, FeedParseError, MAX_SUMMARY_LENGTH } from "@/lib/feeds/parse";

const RSS_2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[My Blog]]></title>
    <link>https://blog.example.com</link>
    <atom:link href="https://blog.example.com/feed.xml" rel="self" />
    <item>
      <title>First &amp; Best</title>
      <link>https://blog.example.com/posts/1</link>
      <guid isPermaLink="false">tag:blog,2026:1</guid>
      <dc:creator>Jane Doe</dc:creator>
      <author>jane@example.com</author>
      <pubDate>Mon, 06 Jan 2026 10:00:00 GMT</pubDate>
      <description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description>
      <content:encoded><![CDATA[<p>The full body</p>]]></content:encoded>
    </item>
    <item>
      <title>Second</title>
      <link>https://blog.example.com/posts/2</link>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <link rel="self" href="https://a.example.com/atom.xml" />
  <link rel="alternate" href="https://a.example.com/" />
  <entry>
    <title>Atom Entry</title>
    <link rel="alternate" href="https://a.example.com/e1" />
    <id>urn:uuid:e1</id>
    <author><name>Bob</name></author>
    <updated>2026-01-02T03:04:05Z</updated>
    <content type="html">A &amp; rich body</content>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://r.example.com">
    <title>RDF Feed</title>
    <link>https://r.example.com</link>
  </channel>
  <item rdf:about="https://r.example.com/a">
    <title>RDF Item</title>
    <link>https://r.example.com/a</link>
    <dc:creator>Rdf Author</dc:creator>
    <dc:date>2026-01-03T00:00:00Z</dc:date>
    <description>Plain summary</description>
  </item>
</rdf:RDF>`;

describe("parseFeed — RSS 2.0", () => {
  const feed = parseFeed(RSS_2);

  it("reads the channel title (CDATA) and site link", () => {
    expect(feed.title).toBe("My Blog");
    expect(feed.siteUrl).toBe("https://blog.example.com");
  });

  it("extracts both items", () => {
    expect(feed.entries).toHaveLength(2);
  });

  it("uses guid as id and prefers dc:creator over author", () => {
    expect(feed.entries[0].id).toBe("tag:blog,2026:1");
    expect(feed.entries[0].author).toBe("Jane Doe");
  });

  it("normalizes the RFC-822 pubDate to ISO-8601", () => {
    expect(feed.entries[0].publishedAt).toBe("2026-01-06T10:00:00.000Z");
  });

  it("reduces the HTML description to plain text", () => {
    expect(feed.entries[0].summary).toBe("Hello world");
  });

  it("falls back to the link as id when there is no guid", () => {
    expect(feed.entries[1].id).toBe("https://blog.example.com/posts/2");
    expect(feed.entries[1].author).toBeUndefined();
    expect(feed.entries[1].publishedAt).toBeUndefined();
  });
});

describe("parseFeed — Atom", () => {
  const feed = parseFeed(ATOM);

  it("reads the title and the alternate (not self) site link", () => {
    expect(feed.title).toBe("Atom Example");
    expect(feed.siteUrl).toBe("https://a.example.com/");
  });

  it("reads the entry link href, id, author name and date", () => {
    expect(feed.entries[0].link).toBe("https://a.example.com/e1");
    expect(feed.entries[0].id).toBe("urn:uuid:e1");
    expect(feed.entries[0].author).toBe("Bob");
    expect(feed.entries[0].publishedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("falls back to content for the summary", () => {
    expect(feed.entries[0].summary).toBe("A & rich body");
  });
});

describe("parseFeed — RSS 1.0 (RDF)", () => {
  const feed = parseFeed(RDF);

  it("reads channel metadata and the sibling item", () => {
    expect(feed.title).toBe("RDF Feed");
    expect(feed.siteUrl).toBe("https://r.example.com");
    expect(feed.entries).toHaveLength(1);
  });

  it("uses rdf:about as id and dc:date/dc:creator", () => {
    expect(feed.entries[0].id).toBe("https://r.example.com/a");
    expect(feed.entries[0].author).toBe("Rdf Author");
    expect(feed.entries[0].publishedAt).toBe("2026-01-03T00:00:00.000Z");
  });
});

describe("parseFeed — single item and edge cases", () => {
  it("handles a feed with exactly one item (object, not array)", () => {
    const single = `<rss version="2.0"><channel><title>Solo</title>
      <item><title>Only</title><link>https://e.com/only</link></item>
    </channel></rss>`;
    const feed = parseFeed(single);
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0].title).toBe("Only");
  });

  it("drops items that have neither a title nor a link", () => {
    const withEmpty = `<rss version="2.0"><channel><title>T</title>
      <item><description>orphan</description></item>
      <item><title>Good</title><link>https://e.com/g</link></item>
    </channel></rss>`;
    const feed = parseFeed(withEmpty);
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0].title).toBe("Good");
  });

  it("drops an unparseable date", () => {
    const badDate = `<rss version="2.0"><channel><title>T</title>
      <item><title>A</title><link>https://e.com/a</link><pubDate>nope</pubDate></item>
    </channel></rss>`;
    const feed = parseFeed(badDate);
    expect(feed.entries[0].publishedAt).toBeUndefined();
  });

  it("truncates an over-long summary with an ellipsis", () => {
    const long = "word ".repeat(200).trim();
    const xml = `<rss version="2.0"><channel><title>T</title>
      <item><title>A</title><link>https://e.com/a</link><description>${long}</description></item>
    </channel></rss>`;
    const feed = parseFeed(xml);
    const summary = feed.entries[0].summary ?? "";
    expect(summary.length).toBeLessThanOrEqual(MAX_SUMMARY_LENGTH + 1);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("throws FeedParseError on empty input", () => {
    expect(() => parseFeed("")).toThrow(FeedParseError);
    expect(() => parseFeed("   ")).toThrow(FeedParseError);
  });

  it("throws FeedParseError on a non-feed document", () => {
    expect(() => parseFeed("<html><body>nope</body></html>")).toThrow(
      FeedParseError,
    );
  });
});
