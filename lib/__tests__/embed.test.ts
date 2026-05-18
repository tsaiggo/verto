import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Embed reads/writes a JSON cache under node_modules/.cache/verto/embeds.json.
// We isolate the test from real filesystem state and from real network calls
// by clearing the cache and stubbing global fetch in each test.

import { _clearCache } from '@/lib/embed/cache';
import { resolveEmbed } from '@/lib/embed';

function mockFetch(handlers: Array<[RegExp | string, (url: string) => unknown]>) {
  return vi.fn(async (input: string | URL | Request) => {
    const u = typeof input === 'string' ? input : input.toString();
    for (const [match, handler] of handlers) {
      const ok =
        typeof match === 'string' ? u.includes(match) : match.test(u);
      if (ok) {
        const payload = handler(u);
        if (payload && typeof payload === 'object' && 'status' in payload) {
          const p = payload as { status: number; body?: unknown; text?: string };
          return new Response(
            p.text !== undefined ? p.text : JSON.stringify(p.body ?? {}),
            { status: p.status, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response('not found', { status: 404 });
  });
}

beforeEach(() => {
  _clearCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveEmbed', () => {
  it('resolves a GitHub repo URL via the REST API', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        [
          /api\.github\.com\/repos\/tsaiggo\/verto$/,
          () => ({
            name: 'verto',
            full_name: 'tsaiggo/verto',
            description: 'A modern blog engine',
            stargazers_count: 1234,
            forks_count: 56,
            language: 'TypeScript',
          }),
        ],
      ]),
    );

    const meta = await resolveEmbed('https://github.com/tsaiggo/verto');
    expect(meta.kind).toBe('github-repo');
    if (meta.kind !== 'github-repo') return;
    expect(meta.owner).toBe('tsaiggo');
    expect(meta.repo).toBe('verto');
    expect(meta.stars).toBe(1234);
    expect(meta.language).toBe('TypeScript');
    expect(meta.languageColor).toBe('#3178c6');
  });

  it('resolves a GitHub PR URL and reports merged state', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        [
          /\/repos\/o\/r\/issues\/42$/,
          () => ({
            number: 42,
            title: 'Add support for D2',
            state: 'closed',
            user: { login: 'alice' },
            pull_request: { merged_at: '2025-01-01T00:00:00Z' },
          }),
        ],
      ]),
    );

    const meta = await resolveEmbed('https://github.com/o/r/pull/42');
    expect(meta.kind).toBe('github-issue');
    if (meta.kind !== 'github-issue') return;
    expect(meta.state).toBe('merged');
    expect(meta.type).toBe('pull');
    expect(meta.author).toBe('alice');
  });

  it('resolves a YouTube watch URL via oEmbed', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        [
          'youtube.com/oembed',
          () => ({
            title: 'A great talk',
            author_name: 'Channel',
            thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
          }),
        ],
      ]),
    );

    const meta = await resolveEmbed(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(meta.kind).toBe('youtube');
    if (meta.kind !== 'youtube') return;
    expect(meta.videoId).toBe('dQw4w9WgXcQ');
    expect(meta.title).toBe('A great talk');
  });

  it('handles youtu.be shortener URLs', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([['youtube.com/oembed', () => ({ title: 'short' })]]),
    );
    const meta = await resolveEmbed('https://youtu.be/abc123');
    expect(meta.kind).toBe('youtube');
    if (meta.kind !== 'youtube') return;
    expect(meta.videoId).toBe('abc123');
  });

  it('resolves a tweet via fxtwitter', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        [
          'fxtwitter.com/jack/status/20',
          () => ({
            tweet: {
              text: 'just setting up my twttr',
              created_at: '2006-03-21T20:50:14.000Z',
              author: {
                screen_name: 'jack',
                name: 'jack',
                avatar_url: 'https://example.com/jack.png',
              },
            },
          }),
        ],
      ]),
    );

    const meta = await resolveEmbed('https://x.com/jack/status/20');
    expect(meta.kind).toBe('tweet');
    if (meta.kind !== 'tweet') return;
    expect(meta.author).toBe('jack');
    expect(meta.text).toBe('just setting up my twttr');
  });

  it('falls back to OpenGraph for unknown URLs', async () => {
    const html = `<!doctype html><html><head>
      <title>Page title</title>
      <meta property="og:title" content="OG title" />
      <meta property="og:description" content="A description" />
      <meta property="og:image" content="/img.png" />
      <meta property="og:site_name" content="Example" />
    </head><body></body></html>`;
    vi.stubGlobal(
      'fetch',
      mockFetch([
        ['example.com', () => ({ status: 200, text: html })],
      ]),
    );

    const meta = await resolveEmbed('https://example.com/some/article');
    expect(meta.kind).toBe('bookmark');
    if (meta.kind !== 'bookmark') return;
    expect(meta.title).toBe('OG title');
    expect(meta.description).toBe('A description');
    expect(meta.image).toBe('https://example.com/img.png');
    expect(meta.siteName).toBe('Example');
  });

  it('falls back to a bare bookmark when everything fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    const meta = await resolveEmbed('https://github.com/o/r');
    expect(meta.kind).toBe('bookmark');
    if (meta.kind !== 'bookmark') return;
    expect(meta.url).toBe('https://github.com/o/r');
    expect(meta.hostname).toBe('github.com');
  });

  it('dedups concurrent calls for the same URL', async () => {
    const fetchFn = mockFetch([
      [
        /api\.github\.com\/repos\/x\/y$/,
        () => ({ stargazers_count: 1, forks_count: 0, language: null, description: null }),
      ],
    ]);
    vi.stubGlobal('fetch', fetchFn);

    const [a, b] = await Promise.all([
      resolveEmbed('https://github.com/x/y'),
      resolveEmbed('https://github.com/x/y'),
    ]);
    expect(a.kind).toBe('github-repo');
    expect(b.kind).toBe('github-repo');
    // Single in-flight fetch — second call shares the Promise.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('<Embed> component', () => {
  it('uses author overrides without hitting the network', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);

    const { default: Embed } = await import('@/components/mdx/Embed');
    const element = await Embed({
      url: 'https://example.com',
      title: 'Hand-tuned',
      description: 'No fetch happens',
    });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Hand-tuned');
    expect(html).toContain('No fetch happens');
    expect(html).toContain('class="link-card embed-card embed-bookmark"');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('renders a GitHub repo card from resolved metadata', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        [
          /repos\/tsaiggo\/verto$/,
          () => ({
            stargazers_count: 5,
            forks_count: 2,
            language: 'TypeScript',
            description: 'desc',
          }),
        ],
      ]),
    );

    const { default: Embed } = await import('@/components/mdx/Embed');
    const element = await Embed({ url: 'https://github.com/tsaiggo/verto' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('embed-github-repo');
    expect(html).toContain('tsaiggo');
    expect(html).toContain('verto');
    expect(html).toContain('TypeScript');
    // Compact star count for small numbers stays plain
    expect(html).toContain('★ 5');
  });
});
