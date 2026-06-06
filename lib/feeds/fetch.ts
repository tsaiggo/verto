// Fetch a feed body over an injected `fetch` and parse it.
//
// Like the GitHub helpers in `lib/auth/`, this takes a `FetchLike` so the same
// code can run against the Tauri HTTP plugin in the desktop app (which bypasses
// the webview's CORS restrictions) and against a mock in tests. The browser
// build can only reach feeds that send permissive CORS headers; the desktop app
// can reach any host its capability allowlist permits.

import type { FetchLike } from "@/lib/tauri";
import { parseFeed, type ParsedFeed } from "./parse";

/** Thrown when the network call fails or returns a non-OK status. */
export class FeedFetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FeedFetchError";
    if (status !== undefined) this.status = status;
  }
}

const FEED_ACCEPT =
  "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch `url` with the given `fetch` implementation and parse the body into a
 * `ParsedFeed`. Rejects non-http(s) URLs up front, throws `FeedFetchError` on a
 * transport error or non-OK status, and lets `FeedParseError` surface for an
 * unparseable body.
 */
export async function fetchFeed(
  url: string,
  fetchImpl: FetchLike,
): Promise<ParsedFeed> {
  if (!isHttpUrl(url)) {
    throw new FeedFetchError(`Refusing to fetch non-http(s) feed URL: ${url}`);
  }

  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Accept: FEED_ACCEPT } });
  } catch {
    throw new FeedFetchError(`Could not reach feed at ${url}`);
  }

  if (!response.ok) {
    throw new FeedFetchError(
      `Feed request failed: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  return parseFeed(await response.text());
}
