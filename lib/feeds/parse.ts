// Parse RSS 2.0, Atom and RSS 1.0 (RDF) feeds into one normalized shape.
//
// Verto's Inbox (PRD R3) ingests arbitrary subscription feeds, which in the
// wild come in three incompatible dialects: RSS 2.0 (`<rss><channel><item>`),
// Atom (`<feed><entry>`) and the older RSS 1.0 / RDF (`<rdf:RDF>` with `channel`
// and `item` as *siblings*). Rather than special-case each caller, this module
// collapses all three into a single `ParsedFeed` of `ParsedFeedEntry`s.
//
// Parsing runs in a Node build and in the browser/Tauri webview, so it can't
// lean on the DOM's `DOMParser`. We use `fast-xml-parser`, a dependency-free
// pure-JS parser, configured to keep tag values as strings (so ids and dates
// aren't coerced to numbers) and to expose attributes under an `@_` prefix.
//
// `summary` is deliberately reduced to a short plain-text excerpt: feed
// descriptions carry untrusted HTML, and the Inbox list only needs a preview.
// Rendering full feed HTML safely is a separate concern handled downstream.

import { XMLParser } from "fast-xml-parser";

/** A single normalized feed entry, dialect-agnostic. */
export interface ParsedFeedEntry {
  /** Stable identity: the entry's guid / atom:id / rdf:about, else its link. */
  id: string;
  title: string;
  /** Canonical link to the article as advertised by the feed (may be relative). */
  link: string;
  author?: string;
  /** ISO-8601 publish timestamp, normalized from RFC-822 or ISO input. */
  publishedAt?: string;
  /** Short plain-text excerpt (HTML stripped, collapsed, truncated). */
  summary?: string;
}

/** A feed reduced to the fields the Inbox needs. */
export interface ParsedFeed {
  title: string;
  /** The feed's human site URL (channel/alternate link), not the feed URL. */
  siteUrl?: string;
  entries: ParsedFeedEntry[];
}

/** Thrown when a body is empty, not well-formed XML, or an unknown dialect. */
export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedParseError";
  }
}

/** Longest plain-text excerpt kept for an entry summary. */
export const MAX_SUMMARY_LENGTH = 280;

// One reusable, stateless parser instance for the whole module.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Keep "123" / dates as strings instead of coercing to numbers.
  parseTagValue: false,
  processEntities: true,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function first<T>(value: T | T[] | undefined | null): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

/**
 * Read an element's text whether `fast-xml-parser` returned a bare string or a
 * `{ "#text": ..., "@_attr": ... }` object (which happens when the element also
 * carries attributes, e.g. `<guid isPermaLink="false">…</guid>`).
 */
function text(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (isRecord(node) && "#text" in node) return text(node["#text"]);
  return "";
}

/** Read a named attribute (already `@_`-prefixed at the call site). */
function attr(node: unknown, name: string): string {
  if (!isRecord(node)) return "";
  const value = node[name];
  return typeof value === "string" ? value.trim() : "";
}

/** Normalize an RFC-822 or ISO-8601 date string to ISO-8601, or drop it. */
function toIso(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString();
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Reduce a (possibly HTML) description to a collapsed plain-text string. */
function htmlToText(raw: string): string {
  if (!raw) return "";
  const withoutTags = raw.replace(/<[^>]+>/g, " ");
  return decodeBasicEntities(withoutTags).replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number = MAX_SUMMARY_LENGTH): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

function toSummary(raw: string): string | undefined {
  const plain = truncate(htmlToText(raw));
  return plain === "" ? undefined : plain;
}

function makeEntry(fields: {
  id: string;
  title: string;
  link: string;
  author: string;
  date: string;
  summarySource: string;
}): ParsedFeedEntry {
  const link = fields.link.trim();
  const id = fields.id.trim() || link;
  const entry: ParsedFeedEntry = {
    id,
    title: fields.title.trim(),
    link,
  };
  if (fields.author.trim()) entry.author = fields.author.trim();
  const iso = toIso(fields.date);
  if (iso) entry.publishedAt = iso;
  const summary = toSummary(fields.summarySource);
  if (summary) entry.summary = summary;
  return entry;
}

/** Keep entries that carry at least a title or a link; drop empty husks. */
function keepEntry(entry: ParsedFeedEntry): boolean {
  return entry.title !== "" || entry.link !== "";
}

function parseRssChannel(channel: Record<string, unknown>): ParsedFeed {
  const feed: ParsedFeed = {
    title: text(channel.title),
    entries: toArray(channel.item)
      .filter(isRecord)
      .map((item) =>
        makeEntry({
          id: text(item.guid),
          title: text(item.title),
          link: text(first(item.link)),
          // `<dc:creator>` carries a name; `<author>` is usually an email.
          author: text(item["dc:creator"]) || text(item.author),
          date: text(item.pubDate) || text(item["dc:date"]),
          // Prefer the short `<description>`; fall back to full content.
          summarySource: text(item.description) || text(item["content:encoded"]),
        })
      )
      .filter(keepEntry),
  };
  const siteUrl = text(first(channel.link));
  if (siteUrl) feed.siteUrl = siteUrl;
  return feed;
}

/**
 * Pick an Atom entry/feed link. Prefers `rel="alternate"` (or no rel), never
 * returns the `rel="self"` feed URL, and tolerates a bare string `<link>`.
 */
function atomLink(link: unknown): string {
  let fallback = "";
  for (const candidate of toArray(link)) {
    if (typeof candidate === "string") {
      if (!fallback) fallback = candidate.trim();
      continue;
    }
    const href = attr(candidate, "@_href");
    if (!href) continue;
    const rel = attr(candidate, "@_rel");
    if (rel === "alternate" || rel === "") return href;
    if (rel !== "self" && !fallback) fallback = href;
  }
  return fallback;
}

/** Read an Atom `<author><name>…</name></author>`, tolerating a bare string. */
function atomAuthor(author: unknown): string {
  const node = first(author);
  if (typeof node === "string") return node.trim();
  if (isRecord(node)) return text(node.name);
  return "";
}

function parseAtomFeed(feed: Record<string, unknown>): ParsedFeed {
  const parsed: ParsedFeed = {
    title: text(feed.title),
    entries: toArray(feed.entry)
      .filter(isRecord)
      .map((entry) =>
        makeEntry({
          id: text(entry.id),
          title: text(entry.title),
          link: atomLink(entry.link),
          author: atomAuthor(entry.author),
          date: text(entry.published) || text(entry.updated),
          // `<summary>` if present, else the (often HTML) `<content>`.
          summarySource: text(entry.summary) || text(entry.content),
        })
      )
      .filter(keepEntry),
  };
  const siteUrl = atomLink(feed.link);
  if (siteUrl) parsed.siteUrl = siteUrl;
  return parsed;
}

function parseRdf(rdf: Record<string, unknown>): ParsedFeed {
  const channel = isRecord(rdf.channel) ? rdf.channel : {};
  const feed: ParsedFeed = {
    title: text(channel.title),
    // In RSS 1.0 `<item>` elements are siblings of `<channel>`, not children.
    entries: toArray(rdf.item)
      .filter(isRecord)
      .map((item) =>
        makeEntry({
          id: attr(item, "@_rdf:about"),
          title: text(item.title),
          link: text(first(item.link)),
          author: text(item["dc:creator"]),
          date: text(item["dc:date"]),
          summarySource: text(item.description),
        })
      )
      .filter(keepEntry),
  };
  const siteUrl = text(first(channel.link));
  if (siteUrl) feed.siteUrl = siteUrl;
  return feed;
}

/**
 * Parse a raw feed body (RSS 2.0, Atom or RSS 1.0/RDF) into a `ParsedFeed`.
 * Throws `FeedParseError` for empty input, malformed XML, or an unrecognized
 * root element.
 */
export function parseFeed(xml: string): ParsedFeed {
  if (typeof xml !== "string" || xml.trim() === "") {
    throw new FeedParseError("Feed body is empty.");
  }

  let root: unknown;
  try {
    root = parser.parse(xml);
  } catch {
    throw new FeedParseError("Feed body is not well-formed XML.");
  }

  if (!isRecord(root)) {
    throw new FeedParseError("Unrecognized feed format.");
  }

  if (isRecord(root.rss) && isRecord(root.rss.channel)) {
    return parseRssChannel(root.rss.channel);
  }
  if (isRecord(root.feed)) {
    return parseAtomFeed(root.feed);
  }
  const rdf = isRecord(root["rdf:RDF"])
    ? root["rdf:RDF"]
    : isRecord(root.RDF)
      ? root.RDF
      : undefined;
  if (rdf) {
    return parseRdf(rdf);
  }

  throw new FeedParseError("Unrecognized feed format (expected RSS, Atom or RDF).");
}
