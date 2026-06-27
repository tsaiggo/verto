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
import type { ContentFileNode } from "./content-source/types";

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
  /** Not yet a supported source; renders as a non-interactive "coming soon" card. */
  comingSoon: boolean;
  /** Primary target line — `owner/repo` for GitHub, folder name otherwise. */
  primary?: string;
  /** Secondary "branch" line (GitHub only). */
  branch?: string;
  /** Secondary path line (the content sub-path within the source). */
  path?: string;
  /** External link to open the source in its native UI, when available. */
  url?: string;
}

export interface HomeLibraryOverview {
  totalDocuments: number;
  taggedDocuments: number;
  tagCount: number;
  statusCount: number;
  collections: HomeLibraryCollection[];
}

export interface HomeLibraryCollection {
  kind: "tag" | "status";
  label: string;
  count: number;
  href?: string;
}

/** Fixed reading-workflow columns the home status board groups documents into. */
export type StatusColumnId = "unread" | "reading" | "done" | "other";

/** A single document card shown within a status-board column. */
export interface HomeStatusCard {
  title: string;
  href: string;
  /** Source-relative path shown as the card's secondary line. */
  path: string;
  /** The document's raw frontmatter `status`, when present. */
  status?: string;
}

/** One column of the read-only home status board. */
export interface HomeStatusColumn {
  id: StatusColumnId;
  label: string;
  cards: HomeStatusCard[];
}

/** Read-only Kanban grouping of the library by reading-workflow status. */
export interface HomeStatusBoard {
  columns: HomeStatusColumn[];
  /** Total documents placed across all columns. */
  total: number;
}

const PROVIDER_BLURB: Record<HomeProviderKind, string> = {
  github: "Connect a public or private GitHub repository.",
  onedrive: "Connect to your Microsoft OneDrive storage.",
  googledrive: "Google Drive support is coming soon.",
};

const PROVIDER_NAME: Record<HomeProviderKind, string> = {
  github: "GitHub Repo",
  onedrive: "OneDrive",
  googledrive: "Google Drive",
};

/** Order of provider cards shown under "Your connected sources". */
const PROVIDER_ORDER: HomeProviderKind[] = ["github", "onedrive", "googledrive"];

/** Providers shown for roadmap visibility that are not yet a supported `SourceKind`. */
const COMING_SOON_PROVIDERS: ReadonlySet<HomeProviderKind> = new Set(["googledrive"]);

/**
 * Pure builder: derive the home dashboard's "connected sources" cards from the
 * active connection details. Only the configured provider (GitHub or OneDrive)
 * is marked connected; the remaining providers render as connect prompts.
 */
export function buildConnectedSources(connection: ConnectionDetails): HomeConnectedSource[] {
  return PROVIDER_ORDER.map((kind) => {
    const base: HomeConnectedSource = {
      kind,
      name: PROVIDER_NAME[kind],
      blurb: PROVIDER_BLURB[kind],
      connected: false,
      comingSoon: COMING_SOON_PROVIDERS.has(kind),
    };

    // Only GitHub / OneDrive can be the active content source; Google Drive is
    // presentational only (not a supported `SourceKind`). Narrowing `kind` to
    // the cloud providers lets us compare against `connection.kind` without a
    // type assertion.
    const isCloudProvider = kind === "github" || kind === "onedrive";
    const isActive = connection.connected && isCloudProvider && connection.kind === kind;

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

function countLabels(labels: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const normalized = label.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

function topCollections(
  counts: Map<string, number>,
  kind: HomeLibraryCollection["kind"],
  limit: number
): HomeLibraryCollection[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({
      kind,
      label,
      count,
      href: `/read/${kind === "tag" ? "tags" : "status"}/${encodeURIComponent(label)}`,
    }));
}

export function buildLibraryOverview(
  files: readonly ContentFileNode[],
  collectionLimit = 6
): HomeLibraryOverview {
  const tagCounts = countLabels(files.flatMap((file) => file.tags ?? []));
  const statusCounts = countLabels(files.map((file) => file.status ?? ""));
  const tagLimit = Math.max(0, Math.ceil(collectionLimit / 2));
  const statusLimit = Math.max(0, collectionLimit - tagLimit);

  return {
    totalDocuments: files.length,
    taggedDocuments: files.filter((file) => (file.tags ?? []).length > 0).length,
    tagCount: tagCounts.size,
    statusCount: statusCounts.size,
    collections: [
      ...topCollections(tagCounts, "tag", tagLimit),
      ...topCollections(statusCounts, "status", statusLimit),
    ],
  };
}

/** Display labels for the fixed status-board columns. */
const STATUS_COLUMN_LABEL: Record<StatusColumnId, string> = {
  unread: "Unread",
  reading: "Reading",
  done: "Done",
  other: "Other",
};

/**
 * Map a raw frontmatter `status` to one of the fixed board columns. Common
 * workflow synonyms are normalized so a zero-config library still groups
 * sensibly; an unrecognized non-empty status lands in `other`. Documents
 * without a status are treated as `unread` by the caller.
 */
const STATUS_ALIASES: Record<string, StatusColumnId> = {
  unread: "unread",
  todo: "unread",
  "to-read": "unread",
  "to read": "unread",
  backlog: "unread",
  inbox: "unread",
  new: "unread",
  draft: "unread",
  reading: "reading",
  wip: "reading",
  "in-progress": "reading",
  "in progress": "reading",
  started: "reading",
  doing: "reading",
  done: "done",
  read: "done",
  finished: "done",
  complete: "done",
  completed: "done",
  published: "done",
  evergreen: "done",
  archived: "done",
  archive: "done",
};

/** Resolve a raw status string to its board column; missing/blank → `unread`. */
export function statusColumnId(status: string | undefined): StatusColumnId {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) return "unread";
  return STATUS_ALIASES[normalized] ?? "other";
}

/**
 * Group the library into a read-only reading-workflow board. Documents are
 * placed into fixed columns (Unread / Reading / Done) by their frontmatter
 * `status`; unrecognized statuses collect in an `other` column that is only
 * present when non-empty. Input order is preserved within each column, so the
 * caller controls card ordering (e.g. most-recent first).
 */
export function buildStatusBoard(files: readonly ContentFileNode[]): HomeStatusBoard {
  const buckets: Record<StatusColumnId, HomeStatusCard[]> = {
    unread: [],
    reading: [],
    done: [],
    other: [],
  };

  for (const file of files) {
    const column = statusColumnId(file.status);
    buckets[column].push({
      title: file.title,
      href: file.href,
      path: `${file.slug.join("/")}${file.ext}`,
      status: file.status?.trim() || undefined,
    });
  }

  const order: StatusColumnId[] = ["unread", "reading", "done", "other"];
  const columns = order
    // The fixed three columns always render (even when empty) to keep the
    // board's shape stable; `other` only appears when it has cards.
    .filter((id) => id !== "other" || buckets[id].length > 0)
    .map((id) => ({ id, label: STATUS_COLUMN_LABEL[id], cards: buckets[id] }));

  return { columns, total: files.length };
}
