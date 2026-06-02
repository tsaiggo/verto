// Presentational helpers for the Verto home dashboard.
//
// The home page renders an overview of the connected content sources. Verto
// resolves real content from a *single* active source (selected by
// `VERTO_CONTENT_SOURCE`), so this module derives, from the active
// {@link ConnectionDetails}, the small presentational list of provider cards
// the dashboard shows — marking the configured provider as connected (with its
// real repository / path) and the others as available to connect.
//
// Like the other `*-info` helpers these builders are pure and never throw, so
// the statically-rendered home page degrades gracefully when no remote source
// is configured.

import type { ConnectionDetails } from "./connection-info";

/** Provider kinds surfaced as cards on the home dashboard. */
export type HomeProviderKind = "github" | "onedrive" | "googledrive";

export interface HomeConnectedSource {
  kind: HomeProviderKind;
  /** Provider display name, e.g. "GitHub Repo". */
  name: string;
  /** One-line description shown when the provider is not connected. */
  blurb: string;
  /** Whether this provider is the active, configured source. */
  connected: boolean;
  /** Primary target line — `owner/repo` for GitHub, folder name otherwise. */
  primary?: string;
  /** Secondary "branch" line (GitHub only). */
  branch?: string;
  /** Secondary path line (the content sub-path within the source). */
  path?: string;
  /** External link to open the source in its native UI, when available. */
  url?: string;
}

const PROVIDER_BLURB: Record<HomeProviderKind, string> = {
  github: "Connect a public or private GitHub repository.",
  onedrive: "Connect to your Microsoft OneDrive storage.",
  googledrive: "Connect to your Google Drive storage.",
};

const PROVIDER_NAME: Record<HomeProviderKind, string> = {
  github: "GitHub Repo",
  onedrive: "OneDrive",
  googledrive: "Google Drive",
};

/** Order of provider cards shown under "Your connected sources". */
const PROVIDER_ORDER: HomeProviderKind[] = ["github", "onedrive", "googledrive"];

/**
 * Pure builder: derive the home dashboard's "connected sources" cards from the
 * active connection details. Only the configured provider (GitHub or OneDrive)
 * is marked connected; the remaining providers render as connect prompts.
 */
export function buildConnectedSources(
  connection: ConnectionDetails,
): HomeConnectedSource[] {
  return PROVIDER_ORDER.map((kind) => {
    const base: HomeConnectedSource = {
      kind,
      name: PROVIDER_NAME[kind],
      blurb: PROVIDER_BLURB[kind],
      connected: false,
    };

    // Only GitHub / OneDrive can be the active content source; Google Drive is
    // presentational only (not a supported `SourceKind`).
    const isActive =
      connection.connected &&
      (connection.kind as HomeProviderKind) === kind &&
      kind !== "googledrive";

    if (!isActive) return base;

    if (kind === "github") {
      return {
        ...base,
        connected: true,
        primary: connection.repo ?? "owner/repo",
        branch: connection.branch ?? "main",
        path: connection.path,
        url: connection.url,
      };
    }

    // onedrive
    return {
      ...base,
      connected: true,
      primary: connection.name,
      path: connection.path,
      url: connection.url,
    };
  });
}

/** How many provider cards are currently connected. */
export function countConnected(sources: HomeConnectedSource[]): number {
  return sources.filter((s) => s.connected).length;
}
