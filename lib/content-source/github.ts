// GitHub repo content source — implemented in Phase 2.
//
// Configuration (env):
//   VERTO_GITHUB_REPO=owner/repo        required
//   VERTO_GITHUB_BRANCH=main             default "main"
//   VERTO_GITHUB_PATH=content            sub-directory in the repo to use as root (default "")
//   VERTO_GITHUB_TOKEN=ghp_xxx           optional; raises the rate limit to 5000/h

import type { ContentSource, RawFileEntry } from "./types";
import { isReadable } from "./tree";

const GITHUB_API = "https://api.github.com";

interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  /** Sub-path inside the repo to treat as the content root (no leading `/`). */
  prefix: string;
  token?: string;
}

function readConfig(): GitHubConfig {
  const repo = (process.env.VERTO_GITHUB_REPO ?? "").trim();
  if (!repo) {
    throw new Error(
      'GitHub source requires VERTO_GITHUB_REPO="owner/repo" to be set.',
    );
  }
  const m = repo.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) {
    throw new Error(
      `VERTO_GITHUB_REPO must be "owner/repo", got "${repo}".`,
    );
  }
  const branch = (process.env.VERTO_GITHUB_BRANCH ?? "main").trim() || "main";
  const rawPrefix = (process.env.VERTO_GITHUB_PATH ?? "").trim();
  // Normalise: strip leading/trailing slashes, collapse dupes
  const prefix = rawPrefix
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/{2,}/g, "/");
  const token = process.env.VERTO_GITHUB_TOKEN?.trim() || undefined;
  return { owner: m[1], repo: m[2], branch, prefix, token };
}

function authHeaders(cfg: GitHubConfig): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "verto-content-source",
  };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
  return headers;
}

async function ghFetch(
  cfg: GitHubConfig,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(cfg), ...(init?.headers ?? {}) },
  });
  if (res.ok) return res;

  if (res.status === 404) {
    throw new Error(
      `GitHub source: 404 from ${url} — ` +
        `check VERTO_GITHUB_REPO ("${cfg.owner}/${cfg.repo}"), ` +
        `VERTO_GITHUB_BRANCH ("${cfg.branch}") and VERTO_GITHUB_PATH ("${cfg.prefix}").`,
    );
  }

  if (
    res.status === 403 &&
    res.headers.get("x-ratelimit-remaining") === "0"
  ) {
    const reset = res.headers.get("x-ratelimit-reset");
    const resetAt = reset
      ? new Date(Number(reset) * 1000).toISOString()
      : "soon";
    throw new Error(
      `GitHub source: rate limit exceeded (resets at ${resetAt}). ` +
        `Set VERTO_GITHUB_TOKEN to raise the limit from 60/h to 5000/h.`,
    );
  }

  const body = await res.text().catch(() => "");
  throw new Error(
    `GitHub source: ${res.status} ${res.statusText} from ${url}` +
      (body ? ` — ${body.slice(0, 200)}` : ""),
  );
}

interface GitTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url?: string;
}

interface GitTreeResponse {
  sha: string;
  url: string;
  tree: GitTreeEntry[];
  truncated: boolean;
}

/**
 * Strip the configured `prefix` from a path. Returns null if the path is
 * outside the prefix (and should be ignored).
 */
function stripPrefix(p: string, prefix: string): string | null {
  if (!prefix) return p;
  if (p === prefix) return "";
  const lead = prefix + "/";
  if (p.startsWith(lead)) return p.slice(lead.length);
  return null;
}

export function createGitHubSource(): ContentSource {
  // Read config eagerly so configuration errors fail fast at startup.
  const cfg = readConfig();

  let cachedTree: Promise<GitTreeResponse> | null = null;
  function fetchTree(): Promise<GitTreeResponse> {
    if (!cachedTree) {
      // The Git Trees API returns the whole repository in one call, which
      // is dramatically cheaper than walking via the `contents` API.
      const url =
        `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/git/trees/` +
        `${encodeURIComponent(cfg.branch)}?recursive=1`;
      cachedTree = ghFetch(cfg, url)
        .then((res) => res.json() as Promise<GitTreeResponse>)
        .catch((err) => {
          // Clear the cache so a transient failure can be retried.
          cachedTree = null;
          throw err;
        });
    }
    return cachedTree;
  }

  return {
    id: "github",
    label: `github (${cfg.owner}/${cfg.repo}@${cfg.branch}${cfg.prefix ? "/" + cfg.prefix : ""})`,

    async listFiles(): Promise<RawFileEntry[]> {
      const tree = await fetchTree();
      if (tree.truncated) {
        // 100k+ entries — Verto-scale vaults shouldn't hit this in practice.
        console.warn(
          `GitHub source: tree truncated for ${cfg.owner}/${cfg.repo}@${cfg.branch}; ` +
            "some files will be missing. Use a smaller VERTO_GITHUB_PATH.",
        );
      }
      const out: RawFileEntry[] = [];
      for (const entry of tree.tree) {
        if (entry.type !== "blob") continue;
        const rel = stripPrefix(entry.path, cfg.prefix);
        if (rel === null || rel === "") continue;
        const segs = rel.split("/");
        const last = segs[segs.length - 1];
        if (!isReadable(last)) continue;
        out.push({
          path: segs,
          id: entry.sha,
          sha: entry.sha,
          size: entry.size,
        });
      }
      return out;
    },

    async readFile(entry): Promise<string> {
      // Git Blobs API returns base64 — most robust for binary-safe transfer
      // and works for files that the Contents API would refuse (>1MB).
      const sha = entry.id;
      const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/git/blobs/${sha}`;
      const res = await ghFetch(cfg, url);
      const json = (await res.json()) as {
        content: string;
        encoding: string;
      };
      if (json.encoding === "base64") {
        return Buffer.from(json.content, "base64").toString("utf-8");
      }
      // "utf-8" is documented but rarely seen; fall through honestly.
      return json.content;
    },

    async readOptionalFile(segs: string[]): Promise<string | null> {
      const tree = await fetchTree();
      const full =
        (cfg.prefix ? cfg.prefix + "/" : "") + segs.join("/");
      const match = tree.tree.find(
        (e) => e.type === "blob" && e.path === full,
      );
      if (!match) return null;
      const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/git/blobs/${match.sha}`;
      try {
        const res = await ghFetch(cfg, url);
        const json = (await res.json()) as {
          content: string;
          encoding: string;
        };
        if (json.encoding === "base64") {
          return Buffer.from(json.content, "base64").toString("utf-8");
        }
        return json.content;
      } catch {
        return null;
      }
    },
  };
}
