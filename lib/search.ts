// Build-time search index for the "Search & Library" experience.
//
// Verto is a statically-rendered reader, so search runs entirely on a
// pre-built index rather than a live server query. This module is pure and
// IO-free: the `/search` route reads raw file contents through the content
// source and hands them here to be turned into flat, serialisable
// `SearchRecord`s. The client then filters and ranks them with `searchRecords`.

import { extractTOC } from "@/lib/toc";
import type {
  ContentDirNode,
  ContentFileNode,
  ContentNode,
} from "@/lib/content-source";
import type { SourceKind } from "@/lib/source-info";

/** Searchable record kinds, mirroring the scope tabs in the design. */
export type SearchKind = "page" | "heading" | "code" | "folder";

/** Tab values shown above the result list — `all` spans every kind. */
export type SearchScope = "all" | SearchKind;

/** Result ordering modes exposed by the Search page sort control. */
export type SearchSort = "relevance" | "recent";

/** A single flat, serialisable entry in the search index. */
export interface SearchRecord {
  /** Stable unique id (used as a React key). */
  id: string;
  kind: SearchKind;
  /** Primary label shown in the result row. */
  title: string;
  /** Secondary preview line (description / heading context / code excerpt). */
  snippet?: string;
  /** Destination URL (under `/read`, with a `#anchor` for headings). */
  href: string;
  /** Human breadcrumb path, e.g. `docs / guides / mdx-authoring.mdx`. */
  path: string;
  /** Frontmatter tags carried through for the Tags filter. */
  tags?: string[];
  /** Fenced-code language label, for `code` records only. */
  language?: string;
  /** Modification time (ms since epoch); 0 when the source can't supply it. */
  updated: number;
  /** Active source kind — drives the per-row source badge. */
  sourceKind: SourceKind | "googledrive";
  /** Human source name shown on the badge, e.g. "GitHub". */
  sourceName: string;
}

/** Per-kind tallies used by the content-type filter and the result header. */
export interface SearchCounts {
  all: number;
  page: number;
  heading: number;
  code: number;
  folder: number;
}

interface SourceLabel {
  kind: SourceKind | "googledrive";
  name: string;
}

/**
 * Extract fenced code blocks from raw MDX/Markdown.
 *
 * Returns the declared language (or `"text"`) and the block body with
 * surrounding blank lines trimmed. Indented (non-fenced) code is ignored —
 * it isn't meaningful to surface as a discrete search result.
 */
export function extractCodeBlocks(
  raw: string,
): { language: string; code: string }[] {
  const lines = raw.split("\n");
  const blocks: { language: string; code: string }[] = [];
  let open: { language: string; body: string[] } | null = null;

  for (const line of lines) {
    const fence = line.trimStart().match(/^```+\s*([^\s`]*)/);
    if (open) {
      if (line.trimStart().startsWith("```")) {
        const code = open.body.join("\n").trim();
        if (code) blocks.push({ language: open.language, code });
        open = null;
      } else {
        open.body.push(line);
      }
      continue;
    }
    if (fence) {
      open = { language: (fence[1] || "text").toLowerCase(), body: [] };
    }
  }

  return blocks;
}

/** Collapse runs of whitespace and trim — keeps snippets on one line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Truncate to `max` chars on a word boundary, adding an ellipsis. */
function truncate(text: string, max = 160): string {
  const clean = oneLine(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** Human breadcrumb path from slug segments + filename. */
function pathLabel(node: ContentFileNode): string {
  const segs = node.slug.length ? node.slug.slice(0, -1) : [];
  const file = node.slug[node.slug.length - 1] ?? "";
  const name = file + (node.ext ?? "");
  return [...segs, name].join(" / ") || name;
}

/**
 * Build every `SearchRecord` for a single document: one `page` record, a
 * `heading` record per H2–H4, and a `code` record per fenced block.
 */
export function buildFileRecords(
  node: ContentFileNode,
  raw: string,
  source: SourceLabel,
): SearchRecord[] {
  const records: SearchRecord[] = [];
  const path = pathLabel(node);
  const base = {
    tags: node.tags,
    updated: node.mtime ?? 0,
    sourceKind: source.kind,
    sourceName: source.name,
  };

  records.push({
    id: `page:${node.slug.join("/")}`,
    kind: "page",
    title: node.title,
    snippet: node.description ? truncate(node.description) : undefined,
    href: node.href,
    path,
    ...base,
  });

  for (const heading of extractTOC(raw, { minDepth: 2, maxDepth: 4 })) {
    records.push({
      id: `heading:${node.slug.join("/")}#${heading.id}`,
      kind: "heading",
      title: heading.text,
      snippet: node.title,
      href: `${node.href}#${heading.id}`,
      path,
      ...base,
    });
  }

  for (const [i, block] of extractCodeBlocks(raw).entries()) {
    const firstLine = block.code.split("\n", 1)[0] ?? "";
    records.push({
      id: `code:${node.slug.join("/")}:${i}`,
      kind: "code",
      title: firstLine ? truncate(firstLine, 80) : `${block.language} snippet`,
      snippet: node.title,
      href: node.href,
      path,
      language: block.language,
      ...base,
    });
  }

  return records;
}

/** Build a `folder` record for every visible directory in the tree. */
export function buildFolderRecords(
  root: ContentDirNode,
  source: SourceLabel,
): SearchRecord[] {
  const records: SearchRecord[] = [];

  const walk = (node: ContentNode) => {
    if (node.hidden) return;
    if (node.type === "dir") {
      if (node.slug.length > 0) {
        const visible = node.children.filter((c) => !c.hidden).length;
        records.push({
          id: `folder:${node.slug.join("/")}`,
          kind: "folder",
          title: node.title,
          snippet: `${visible} ${visible === 1 ? "entry" : "entries"}`,
          href: node.href,
          path: node.slug.join(" / "),
          updated: 0,
          sourceKind: source.kind,
          sourceName: source.name,
        });
      }
      for (const child of node.children) walk(child);
    }
  };

  walk(root);
  return records;
}

/** Tally records by kind for the content-type filter and result header. */
export function summarizeCounts(records: SearchRecord[]): SearchCounts {
  const counts: SearchCounts = {
    all: records.length,
    page: 0,
    heading: 0,
    code: 0,
    folder: 0,
  };
  for (const r of records) counts[r.kind] += 1;
  return counts;
}

/** Score a single record against one lowercased term; 0 means "no match". */
function scoreTerm(record: SearchRecord, term: string): number {
  const fields: { text: string; weight: number }[] = [
    { text: record.title, weight: 6 },
    { text: record.path, weight: 2 },
    { text: record.snippet ?? "", weight: 2 },
    // Tags describe the whole document, so they only score the `page`
    // record — otherwise every heading/code child would outrank its own
    // page on a tag match. (Children still carry tags for the Tags filter.)
    {
      text: record.kind === "page" ? (record.tags ?? []).join(" ") : "",
      weight: 4,
    },
    { text: record.language ?? "", weight: 1 },
  ];

  let score = 0;
  for (const { text, weight } of fields) {
    const hay = text.toLowerCase();
    const idx = hay.indexOf(term);
    if (idx === -1) continue;
    // Earlier matches and whole-word starts rank higher.
    let hit = weight;
    if (idx === 0 || hay[idx - 1] === " ") hit += weight * 0.5;
    score += hit;
  }
  return score;
}

/**
 * Score a record against the full query. Every whitespace-separated term must
 * match at least one field (AND semantics) or the record is rejected (0).
 */
function scoreRecord(record: SearchRecord, terms: string[]): number {
  let total = 0;
  for (const term of terms) {
    const termScore = scoreTerm(record, term);
    if (termScore === 0) return 0;
    total += termScore;
  }

  // Kind preference: surface whole pages and folders above sub-results.
  const kindBonus: Record<SearchKind, number> = {
    page: 3,
    folder: 2,
    heading: 1,
    code: 0,
  };
  return total + kindBonus[record.kind];
}

/**
 * Filter and rank the index for a query within a scope. An empty query
 * returns `[]` — the UI shows its idle / feature state instead.
 *
 * Relevance sorting breaks ties by recency (newer first) then title, so
 * results are stable. Recent sorting prioritizes updated time first.
 */
export function searchRecords(
  records: SearchRecord[],
  query: string,
  scope: SearchScope = "all",
  sortBy: SearchSort = "relevance",
): SearchRecord[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scoped =
    scope === "all" ? records : records.filter((r) => r.kind === scope);

  const scored: { record: SearchRecord; score: number }[] = [];
  for (const record of scoped) {
    const score = scoreRecord(record, terms);
    if (score > 0) scored.push({ record, score });
  }

  scored.sort((a, b) => {
    if (sortBy === "recent") {
      if (b.record.updated !== a.record.updated)
        return b.record.updated - a.record.updated;
      if (b.score !== a.score) return b.score - a.score;
      return a.record.title.localeCompare(b.record.title);
    }

    if (b.score !== a.score) return b.score - a.score;
    if (b.record.updated !== a.record.updated)
      return b.record.updated - a.record.updated;
    return a.record.title.localeCompare(b.record.title);
  });

  return scored.map((s) => s.record);
}
