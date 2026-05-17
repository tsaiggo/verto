import { resolveEmbed } from '@/lib/embed';
import type {
  BookmarkEmbedMeta,
  EmbedMeta,
  GithubGistEmbedMeta,
  GithubIssueEmbedMeta,
  GithubRepoEmbedMeta,
  TweetEmbedMeta,
  YouTubeEmbedMeta,
} from '@/lib/embed/types';

interface EmbedProps {
  url: string;
  /** Force a particular renderer regardless of URL detection. */
  as?: 'auto' | 'bookmark';
  /** Manual override — when provided, skips network resolution entirely. */
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/**
 * <Embed url="…"> — single entry point for inline rich-link cards.
 *
 * Async server component: resolves provider metadata at render time (build
 * time for static pages) and emits a small, iframe-free `.link-card`
 * variant tailored to the source. Falls back gracefully to a minimal
 * bookmark card if any step fails — a broken URL or rate-limited API can
 * never crash a page render.
 *
 * @example  <Embed url="https://github.com/tsaiggo/verto" />
 * @example  <Embed url="https://x.com/jack/status/20" />
 * @example  <Embed url="https://example.com" title="Hand-tuned title" />
 */
export default async function Embed({
  url,
  as = 'auto',
  title,
  description,
  image,
  siteName,
}: EmbedProps) {
  // Author-supplied metadata wins; skip the network entirely.
  const hasOverride =
    title !== undefined ||
    description !== undefined ||
    image !== undefined ||
    siteName !== undefined;

  let meta: EmbedMeta;
  if (as === 'bookmark' || hasOverride) {
    meta = {
      kind: 'bookmark',
      url,
      hostname: hostnameOf(url),
      title,
      description,
      image,
      siteName,
    };
    if (!hasOverride && as === 'bookmark') {
      // Try to enrich an as="bookmark" embed with OG data; fall back to
      // the minimal card if resolution fails.
      try {
        meta = await resolveEmbed(url);
        if (meta.kind !== 'bookmark') {
          meta = {
            kind: 'bookmark',
            url,
            hostname: meta.hostname,
            title: extractTitle(meta),
          };
        }
      } catch {
        // already set to the minimal bookmark above
      }
    }
  } else {
    meta = await resolveEmbed(url);
  }

  switch (meta.kind) {
    case 'github-repo':
      return <GithubRepoCard meta={meta} />;
    case 'github-issue':
      return <GithubIssueCard meta={meta} />;
    case 'github-gist':
      return <GithubGistCard meta={meta} />;
    case 'youtube':
      return <YouTubeCard meta={meta} />;
    case 'tweet':
      return <TweetCard meta={meta} />;
    case 'bookmark':
    default:
      return <BookmarkCard meta={meta} />;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function extractTitle(meta: EmbedMeta): string | undefined {
  switch (meta.kind) {
    case 'github-repo':
      return `${meta.owner}/${meta.repo}`;
    case 'github-issue':
      return `${meta.owner}/${meta.repo}#${meta.number} — ${meta.title}`;
    case 'github-gist':
      return `${meta.owner}/${meta.id}`;
    case 'youtube':
      return meta.title;
    case 'tweet':
      return `@${meta.author}`;
    default:
      return undefined;
  }
}

function compactNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  return String(n);
}

// ── Individual provider cards ─────────────────────────────────────────

function CardLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

function BookmarkCard({ meta }: { meta: BookmarkEmbedMeta }) {
  return (
    <CardLink href={meta.url} className="link-card embed-card embed-bookmark">
      {meta.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="embed-bookmark-image"
          src={meta.image}
          alt=""
          loading="lazy"
        />
      )}
      <span className="link-card-body">
        <span className="link-card-title">{meta.title ?? meta.url}</span>
        {meta.description && (
          <span className="link-card-desc">{meta.description}</span>
        )}
        <span className="link-card-url">
          {meta.siteName ? `${meta.siteName} · ${meta.hostname}` : meta.hostname}
        </span>
      </span>
    </CardLink>
  );
}

function GithubRepoCard({ meta }: { meta: GithubRepoEmbedMeta }) {
  return (
    <CardLink href={meta.url} className="link-card embed-card embed-github-repo">
      <span className="embed-gh-icon" aria-hidden="true">
        <GithubMark />
      </span>
      <span className="link-card-body">
        <span className="link-card-title">
          {meta.owner}/<strong>{meta.repo}</strong>
        </span>
        {meta.description && (
          <span className="link-card-desc">{meta.description}</span>
        )}
        <span className="embed-gh-meta">
          {meta.language && (
            <span className="embed-gh-lang">
              <span
                className="embed-gh-lang-dot"
                style={{
                  background: meta.languageColor ?? 'var(--text-muted)',
                }}
                aria-hidden="true"
              />
              {meta.language}
            </span>
          )}
          {typeof meta.stars === 'number' && (
            <span className="embed-gh-stat" title={`${meta.stars} stars`}>
              ★ {compactNumber(meta.stars)}
            </span>
          )}
          {typeof meta.forks === 'number' && (
            <span className="embed-gh-stat" title={`${meta.forks} forks`}>
              ⑂ {compactNumber(meta.forks)}
            </span>
          )}
        </span>
      </span>
    </CardLink>
  );
}

function GithubIssueCard({ meta }: { meta: GithubIssueEmbedMeta }) {
  return (
    <CardLink
      href={meta.url}
      className={`link-card embed-card embed-github-issue is-${meta.state}`}
    >
      <span
        className={`embed-gh-state embed-gh-state-${meta.state}`}
        aria-hidden="true"
      >
        {meta.type === 'pull' ? <PullIcon /> : <IssueIcon />}
      </span>
      <span className="link-card-body">
        <span className="link-card-title">{meta.title}</span>
        <span className="embed-gh-meta">
          <span className={`embed-gh-pill embed-gh-pill-${meta.state}`}>
            {meta.state}
          </span>
          <span className="link-card-url">
            {meta.owner}/{meta.repo}#{meta.number}
            {meta.author ? ` · by ${meta.author}` : ''}
          </span>
        </span>
      </span>
    </CardLink>
  );
}

function GithubGistCard({ meta }: { meta: GithubGistEmbedMeta }) {
  return (
    <CardLink href={meta.url} className="link-card embed-card embed-github-gist">
      <span className="embed-gh-icon" aria-hidden="true">
        <GistIcon />
      </span>
      <span className="link-card-body">
        <span className="link-card-title">
          {meta.files && meta.files.length > 0
            ? meta.files[0]
            : `Gist ${meta.id.slice(0, 8)}`}
        </span>
        {meta.description && (
          <span className="link-card-desc">{meta.description}</span>
        )}
        <span className="link-card-url">
          gist.github.com/{meta.owner}
          {meta.files && meta.files.length > 1
            ? ` · +${meta.files.length - 1} more`
            : ''}
        </span>
      </span>
    </CardLink>
  );
}

function YouTubeCard({ meta }: { meta: YouTubeEmbedMeta }) {
  return (
    <CardLink href={meta.url} className="link-card embed-card embed-youtube">
      {meta.thumbnail && (
        <span className="embed-youtube-thumb" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.thumbnail} alt="" loading="lazy" />
          <span className="embed-youtube-play">
            <PlayIcon />
          </span>
        </span>
      )}
      <span className="link-card-body">
        <span className="link-card-title">{meta.title ?? 'YouTube video'}</span>
        {meta.author && (
          <span className="link-card-desc">{meta.author}</span>
        )}
        <span className="link-card-url">youtube.com</span>
      </span>
    </CardLink>
  );
}

function TweetCard({ meta }: { meta: TweetEmbedMeta }) {
  return (
    <CardLink href={meta.url} className="link-card embed-card embed-tweet">
      {meta.authorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="embed-tweet-avatar"
          src={meta.authorAvatar}
          alt=""
          loading="lazy"
        />
      ) : (
        <span className="embed-tweet-avatar embed-tweet-avatar-fallback" aria-hidden="true">
          {meta.author.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="link-card-body">
        <span className="link-card-title">
          {meta.authorName ?? meta.author}{' '}
          <span className="embed-tweet-handle">@{meta.author}</span>
        </span>
        {meta.text && <span className="embed-tweet-text">{meta.text}</span>}
        <span className="link-card-url">{meta.hostname}</span>
      </span>
    </CardLink>
  );
}

// ── Inline SVG icons (kept small, no external icon dep) ───────────────

function GithubMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.56 4.56-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function IssueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function PullIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.25a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0Zm0 9.5a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0ZM3.25 5a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5A.75.75 0 0 0 3.25 5Zm10.5 7.75a1.75 1.75 0 1 0-3.5 0 1.75 1.75 0 0 0 3.5 0Zm-2.5-9V2.5a.75.75 0 0 1 1.28-.53l1.5 1.5a.75.75 0 0 1 0 1.06l-1.5 1.5A.75.75 0 0 1 11.25 5.5V4.25h-1a.75.75 0 0 0-.75.75v6a.75.75 0 0 1-1.5 0V5a2.25 2.25 0 0 1 2.25-2.25h1Z" />
    </svg>
  );
}

function GistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
