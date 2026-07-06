import { memoizeResolve, readCached, writeCached } from "./cache";
import { resolveGithubGist, resolveGithubIssue, resolveGithubRepo } from "./providers/github";
import { resolveOpenGraph } from "./providers/opengraph";
import { resolveTweet } from "./providers/twitter";
import { resolveYouTube } from "./providers/youtube";
import type { BookmarkEmbedMeta, EmbedMeta } from "./types";

/**
 * `resolveEmbed(url)` — entry point used by the `<Embed>` server component.
 *
 * Routes a URL to the most specific provider available and falls back to
 * an OpenGraph (bookmark) lookup if no provider matches. **Never throws.**
 * Network or parse failures degrade to a minimal bookmark card so a
 * single bad URL can never crash a page render.
 */
export async function resolveEmbed(url: string): Promise<EmbedMeta> {
  // Try the disk cache first — cheaper than even setting up a Promise.
  const cached = readCached(url);
  if (cached) return cached;

  return memoizeResolve(url, async () => {
    const fallback = bookmarkFallback(url);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return fallback;
    }
    const hostname = parsed.hostname.replace(/^www\./, "");

    try {
      const meta = await dispatch(parsed, url, hostname);
      writeCached(url, meta);
      return meta;
    } catch {
      // Fall back to OG metadata when the provider-specific call fails;
      // if even OG fails, degrade to the raw bookmark.
      try {
        const og = await resolveOpenGraph(url, hostname);
        writeCached(url, og);
        return og;
      } catch {
        return fallback;
      }
    }
  });
}

async function dispatch(u: URL, url: string, hostname: string): Promise<EmbedMeta> {
  const host = u.hostname.replace(/^www\./, "");
  const segments = u.pathname.split("/").filter(Boolean);

  const github = githubEmbed(host, segments, url, hostname);
  if (github) return github;

  const youtube = youtubeEmbed(host, segments, u, url, hostname);
  if (youtube) return youtube;

  const tweet = tweetEmbed(host, segments, url, hostname);
  if (tweet) return tweet;

  // ── Default: OpenGraph ──────────────────────────────────────────────
  return resolveOpenGraph(url, hostname);
}

// ── GitHub ─────────────────────────────────────────────────────────────
function githubEmbed(
  host: string,
  segments: string[],
  url: string,
  hostname: string
): Promise<EmbedMeta> | null {
  if (host === "github.com") {
    // /<owner>/<repo>/(issues|pull)/<n>
    if (segments.length >= 4) {
      const [owner, repo, kind, numStr] = segments;
      const num = Number(numStr);
      if (Number.isInteger(num) && num > 0) {
        if (kind === "issues") {
          return resolveGithubIssue(url, hostname, owner, repo, num, "issue");
        }
        if (kind === "pull" || kind === "pulls") {
          return resolveGithubIssue(url, hostname, owner, repo, num, "pull");
        }
      }
    }
    // /<owner>/<repo>
    if (segments.length === 2) {
      const [owner, repo] = segments;
      return resolveGithubRepo(url, hostname, owner, repo);
    }
  }
  if (host === "gist.github.com") {
    // /<owner>/<id>
    if (segments.length >= 2) {
      const [owner, id] = segments;
      return resolveGithubGist(url, hostname, owner, id);
    }
  }
  return null;
}

// ── YouTube ──────────────────────────────────────────────────────────────
function youtubeEmbed(
  host: string,
  segments: string[],
  u: URL,
  url: string,
  hostname: string
): Promise<EmbedMeta> | null {
  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return resolveYouTube(url, hostname, v);
  }
  if (host === "youtu.be" && segments.length >= 1) {
    return resolveYouTube(url, hostname, segments[0]);
  }
  return null;
}

// ── Twitter / X ──────────────────────────────────────────────────────────
function tweetEmbed(
  host: string,
  segments: string[],
  url: string,
  hostname: string
): Promise<EmbedMeta> | null {
  if (host === "twitter.com" || host === "x.com") {
    // /<user>/status/<id>
    if (segments.length >= 3 && segments[1] === "status") {
      return resolveTweet(url, hostname, segments[0], segments[2]);
    }
  }
  return null;
}

function bookmarkFallback(url: string): BookmarkEmbedMeta {
  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw url
  }
  return { kind: "bookmark", url, hostname };
}

export type { EmbedMeta };
