export type SourceKind = "local" | "onedrive";
export type SourceOrigin = "bundled" | "configured";

export type SourceReadiness =
  | { status: "ready"; error?: never }
  | { status: "error"; error: string };

export interface SourceInfo {
  kind: SourceKind;
  name: string;
  label: string;
  /** Whether the build reads Verto's checked-in sample or an explicitly configured source. */
  origin?: SourceOrigin;
  url?: string;
  /** Result of reading the configured build source, when the shell has checked it. */
  readiness?: SourceReadiness;
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
      origin: "configured",
    };
  }

  const configuredDir = (process.env.VERTO_LOCAL_DIR ?? "").trim();
  const bundled = configuredDir.length === 0;

  return {
    kind,
    name: bundled ? "Included demo" : sourceKindName(kind),
    label: bundled ? "Included demo" : localSourceLabel(configuredDir),
    origin: bundled ? "bundled" : "configured",
  };
}

export function isBundledSource(source: SourceInfo): boolean {
  if (source.origin) return source.origin === "bundled";

  // Backward compatibility for serialized state and older test fixtures.
  return (
    source.kind === "local" &&
    (source.name === "Included demo" || !source.label.startsWith("Folder ·"))
  );
}

export function localSourceLabel(dir: string | undefined): string {
  const trimmed = (dir ?? "").trim();
  return trimmed ? "Folder · " + trimmed : "Local library";
}
