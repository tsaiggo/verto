import {
  getSourceInfo,
  isBundledSource,
  type SourceInfo,
  type SourceKind,
  type SourceOrigin,
} from "./source-info";

export const DEFAULT_FILE_FILTER = "**/*.{mdx,md}";

export interface ConnectionDetails {
  kind: SourceKind;
  name: string;
  path: string;
  filter: string;
  previewMode: string;
  remote: boolean;
  connected: boolean;
  sourceOrigin: SourceOrigin;
  url?: string;
}

function normalizePath(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? "/" + trimmed : "/";
}

export function buildConnectionDetails(
  source: SourceInfo,
  env: Record<string, string | undefined> = {}
): ConnectionDetails {
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
      sourceOrigin: "configured",
      url: source.url,
    };
  }

  return {
    kind: "local",
    name: source.name,
    path: normalizePath(env.VERTO_LOCAL_DIR ?? "content"),
    filter: DEFAULT_FILE_FILTER,
    previewMode: "Local preview",
    remote: false,
    connected: true,
    sourceOrigin: isBundledSource(source) ? "bundled" : "configured",
  };
}

export function getConnectionDetails(): ConnectionDetails {
  return buildConnectionDetails(getSourceInfo(), process.env);
}
