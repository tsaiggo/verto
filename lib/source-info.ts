// Source metadata helper.
//
// Surfaces a small, serialisable description of the active content source
// (kind, human label, and—when applicable—repository / branch / link) so the
// UI shell can render the library header, breadcrumb prefix, and the
// "Connected to …" panel without constructing a live `ContentSource` (which
// may perform network calls or throw on missing env).
//
// This intentionally reads `process.env` directly and never throws: an
// unconfigured remote source degrades to a "not configured" label rather
// than breaking the build of the reader UI.

export type SourceKind = "docs" | "local" | "github" | "onedrive";

export interface SourceInfo {
  /** Active presentation kind; bundled showcase content is distinct from explicit local files. */
  kind: SourceKind;
  /** Human-friendly group name, e.g. "Showcase", "GitHub Repo", "Local Files". */
  name: string;
  /** One-line label describing the connection target. */
  label: string;
  /** `owner/repo`, GitHub only. */
  repo?: string;
  /** Branch name, GitHub only. */
  branch?: string;
  /** External link to open the source in its native UI, when available. */
  url?: string;
}

/** Display name for a source kind, matching the design's library groups. */
export function sourceKindName(kind: SourceKind): string {
  switch (kind) {
    case "github":
      return "GitHub Repo";
    case "onedrive":
      return "OneDrive";
    case "docs":
      return "Showcase";
    case "local":
    default:
      return "Local Files";
  }
}

function activeKind(): SourceKind {
  const raw = process.env.VERTO_CONTENT_SOURCE?.trim().toLowerCase();
  if (!raw) {
    return (process.env.VERTO_LOCAL_DIR ?? "").trim() ? "local" : "docs";
  }
  if (raw === "github") return "github";
  if (raw === "onedrive") return "onedrive";
  if (raw === "local") return "local";
  return "local";
}

/**
 * Resolve a serialisable description of the active content source from the
 * environment. Safe to call from any server component.
 */
export function getSourceInfo(): SourceInfo {
  const kind = activeKind();

  if (kind === "github") {
    const repoRaw = (process.env.VERTO_GITHUB_REPO ?? "").trim();
    const branch = (process.env.VERTO_GITHUB_BRANCH ?? "main").trim() || "main";
    const m = repoRaw.match(/^([^/\s]+)\/([^/\s]+)$/);
    const repo = m ? `${m[1]}/${m[2]}` : repoRaw || undefined;
    const prefix = (process.env.VERTO_GITHUB_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
    const url = repo
      ? `https://github.com/${repo}/tree/${branch}${prefix ? "/" + prefix : ""}`
      : undefined;
    return {
      kind,
      name: sourceKindName(kind),
      label: repo ? `${repo}@${branch}` : "GitHub (not configured)",
      repo,
      branch,
      url,
    };
  }

  if (kind === "onedrive") {
    const path = (process.env.VERTO_ONEDRIVE_PATH ?? "").trim();
    return {
      kind,
      name: sourceKindName(kind),
      label: path ? `OneDrive · ${path}` : "OneDrive",
    };
  }

  if (kind === "docs") {
    return {
      kind,
      name: sourceKindName(kind),
      label: "Bundled showcase content",
    };
  }

  return {
    kind,
    name: sourceKindName(kind),
    label: localSourceLabel(process.env.VERTO_LOCAL_DIR),
  };
}

/** One-line label for the local source, reflecting `VERTO_LOCAL_DIR`. */
export function localSourceLabel(dir: string | undefined): string {
  const trimmed = (dir ?? "").trim();
  return trimmed ? `Local · ${trimmed}` : "Local content";
}
