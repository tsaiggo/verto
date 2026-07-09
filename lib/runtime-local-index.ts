import matter from "gray-matter";
import type { ContentFileNode, RawFileEntry } from "@/lib/content-source";
import { coerceFrontmatter } from "@/lib/content-source/frontmatter";
import {
  buildFileRecords,
  summarizeCounts,
  type SearchCounts,
  type SearchRecord,
} from "@/lib/search";
import { readRuntimeLocalFile, listRuntimeLocalFolder } from "@/lib/runtime-local-folder";

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
  documents: RuntimeLocalIndexedDocument[];
  libraryDocs: RuntimeLibraryDoc[];
  searchRecords: SearchRecord[];
  counts: SearchCounts;
  tags: string[];
  tagCounts: RuntimeTagCount[];
}

const RUNTIME_SOURCE = { kind: "local" as const, name: "Local Library" };
const READABLE_EXTS = [".mdx", ".md"] as const;

export async function buildRuntimeLocalIndex(folder: string): Promise<RuntimeLocalIndex> {
  const entries = await listRuntimeLocalFolder(folder);
  const documents = await Promise.all(entries.map(readRuntimeLocalDocument));
  const visible = documents.filter((doc) => !doc.node.hidden);
  const searchable = visible.filter((doc) => !doc.node.draft);
  const searchRecords = searchable.flatMap((doc) =>
    buildFileRecords(doc.node, doc.raw, RUNTIME_SOURCE)
  );
  searchRecords.push(...buildRuntimeFolderRecords(searchable.map((doc) => doc.entry)));

  const tagCounts = countTags(searchable.map((doc) => doc.node.tags ?? []));
  return {
    folder,
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
  const { description, dek } = deriveDescription(fm, body);
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
  const node = runtimeEntryToContentFileNode(entry, raw);
  return { entry, node, raw, libraryDoc: runtimeEntryToLibraryDoc(entry, raw) };
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

function titleFromFilename(base: string): string {
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstH1(source: string): string | undefined {
  const lines = source.split("\n");
  let inCode = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (match) return match[1]?.trim();
  }
  return undefined;
}

function firstParagraph(source: string, max = 200): string | undefined {
  const lines = source.split("\n");
  let inCode = false;
  const buffer: string[] = [];
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (inCode && buffer.length > 0) break;
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const trimmed = line.trim();
    if (trimmed === "") {
      if (buffer.length > 0) break;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      if (buffer.length > 0) break;
      continue;
    }
    buffer.push(trimmed);
  }
  if (buffer.length === 0) return undefined;
  let text = buffer
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  if (text.length > max) text = text.slice(0, max - 1).trimEnd() + "...";
  return text;
}

function deriveDescription(
  fm: Record<string, unknown>,
  body: string
): { description?: string; dek?: string } {
  const fmDescription = frontmatterString(fm.description);
  return { description: fmDescription || firstParagraph(body), dek: fmDescription };
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
