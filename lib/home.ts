// Home library overview and status-board helpers.

import type { SourceKind } from "./source-info";
import type { ContentFileNode } from "./content-source/types";

export interface HomeConnectedSource {
  kind: SourceKind;
  connected: boolean;
  primary?: string;
  branch?: string;
  path?: string;
}

export interface HomeLibraryCollection {
  kind: "tag" | "status";
  label: string;
  count: number;
  href?: string;
}

export interface HomeLibraryOverview {
  totalDocuments: number;
  taggedDocuments: number;
  tagCount: number;
  statusCount: number;
  collections: HomeLibraryCollection[];
}

export type StatusColumnId = "unread" | "reading" | "done" | "other";

export interface HomeStatusCard {
  title: string;
  href: string;
  path: string;
  status?: string;
}

export interface HomeStatusColumn {
  id: StatusColumnId;
  label: string;
  cards: HomeStatusCard[];
}

export interface HomeStatusBoard {
  columns: HomeStatusColumn[];
  total: number;
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
      href: "/read/" + (kind === "tag" ? "tags" : "status") + "/" + encodeURIComponent(label),
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

const STATUS_COLUMN_LABEL: Record<StatusColumnId, string> = {
  unread: "Unread",
  reading: "Reading",
  done: "Done",
  other: "Other",
};

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

export function statusColumnId(status: string | undefined): StatusColumnId {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) return "unread";
  return STATUS_ALIASES[normalized] ?? "other";
}

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
      path: file.slug.join("/") + file.ext,
      status: file.status?.trim() || undefined,
    });
  }

  const order: StatusColumnId[] = ["unread", "reading", "done", "other"];
  const columns = order
    .filter((id) => id !== "other" || buckets[id].length > 0)
    .map((id) => ({ id, label: STATUS_COLUMN_LABEL[id], cards: buckets[id] }));

  return { columns, total: files.length };
}
