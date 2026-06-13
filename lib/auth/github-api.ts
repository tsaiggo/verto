// Authenticated GitHub REST helpers used by the desktop connect-repo flow.
//
// These wrap the handful of GitHub endpoints the UI needs once the user has
// signed in: who am I (`/user`), which repositories can I read
// (`/user/repos`), which branches does a repo have (`/repos/.../branches`),
// and does a given content path exist on a branch (Git Trees API).
//
// All functions take an injected `fetch` so they can run against the Tauri
// HTTP plugin in production (bypassing CORS) and a mock in tests.

import type { FetchLike } from "@/lib/tauri";

const GITHUB_API = "https://api.github.com";

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GitHubRepo {
  /** `owner/repo`. */
  fullName: string;
  /** Default branch, e.g. "main". */
  defaultBranch: string;
  /** Whether the repo is private. */
  private: boolean;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "verto-desktop",
    Authorization: "Bearer " + token,
  };
}

async function ghGet(fetchImpl: FetchLike, token: string, url: string): Promise<Response> {
  const res = await fetchImpl(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub API ${res.status} ${res.statusText} for ${url}` +
        (body ? ` — ${body.slice(0, 200)}` : "")
    );
  }
  return res;
}

/** Fetch the signed-in user's profile. */
export async function fetchUser(token: string, fetchImpl: FetchLike): Promise<GitHubUser> {
  const res = await ghGet(fetchImpl, token, `${GITHUB_API}/user`);
  const data = (await res.json()) as {
    login: string;
    name: string | null;
    avatar_url: string | null;
  };
  return {
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url ?? null,
  };
}

/**
 * List repositories the user can read, most-recently-updated first. Follows
 * pagination up to a sane cap so very large accounts don't hang the picker.
 */
export async function listRepos(
  token: string,
  fetchImpl: FetchLike,
  maxPages = 5
): Promise<GitHubRepo[]> {
  const out: GitHubRepo[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url =
      `${GITHUB_API}/user/repos?per_page=100&page=${page}` +
      `&sort=updated&affiliation=owner,collaborator,organization_member`;
    const res = await ghGet(fetchImpl, token, url);
    const rows = (await res.json()) as Array<{
      full_name: string;
      default_branch: string;
      private: boolean;
    }>;
    for (const r of rows) {
      out.push({
        fullName: r.full_name,
        defaultBranch: r.default_branch,
        private: r.private,
      });
    }
    if (rows.length < 100) break;
  }
  return out;
}

/** List branch names for a repo (`owner/repo`), most relevant first. */
export async function listBranches(
  token: string,
  repoFullName: string,
  fetchImpl: FetchLike,
  maxPages = 5
): Promise<string[]> {
  const out: string[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${GITHUB_API}/repos/${repoFullName}/branches?per_page=100&page=${page}`;
    const res = await ghGet(fetchImpl, token, url);
    const rows = (await res.json()) as Array<{ name: string }>;
    for (const b of rows) out.push(b.name);
    if (rows.length < 100) break;
  }
  return out;
}

/**
 * Check that `path` exists (as a directory or file) on `branch`. Resolves the
 * branch tree once and looks for an entry at the prefix — mirrors how the
 * GitHub content source enumerates files.
 */
export async function validateContentPath(
  token: string,
  repoFullName: string,
  branch: string,
  path: string,
  fetchImpl: FetchLike
): Promise<boolean> {
  const prefix = path.replace(/^\/+|\/+$/g, "");
  // Empty path means "repo root" — always valid.
  if (!prefix) return true;
  const url =
    `${GITHUB_API}/repos/${repoFullName}/git/trees/` + `${encodeURIComponent(branch)}?recursive=1`;
  const res = await ghGet(fetchImpl, token, url);
  const data = (await res.json()) as {
    tree: Array<{ path: string; type: string }>;
  };
  return data.tree.some((e) => e.path === prefix || e.path.startsWith(prefix + "/"));
}
