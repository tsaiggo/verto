import type { GithubGistEmbedMeta, GithubIssueEmbedMeta, GithubRepoEmbedMeta } from "../types";

/**
 * GitHub embed resolvers (repo / issue / pull-request / gist).
 *
 * All requests go through the unauthenticated REST API by default, which
 * has a hard 60-req/hour rate limit per IP. When `GITHUB_TOKEN` is set in
 * the build environment we attach it as a bearer to raise the limit to
 * 5000/hour — recommended for any CI that builds the site frequently.
 *
 * Failures throw; the caller (`resolveEmbed`) is responsible for falling
 * back to a bookmark-shaped meta on failure so a broken link can never
 * crash a page render.
 */

const API = "https://api.github.com";
const ACCEPT = "application/vnd.github+json";
const UA = "verto-embed";

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: ACCEPT,
    "User-Agent": UA,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function ghFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    // Allow fetch caching in Next's data layer when running in RSC context.
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

// ── Repo ──────────────────────────────────────────────────────────────────

interface RepoApi {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
}

export async function resolveGithubRepo(
  url: string,
  hostname: string,
  owner: string,
  repo: string
): Promise<GithubRepoEmbedMeta> {
  const data = await ghFetch<RepoApi>(`/repos/${owner}/${repo}`);
  return {
    kind: "github-repo",
    url,
    hostname,
    owner,
    repo,
    description: data.description ?? undefined,
    stars: data.stargazers_count,
    forks: data.forks_count,
    language: data.language ?? undefined,
    languageColor: data.language ? GITHUB_LANGUAGE_COLORS[data.language] : undefined,
  };
}

// ── Issue / Pull request ─────────────────────────────────────────────────

interface IssueApi {
  number: number;
  title: string;
  state: "open" | "closed";
  user: { login: string } | null;
  pull_request?: { merged_at?: string | null; draft?: boolean } | null;
  draft?: boolean;
  merged?: boolean;
}

export async function resolveGithubIssue(
  url: string,
  hostname: string,
  owner: string,
  repo: string,
  number: number,
  type: "issue" | "pull"
): Promise<GithubIssueEmbedMeta> {
  // The issues endpoint also returns pull requests — saves a code path.
  const data = await ghFetch<IssueApi>(`/repos/${owner}/${repo}/issues/${number}`);

  let state: GithubIssueEmbedMeta["state"] = data.state;
  if (data.pull_request) {
    if (data.pull_request.merged_at) state = "merged";
    else if (data.pull_request.draft) state = "draft";
  }

  return {
    kind: "github-issue",
    url,
    hostname,
    type,
    owner,
    repo,
    number: data.number,
    title: data.title,
    state,
    author: data.user?.login,
  };
}

// ── Gist ─────────────────────────────────────────────────────────────────

interface GistApi {
  id: string;
  description: string | null;
  owner: { login: string } | null;
  files: Record<string, { filename: string }> | null;
}

export async function resolveGithubGist(
  url: string,
  hostname: string,
  owner: string,
  id: string
): Promise<GithubGistEmbedMeta> {
  const data = await ghFetch<GistApi>(`/gists/${id}`);
  const fileNames = data.files
    ? Object.values(data.files)
        .filter((f): f is { filename: string } => Boolean(f?.filename))
        .map((f) => f.filename)
        .slice(0, 4)
    : undefined;
  return {
    kind: "github-gist",
    url,
    hostname,
    owner: data.owner?.login ?? owner,
    id: data.id,
    description: data.description ?? undefined,
    files: fileNames,
  };
}

// ── Language color palette (subset of github/linguist) ───────────────────
// Keep this list small and intentional; expand only on demand. Hex values
// come from `github-linguist`'s `languages.yml` and are not user-tunable.
const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#701516",
  PHP: "#4F5D95",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dart: "#00B4AB",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Lua: "#000080",
  Scala: "#c22d40",
  Zig: "#ec915c",
  MDX: "#fcb32c",
  Markdown: "#083fa1",
};
