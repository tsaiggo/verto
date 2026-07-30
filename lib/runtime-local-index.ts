import matter from "gray-matter";
import type { ContentFileNode, RawFileEntry } from "@/lib/content-source";
import { coerceFrontmatter } from "@/lib/content-source/frontmatter";
import { deriveDescription, firstH1, titleFromFilename } from "@/lib/content-source/metadata";
import {
  buildFileRecords,
  summarizeCounts,
  type SearchCounts,
  type SearchRecord,
} from "@/lib/search";
import { readRuntimeLocalFile, listRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import type { VaultWatchBatch, VaultWatchEntry } from "@/lib/tauri";

export type RuntimeLibraryKind = "note" | "draft" | "image" | "archive" | "doc";

export interface RuntimeLibraryDoc {
  title: string;
  ext: string;
  href: string;
  section: string;
  tags: string[];
  updatedLabel: string;
  updatedISO: string;
  kind: RuntimeLibraryKind;
}

export interface RuntimeLocalIndexedDocument {
  entry: RawFileEntry;
  node: ContentFileNode;
  raw: string;
  libraryDoc: RuntimeLibraryDoc;
}

export interface RuntimeTagCount {
  name: string;
  count: number;
}

export interface RuntimeLocalIndex {
  folder: string;
  /** Internal parsed-body cache, including hidden documents, for cheap rescans. */
  cacheDocuments?: RuntimeLocalIndexedDocument[];
  documents: RuntimeLocalIndexedDocument[];
  libraryDocs: RuntimeLibraryDoc[];
  searchRecords: SearchRecord[];
  counts: SearchCounts;
  tags: string[];
  tagCounts: RuntimeTagCount[];
}

const RUNTIME_SOURCE = { kind: "local" as const, name: "Local Library" };
const READABLE_EXTS = [".mdx", ".md"] as const;
export const RUNTIME_INDEX_READ_CONCURRENCY = 8;

export async function buildRuntimeLocalIndex(
  folder: string,
  previous?: RuntimeLocalIndex | null
): Promise<RuntimeLocalIndex> {
  const entries = await listRuntimeLocalFolder(folder);
  const previousById = new Map(
    (previous?.cacheDocuments ?? previous?.documents ?? []).map((document) => [
      document.entry.id,
      document,
    ])
  );
  const documents = await mapWithConcurrency(
    entries,
    RUNTIME_INDEX_READ_CONCURRENCY,
    async (entry) => {
      const existing = previousById.get(entry.id);
      if (existing && entriesHaveSameContent(entry, existing.entry)) {
        return entryMetadataEqual(entry, existing.entry)
          ? existing
          : documentFromRaw(entry, existing.raw);
      }
      return readRuntimeLocalDocument(entry);
    }
  );
  return indexRuntimeDocuments(folder, documents);
}

/**
 * Apply one accepted native watcher batch. A metadata rescan relists the Vault
 * but reuses bodies whose size/mtime (or SHA) did not change. Targeted batches
 * read only changed documents, with a fixed concurrency ceiling.
 */
export async function applyRuntimeLocalIndexBatch(
  index: RuntimeLocalIndex,
  batch: VaultWatchBatch
): Promise<RuntimeLocalIndex> {
  if (batch.root !== index.folder) return index;
  if (batch.rescan) return buildRuntimeLocalIndex(index.folder, index);

  const documents = new Map(
    (index.cacheDocuments ?? index.documents).map((document) => [document.entry.id, document])
  );
  const pending = new Map<string, VaultWatchEntry>();

  // Apply identity transitions before content upserts. Native backends may
  // report `old.md -> new.md` and a newly-created `old.md` in the same
  // debounce window. Processing the recreated file first would let the rename
  // delete its pending read and leave the new pathname missing indefinitely.
  applyIdentityTransitions(documents, pending, batch.changes);
  applyContentUpserts(documents, pending, batch.changes);

  const attempts = await mapWithConcurrency(
    [...pending.values()],
    RUNTIME_INDEX_READ_CONCURRENCY,
    async (entry) => {
      try {
        return { document: await readRuntimeLocalDocument(entry), failed: false as const };
      } catch {
        return { entry, failed: true as const };
      }
    }
  );
  let readFailed = false;
  for (const attempt of attempts) {
    if (attempt.failed) {
      readFailed = true;
    } else {
      documents.set(attempt.document.entry.id, attempt.document);
    }
  }
  if (readFailed) {
    // Carry removals, safe renames, and successful reads into the recovery
    // listing. SHA-bearing entries let the full build reuse those confirmed
    // bodies while authoritatively resolving every failed or ambiguous path.
    const confirmed = indexRuntimeDocuments(index.folder, [...documents.values()]);
    return buildRuntimeLocalIndex(index.folder, confirmed);
  }
  return indexRuntimeDocuments(index.folder, [...documents.values()]);
}

function applyIdentityTransitions(
  documents: Map<string, RuntimeLocalIndexedDocument>,
  pending: Map<string, VaultWatchEntry>,
  changes: VaultWatchBatch["changes"]
): void {
  for (const change of changes) {
    if (change.kind === "remove") {
      documents.delete(change.id);
      pending.delete(change.id);
      continue;
    }
    if (change.kind === "rename") {
      const previous = documents.get(change.fromId);
      documents.delete(change.fromId);
      pending.delete(change.fromId);
      if (previous && previous.entry.sha === change.entry.sha) {
        documents.set(change.entry.id, documentFromRaw(change.entry, previous.raw));
      } else {
        pending.set(change.entry.id, change.entry);
      }
    }
  }
}

function applyContentUpserts(
  documents: Map<string, RuntimeLocalIndexedDocument>,
  pending: Map<string, VaultWatchEntry>,
  changes: VaultWatchBatch["changes"]
): void {
  for (const change of changes) {
    if (change.kind !== "upsert") continue;
    const previous = documents.get(change.entry.id);
    if (previous && entriesHaveSameContent(change.entry, previous.entry)) {
      documents.set(
        change.entry.id,
        entryMetadataEqual(change.entry, previous.entry)
          ? previous
          : documentFromRaw(change.entry, previous.raw)
      );
    } else {
      pending.set(change.entry.id, change.entry);
    }
  }
}

function indexRuntimeDocuments(
  folder: string,
  documents: RuntimeLocalIndexedDocument[]
): RuntimeLocalIndex {
  const visible = documents.filter((doc) => !doc.node.hidden);
  const searchable = visible.filter((doc) => !doc.node.draft);
  const searchRecords = searchable.flatMap((doc) =>
    buildFileRecords(doc.node, doc.raw, RUNTIME_SOURCE)
  );
  searchRecords.push(...buildRuntimeFolderRecords(searchable.map((doc) => doc.entry)));

  const tagCounts = countTags(searchable.map((doc) => doc.node.tags ?? []));
  return {
    folder,
    cacheDocuments: documents,
    documents: visible,
    libraryDocs: visible.map((doc) => doc.libraryDoc).sort(sortLibraryDocs),
    searchRecords,
    counts: summarizeCounts(searchRecords),
    tags: tagCounts.map((tag) => tag.name),
    tagCounts,
  };
}

export function runtimeEntryToLibraryDoc(entry: RawFileEntry, raw = ""): RuntimeLibraryDoc {
  const node = runtimeEntryToContentFileNode(entry, raw);
  const ts = timestamp(node);
  const section = node.slug.length > 1 ? titleFromFilename(node.slug[0] ?? "") : "Local Library";
  return {
    title: node.title,
    ext: node.ext,
    href: node.href,
    section,
    tags: node.tags ?? [],
    updatedLabel: relativeTime(ts),
    updatedISO: new Date(ts).toISOString(),
    kind: kindOf(node),
  };
}

export function runtimeEntryToContentFileNode(entry: RawFileEntry, raw = ""): ContentFileNode {
  const fileName = entry.path.at(-1) ?? entry.id.split(/[\\/]/).pop() ?? entry.id;
  const { base, ext } = stripReadableExt(fileName);
  const slug = [...entry.path.slice(0, -1), base];
  const parsed = safeMatter(raw);
  const body = parsed.content;
  const fm = parsed.data;
  const title = frontmatterString(fm.title) || firstH1(body) || titleFromFilename(base);
  const { description, dek } = deriveDescription(fm, body, "...");
  const meta = coerceFrontmatter(fm, process.env.NODE_ENV === "production");

  return {
    type: "file",
    slug,
    href: runtimeLocalHref(entry, title, ext),
    title,
    description,
    dek,
    date: meta.date,
    author: meta.author,
    tags: meta.tags,
    status: meta.status,
    order: meta.order,
    hidden: meta.hidden,
    mtime: entry.mtime ?? 0,
    id: entry.id,
    ext,
    cover: meta.cover,
    draft: meta.draft,
    updated: meta.updated,
    lang: meta.lang,
    toc: meta.toc,
    sha: entry.sha,
    size: entry.size,
    etag: entry.etag,
  };
}

async function readRuntimeLocalDocument(entry: RawFileEntry): Promise<RuntimeLocalIndexedDocument> {
  const raw = await readRuntimeLocalFile(entry.id);
  return documentFromRaw(entry, raw);
}

function documentFromRaw(entry: RawFileEntry, raw: string): RuntimeLocalIndexedDocument {
  const node = runtimeEntryToContentFileNode(entry, raw);
  return { entry, node, raw, libraryDoc: runtimeEntryToLibraryDoc(entry, raw) };
}

function entriesHaveSameContent(a: RawFileEntry, b: RawFileEntry): boolean {
  if (a.sha && b.sha) return a.sha === b.sha;
  return (
    a.size !== undefined &&
    a.mtime !== undefined &&
    b.size !== undefined &&
    b.mtime !== undefined &&
    a.size === b.size &&
    a.mtime === b.mtime
  );
}

function entryMetadataEqual(a: RawFileEntry, b: RawFileEntry): boolean {
  return (
    a.id === b.id &&
    a.sha === b.sha &&
    a.size === b.size &&
    a.mtime === b.mtime &&
    a.etag === b.etag &&
    a.path.length === b.path.length &&
    a.path.every((segment, index) => segment === b.path[index])
  );
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await mapper(values[index]!);
    }
  });
  await Promise.all(workers);
  return output;
}

function buildRuntimeFolderRecords(entries: RawFileEntry[]): SearchRecord[] {
  const folders = new Map<string, { title: string; path: string; count: number }>();
  for (const entry of entries) {
    const segments = entry.path.slice(0, -1);
    for (let i = 0; i < segments.length; i += 1) {
      const folderPath = segments.slice(0, i + 1);
      const key = folderPath.join("/");
      const existing = folders.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        folders.set(key, {
          title: titleFromFilename(folderPath.at(-1) ?? key),
          path: folderPath.join(" / "),
          count: 1,
        });
      }
    }
  }

  return Array.from(folders.entries()).map(([key, folder]) => ({
    id: `runtime-folder:${key}`,
    kind: "folder" as const,
    title: folder.title,
    snippet: `${folder.count} ${folder.count === 1 ? "file" : "files"}`,
    href: "/library",
    path: folder.path,
    updated: 0,
    sourceKind: RUNTIME_SOURCE.kind,
    sourceName: RUNTIME_SOURCE.name,
  }));
}

function countTags(tagLists: readonly string[][]): RuntimeTagCount[] {
  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function runtimeLocalHref(entry: RawFileEntry, title: string, ext: string): string {
  const params = new URLSearchParams({ file: entry.id, title, ext });
  return `/runtime/local?${params.toString()}`;
}

function stripReadableExt(name: string): { base: string; ext: string } {
  for (const ext of READABLE_EXTS) {
    if (name.toLowerCase().endsWith(ext)) return { base: name.slice(0, -ext.length), ext };
  }
  return { base: name, ext: "" };
}

function safeMatter(raw: string): { data: Record<string, unknown>; content: string } {
  try {
    const parsed = matter(raw);
    return { data: parsed.data as Record<string, unknown>, content: parsed.content };
  } catch {
    return { data: {}, content: raw };
  }
}

function frontmatterString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function timestamp(file: ContentFileNode): number {
  const explicit = file.updated ?? file.date;
  const parsed = explicit ? Date.parse(explicit) : Number.NaN;
  return Number.isNaN(parsed) ? file.mtime || Date.now() : parsed;
}

function kindOf(file: ContentFileNode): RuntimeLibraryKind {
  const status = (file.status ?? "").toLowerCase();
  const tags = (file.tags ?? []).map((tag) => tag.toLowerCase());
  if (file.draft) return "draft";
  if (status === "archived" || tags.includes("archived")) return "archive";
  if (file.cover) return "image";
  if (file.ext === ".md") return "note";
  return "doc";
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sortLibraryDocs(a: RuntimeLibraryDoc, b: RuntimeLibraryDoc): number {
  return Date.parse(b.updatedISO) - Date.parse(a.updatedISO) || a.title.localeCompare(b.title);
}
