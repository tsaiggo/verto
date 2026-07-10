export type SourceKind = "local" | "onedrive";

export interface SourceInfo {
  kind: SourceKind;
  name: string;
  label: string;
  url?: string;
}

export function sourceKindName(kind: SourceKind): string {
  return kind === "onedrive" ? "OneDrive" : "Local Library";
}

function activeKind(): SourceKind {
  return process.env.VERTO_CONTENT_SOURCE?.trim().toLowerCase() === "onedrive"
    ? "onedrive"
    : "local";
}

export function getSourceInfo(): SourceInfo {
  const kind = activeKind();

  if (kind === "onedrive") {
    const path = (process.env.VERTO_ONEDRIVE_PATH ?? "").trim();
    return {
      kind,
      name: sourceKindName(kind),
      label: path ? "OneDrive · " + path : "OneDrive",
    };
  }

  return {
    kind,
    name: sourceKindName(kind),
    label: localSourceLabel(process.env.VERTO_LOCAL_DIR),
  };
}

export function localSourceLabel(dir: string | undefined): string {
  const trimmed = (dir ?? "").trim();
  return trimmed ? "Folder · " + trimmed : "Local library";
}
