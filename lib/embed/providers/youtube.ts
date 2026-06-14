import type { YouTubeEmbedMeta } from "../types";

/**
 * YouTube embed resolver.
 *
 * Uses YouTube's public oEmbed endpoint, which requires no API key and is
 * not rate-limited per request. We extract `title`, `author_name`, and the
 * `thumbnail_url` and pair them with the canonical video ID we already
 * parsed from the URL.
 */
export async function resolveYouTube(
  url: string,
  hostname: string,
  videoId: string
): Promise<YouTubeEmbedMeta> {
  // Canonicalize to `youtube.com/watch?v=…` because oEmbed rejects some
  // shortener forms (notably `youtu.be/…?si=…` share links).
  const canonical = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`;

  const res = await fetch(endpoint, {
    headers: { "User-Agent": "verto-embed" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`YouTube oEmbed → ${res.status}`);
  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  // Prefer YouTube's predictable high-res thumbnail CDN URL over the
  // smaller 480-wide thumbnail oEmbed returns; both serve the same image
  // for every public video. If oEmbed succeeded the video exists, so the
  // constructed URL is guaranteed to resolve.
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    kind: "youtube",
    url,
    hostname,
    videoId,
    title: data.title,
    author: data.author_name,
    thumbnail,
  };
}
