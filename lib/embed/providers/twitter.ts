import type { TweetEmbedMeta } from '../types';

/**
 * Twitter / X embed resolver.
 *
 * Twitter's official oEmbed/v2 endpoints require auth and have aggressive
 * rate limits, so we use the community-maintained `api.fxtwitter.com`
 * service which mirrors the public-facing tweet data as JSON without
 * authentication. If fxtwitter is unreachable the caller falls back to a
 * bookmark-shaped meta automatically.
 */
export async function resolveTweet(
  url: string,
  hostname: string,
  author: string,
  id: string,
): Promise<TweetEmbedMeta> {
  const res = await fetch(`https://api.fxtwitter.com/${author}/status/${id}`, {
    headers: { 'User-Agent': 'verto-embed' },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`fxtwitter → ${res.status}`);
  const data = (await res.json()) as {
    tweet?: {
      text?: string;
      created_at?: string;
      author?: {
        screen_name?: string;
        name?: string;
        avatar_url?: string;
      };
    };
  };
  const t = data.tweet;
  if (!t) throw new Error('fxtwitter: missing tweet payload');

  return {
    kind: 'tweet',
    url,
    hostname,
    id,
    author: t.author?.screen_name ?? author,
    authorName: t.author?.name,
    authorAvatar: t.author?.avatar_url,
    text: t.text ?? '',
    createdAt: t.created_at,
  };
}
