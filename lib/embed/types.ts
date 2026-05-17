/**
 * Shared types for the build-time embed metadata resolver.
 *
 * `<Embed url="…">` resolves a single URL into one of these `EmbedMeta`
 * variants at render time (server-side), then renders a small `.link-card`
 * variant tailored to that provider — never an iframe.
 */

/** Common fields every variant carries — used for graceful degradation. */
export interface BaseEmbedMeta {
  /** Original URL as authored. */
  url: string;
  /** Pretty hostname (no `www.`) for the small footer text. */
  hostname: string;
}

export interface BookmarkEmbedMeta extends BaseEmbedMeta {
  kind: 'bookmark';
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface GithubRepoEmbedMeta extends BaseEmbedMeta {
  kind: 'github-repo';
  owner: string;
  repo: string;
  description?: string;
  stars?: number;
  forks?: number;
  language?: string;
  /** Hex string like `#3178c6`. */
  languageColor?: string;
}

export type GithubIssueState = 'open' | 'closed' | 'merged' | 'draft';

export interface GithubIssueEmbedMeta extends BaseEmbedMeta {
  kind: 'github-issue';
  /** `issue` or `pull-request`. */
  type: 'issue' | 'pull';
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: GithubIssueState;
  author?: string;
}

export interface GithubGistEmbedMeta extends BaseEmbedMeta {
  kind: 'github-gist';
  owner: string;
  id: string;
  description?: string;
  /** Names of files contained in the gist (first few). */
  files?: string[];
}

export interface YouTubeEmbedMeta extends BaseEmbedMeta {
  kind: 'youtube';
  videoId: string;
  title?: string;
  author?: string;
  thumbnail?: string;
}

export interface TweetEmbedMeta extends BaseEmbedMeta {
  kind: 'tweet';
  id: string;
  author: string;
  authorName?: string;
  authorAvatar?: string;
  text: string;
  createdAt?: string;
}

export type EmbedMeta =
  | BookmarkEmbedMeta
  | GithubRepoEmbedMeta
  | GithubIssueEmbedMeta
  | GithubGistEmbedMeta
  | YouTubeEmbedMeta
  | TweetEmbedMeta;

/** Override prop hash accepted by `<Embed>` for manual metadata. */
export interface EmbedOverrides {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}
