import { CircleDot, FileCode2, GitFork, Github, GitPullRequest, Play, Star } from "lucide-react";
import { resolveEmbed } from "@/lib/embed";
import type {
  BookmarkEmbedMeta,
  EmbedMeta,
  GithubGistEmbedMeta,
  GithubIssueEmbedMeta,
  GithubRepoEmbedMeta,
  TweetEmbedMeta,
  YouTubeEmbedMeta,
} from "@/lib/embed/types";

interface EmbedProps {
  url: string;
  /** Force a particular renderer regardless of URL detection. */
  as?: "auto" | "bookmark";
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
export default async function Embed(props: EmbedProps) {
  const meta = await resolveMeta(props);
  return renderCard(meta);
}

/** Resolve the metadata to render: author overrides win, then provider lookup. */
async function resolveMeta(props: EmbedProps): Promise<EmbedMeta> {
  const { url, as = "auto", title, description, image, siteName } = props;

  // Author-supplied metadata wins; skip the network entirely.
  const hasOverride =
    title !== undefined ||
    description !== undefined ||
    image !== undefined ||
    siteName !== undefined;

  // No override and not a forced bookmark → full provider resolution.
  if (as !== "bookmark" && !hasOverride) {
    return resolveEmbed(url);
  }

  const minimal: BookmarkEmbedMeta = {
    kind: "bookmark",
    url,
    hostname: hostnameOf(url),
    title,
    description,
    image,
    siteName,
  };

  // An explicit override stays minimal; only a bare as="bookmark" enriches.
  if (hasOverride) return minimal;

  // Try to enrich an as="bookmark" embed with OG data; fall back to the
  // minimal card if resolution fails.
  try {
    const meta = await resolveEmbed(url);
    if (meta.kind === "bookmark") return meta;
    return { kind: "bookmark", url, hostname: meta.hostname, title: extractTitle(meta) };
  } catch {
    return minimal;
  }
}

/** Pick the provider-specific card for the resolved metadata. */
function renderCard(meta: EmbedMeta) {
  switch (meta.kind) {
    case "github-repo":
      return <GithubRepoCard meta={meta} />;
    case "github-issue":
      return <GithubIssueCard meta={meta} />;
    case "github-gist":
      return <GithubGistCard meta={meta} />;
    case "youtube":
      return <YouTubeCard meta={meta} />;
    case "tweet":
      return <TweetCard meta={meta} />;
    case "bookmark":
    default:
      return <BookmarkCard meta={meta} />;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function extractTitle(meta: EmbedMeta): string | undefined {
  switch (meta.kind) {
    case "github-repo":
      return `${meta.owner}/${meta.repo}`;
    case "github-issue":
      return `${meta.owner}/${meta.repo}#${meta.number}: ${meta.title}`;
    case "github-gist":
      return `${meta.owner}/${meta.id}`;
    case "youtube":
      return meta.title;
    case "tweet":
      return `@${meta.author}`;
    default:
      return undefined;
  }
}

function compactNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
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
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function BookmarkCard({ meta }: { meta: BookmarkEmbedMeta }) {
  return (
    <CardLink href={meta.url} className="link-card embed-card embed-bookmark">
      {meta.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="embed-bookmark-image" src={meta.image} alt="" loading="lazy" />
      )}
      <span className="link-card-body">
        <span className="link-card-title">{meta.title ?? meta.url}</span>
        {meta.description && <span className="link-card-desc">{meta.description}</span>}
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
        <Github width={20} height={20} strokeWidth={2} />
      </span>
      <span className="link-card-body">
        <span className="link-card-title">
          {meta.owner}/<strong>{meta.repo}</strong>
        </span>
        {meta.description && <span className="link-card-desc">{meta.description}</span>}
        <span className="embed-gh-meta">
          {meta.language && (
            <span className="embed-gh-lang">
              <span
                className="embed-gh-lang-dot"
                style={{
                  background: meta.languageColor ?? "var(--text-muted)",
                }}
                aria-hidden="true"
              />
              {meta.language}
            </span>
          )}
          {typeof meta.stars === "number" && (
            <span
              className="embed-gh-stat"
              title={`${meta.stars} stars`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Star width={13} height={13} strokeWidth={2} aria-hidden="true" />
              {compactNumber(meta.stars)}
            </span>
          )}
          {typeof meta.forks === "number" && (
            <span
              className="embed-gh-stat"
              title={`${meta.forks} forks`}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <GitFork width={13} height={13} strokeWidth={2} aria-hidden="true" />
              {compactNumber(meta.forks)}
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
      <span className={`embed-gh-state embed-gh-state-${meta.state}`} aria-hidden="true">
        {meta.type === "pull" ? (
          <GitPullRequest width={16} height={16} strokeWidth={2} />
        ) : (
          <CircleDot width={16} height={16} strokeWidth={2} />
        )}
      </span>
      <span className="link-card-body">
        <span className="link-card-title">{meta.title}</span>
        <span className="embed-gh-meta">
          <span className={`embed-gh-pill embed-gh-pill-${meta.state}`}>{meta.state}</span>
          <span className="link-card-url">
            {meta.owner}/{meta.repo}#{meta.number}
            {meta.author ? ` · by ${meta.author}` : ""}
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
        <FileCode2 width={20} height={20} strokeWidth={1.8} />
      </span>
      <span className="link-card-body">
        <span className="link-card-title">
          {meta.files && meta.files.length > 0 ? meta.files[0] : `Gist ${meta.id.slice(0, 8)}`}
        </span>
        {meta.description && <span className="link-card-desc">{meta.description}</span>}
        <span className="link-card-url">
          gist.github.com/{meta.owner}
          {meta.files && meta.files.length > 1 ? ` · +${meta.files.length - 1} more` : ""}
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
            <Play width={22} height={22} strokeWidth={2} fill="currentColor" />
          </span>
        </span>
      )}
      <span className="link-card-body">
        <span className="link-card-title">{meta.title ?? "YouTube video"}</span>
        {meta.author && <span className="link-card-desc">{meta.author}</span>}
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
        <img className="embed-tweet-avatar" src={meta.authorAvatar} alt="" loading="lazy" />
      ) : (
        <span className="embed-tweet-avatar embed-tweet-avatar-fallback" aria-hidden="true">
          {meta.author.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="link-card-body">
        <span className="link-card-title">
          {meta.authorName ?? meta.author}{" "}
          <span className="embed-tweet-handle">@{meta.author}</span>
        </span>
        {meta.text && <span className="embed-tweet-text">{meta.text}</span>}
        <span className="link-card-url">{meta.hostname}</span>
      </span>
    </CardLink>
  );
}
