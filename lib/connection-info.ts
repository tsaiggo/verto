// Connection details helper for the Integrations / Connect source page.
//
// Builds a small, serialisable description of the active content source's
// *connection* — provider, repository, branch, content path, file filter and
// preview mode — so the "Connect source" UI can render the connection form and
// the "Source preview" panel without constructing a live `ContentSource`.
//
// Like `source-info.ts`, this reads `process.env` directly and never throws:
// an unconfigured remote source degrades to sensible placeholders rather than
// breaking the statically-rendered build.

import { getSourceInfo, sourceKindName, type SourceInfo, type SourceKind } from "./source-info";

/** Default glob applied to remote sources — `.mdx` and `.md` only. */
export const DEFAULT_FILE_FILTER = "**/*.{mdx,md}";

export interface ConnectionDetails {
  /** Active source kind (selected by `VERTO_CONTENT_SOURCE`). */
  kind: SourceKind;
  /** Provider display name, e.g. "Docs", "GitHub Repo", "Local Files". */
  name: string;
  /** `owner/repo` — GitHub only. */
  repo?: string;
  /** Branch name — GitHub only. */
  branch?: string;
  /** Content path within the source root (leading slash, e.g. "/docs"). */
  path: string;
  /** Glob filter describing which files are previewable. */
  filter: string;
  /** Human label for the preview mode, e.g. "Remote preview". */
  previewMode: string;
  /** Whether the source is read remotely (true) or from local disk (false). */
  remote: boolean;
  /** Whether the source is actually configured / reachable. */
  connected: boolean;
  /** External link to open the source in its native UI, when available. */
  url?: string;
}

/** Normalise an optional sub-path into a display value like "/docs" or "/". */
function normalizePath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "/";
}

/**
 * Pure builder: derive presentational connection details from a resolved
 * {@link SourceInfo} and an environment map. Extracted from {@link
 * getConnectionDetails} so it can be unit-tested without touching
 * `process.env`.
 */
export function buildConnectionDetails(
  source: SourceInfo,
  env: Record<string, string | undefined> = {}
): ConnectionDetails {
  if (source.kind === "github") {
    return {
      kind: "github",
      name: source.name,
      repo: source.repo,
      branch: source.branch,
      path: normalizePath(env.VERTO_GITHUB_PATH),
      filter: DEFAULT_FILE_FILTER,
      previewMode: "Remote preview",
      remote: true,
      connected: Boolean(source.repo),
      url: source.url,
    };
  }

  if (source.kind === "onedrive") {
    return {
      kind: "onedrive",
      name: source.name,
      path: normalizePath(env.VERTO_ONEDRIVE_PATH),
      filter: DEFAULT_FILE_FILTER,
      previewMode: "Remote preview",
      remote: true,
      connected: Boolean(
        (env.VERTO_ONEDRIVE_SHARE_URL ?? "").trim() ||
        (env.VERTO_ONEDRIVE_REFRESH_TOKEN ?? "").trim()
      ),
      url: source.url,
    };
  }

  if (source.kind === "docs") {
    return {
      kind: "docs",
      name: source.name,
      path: normalizePath("content"),
      filter: DEFAULT_FILE_FILTER,
      previewMode: "Bundled preview",
      remote: false,
      connected: true,
    };
  }

  return {
    kind: "local",
    name: sourceKindName("local"),
    path: normalizePath(env.VERTO_LOCAL_DIR ?? "content"),
    filter: DEFAULT_FILE_FILTER,
    previewMode: "Local preview",
    remote: false,
    connected: true,
  };
}

/**
 * Resolve presentational connection details for the active content source.
 * Safe to call from any server component.
 */
export function getConnectionDetails(): ConnectionDetails {
  return buildConnectionDetails(getSourceInfo(), process.env);
}
