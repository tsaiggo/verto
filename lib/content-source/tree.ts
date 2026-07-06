// Source-agnostic content tree builder.
//
// Given a `ContentSource` (which only needs to enumerate readable files and
// read raw bytes), this module:
//
//  * reads & parses frontmatter for each file (gray-matter)
//  * derives title / description / order / hidden with sensible fallbacks
//  * recognises directory index files (`_index.md`, `index.md`, `README.md`)
//  * loads optional overrides from `navigation.json` at the source root
//  * sorts siblings consistently
//  * exposes the high-level read API used by the rest of the app:
//    `getContentTree`, `listAllFiles`, `getNodeBySlug`, `getFileBySlug`,
//    `getPrevNext`, `getAllReadableSlugs`, `walkTree`
//
// The source is supplied lazily (the consumer passes a factory) so this
// module has no opinion on which provider is active — that selection lives
// in `./index.ts`.
import { cache } from "react";
import matter from "gray-matter";
import type { ContentDirNode, ContentFileNode, ContentNode, ContentSource, NavigationOverrides, RawFileEntry } from "./types";
const READABLE_EXTS = [".mdx", ".md"];
const INDEX_BASES = new Set(["_index", "index", "readme"]);
const NAVIGATION_FILE = "navigation.json";
// ---------------------------------------------------------------------------
// Helpers (exported for tests where useful)
// ---------------------------------------------------------------------------
export function isReadable(name: string): boolean { return READABLE_EXTS.some((ext) => name.toLowerCase().endsWith(ext)); }
export function stripExt(name: string): { base: string; ext: string } {
  for (const ext of READABLE_EXTS) {
    if (name.toLowerCase().endsWith(ext)) return { base: name.slice(0, -ext.length), ext };
  }
  return { base: name, ext: "" };
}
export function isIndexFile(base: string): boolean { return INDEX_BASES.has(base.toLowerCase()); }
export function titleFromFilename(base: string): string {
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
/**
 * Best-effort title extraction from raw markdown — finds the first `# ` H1
 * outside fenced code blocks.
 */
export function firstH1(source: string): string | undefined {
  const lines = source.split("\n");
  let inCode = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const m = line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (m) return m[1].trim();
  }
  return undefined;
}
/**
 * Best-effort description extraction — finds the first non-empty paragraph
 * that isn't a heading or fenced code, truncated.
 */
export function firstParagraph(source: string, max = 200): string | undefined {
  const lines = source.split("\n");
  let inCode = false;
  const buf: string[] = [];
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (inCode && buf.length > 0) break;
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const trimmed = line.trim();
    if (trimmed === "") {
      if (buf.length > 0) break;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      if (buf.length > 0) break;
      continue;
    }
    buf.push(trimmed);
  }
  if (buf.length === 0) return undefined;
  let text = buf
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  if (text.length > max) text = text.slice(0, max - 1).trimEnd() + "…";
  return text;
}
/**
 * Splits frontmatter `description` into the two values the reader needs:
 * `description` (used for meta/SEO, falls back to the first body paragraph)
 * and `dek` (the on-page subtitle, frontmatter-only so it never echoes the
 * opening body text).
 */
export function deriveDescription(
  fm: Record<string, unknown>,
  body: string
): { description?: string; dek?: string } {
  const fmDescription =
    typeof fm.description === "string" && fm.description.trim() ? fm.description.trim() : undefined;
  return { description: fmDescription || firstParagraph(body), dek: fmDescription };
}
function parseToc(fmToc: unknown): ContentFileNode["toc"] {
  if (fmToc === false) return false;
  if (fmToc && typeof fmToc === "object" && !Array.isArray(fmToc)) {
    const t = fmToc as Record<string, unknown>;
    return {
      minDepth: typeof t.minDepth === "number" ? t.minDepth : undefined,
      maxDepth: typeof t.maxDepth === "number" ? t.maxDepth : undefined,
    };
  }
  return undefined;
}
export function coerceFrontmatter(fm: Record<string, unknown>, isProd: boolean) {
  const t = Array.isArray(fm.tags) ? fm.tags.filter((t): t is string => typeof t === "string") : undefined;
  const s = typeof fm.status === "string" && fm.status.trim() ? fm.status.trim() : undefined;
  return {
    date: typeof fm.date === "string" ? fm.date : undefined,
    author: typeof fm.author === "string" ? fm.author : undefined,
    tags: t, status: s,
    order: typeof fm.order === "number" ? fm.order : undefined,
    cover: typeof fm.cover === "string" ? fm.cover : undefined,
    draft: fm.draft === true ? true : undefined,
    updated: typeof fm.updated === "string" ? fm.updated : undefined,
    lang: typeof fm.lang === "string" ? fm.lang : undefined,
    toc: parseToc(fm.toc),
    hidden: fm.hidden === true || (fm.draft === true && isProd) ? true : undefined
  };
}
export function compareNodes(a: ContentNode, b: ContentNode): number {
  // 1. explicit `order` wins (lower first)
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  // 2. dirs first so groups lead navigation
  if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
  // 3. for files with dates, newer first (blog-style)
  if (a.type === "file" && b.type === "file") {
    const ad = a.date ? Date.parse(a.date) : NaN;
    const bd = b.date ? Date.parse(b.date) : NaN;
    if (!Number.isNaN(ad) && !Number.isNaN(bd) && ad !== bd) return bd - ad;
  }
  // 4. fall back to title
  return a.title.localeCompare(b.title);
}
function applyOverride(node: ContentNode, overrides: NavigationOverrides): ContentNode {
  const key = node.slug.join("/");
  const override = overrides.overrides?.[key];
  if (!override) return node;
  return {
    ...node,
    title: override.title ?? node.title,
    order: override.order ?? node.order,
    hidden: override.hidden ?? node.hidden,
  };
}
// ---------------------------------------------------------------------------
// File → ContentFileNode
// ---------------------------------------------------------------------------
async function buildFileNode(
  source: ContentSource,
  entry: RawFileEntry,
  slug: string[],
  basePath: string
): Promise<ContentFileNode> {
  const raw = await source.readFile(entry);
  const parsed = matter(raw);
  // Body has frontmatter stripped — safe to scan for H1 / first paragraph
  // without confusing the YAML `---` delimiters with horizontal rules.
  const body = parsed.content;
  const fm = parsed.data as Record<string, unknown>;
  const fileName = entry.path[entry.path.length - 1] ?? "";
  const { base: baseName, ext } = stripExt(fileName);
  const title =
    (typeof fm.title === "string" && fm.title.trim()) ||
    firstH1(body) ||
    titleFromFilename(baseName);
  const { description, dek } = deriveDescription(fm, body);
  const isProd = process.env.NODE_ENV === "production";
  const { date, author, tags, status, order, cover, draft, updated, lang, toc, hidden } = coerceFrontmatter(fm, isProd);
  return {
    type: "file",
    slug,
    href: basePath + "/" + slug.join("/"),
    title,
    description,
    dek,
    date,
    author,
    tags,
    status,
    order,
    hidden,
    mtime: entry.mtime ?? 0,
    id: entry.id,
    ext,
    cover,
    draft,
    updated,
    lang,
    toc,
    sha: entry.sha,
    size: entry.size,
    etag: entry.etag,
  };
}
// ---------------------------------------------------------------------------
// Tree assembly
// ---------------------------------------------------------------------------
/**
 * Internal mutable scaffold while we group files by directory before we
 * resolve overrides and sort.
 */
export interface DirScaffold {
  slug: string[];
  /** Files that live directly in this directory (path[parent + 1] === file). */
  files: RawFileEntry[];
  /** Sub-directories keyed by their last slug segment. */
  subs: Map<string, DirScaffold>;
}
export function makeScaffold(slug: string[]): DirScaffold {
  return { slug, files: [], subs: new Map() };
}
export function ingest(root: DirScaffold, entry: RawFileEntry): void {
  if (entry.path.length === 0) return;
  let cursor = root;
  for (let i = 0; i < entry.path.length - 1; i++) {
    const seg = entry.path[i];
    let next = cursor.subs.get(seg);
    if (!next) {
      next = makeScaffold([...cursor.slug, seg]);
      cursor.subs.set(seg, next);
    }
    cursor = next;
  }
  cursor.files.push(entry);
}
export function resolveDirOverride(
  scaffold: DirScaffold,
  overrides: NavigationOverrides,
  index: ContentFileNode | undefined,
  basePath: string,
  children: ContentNode[]
): ContentDirNode {
  const slugKey = scaffold.slug.join("/");
  const overrideEntry = overrides.overrides?.[slugKey];
  const overrideTitle = overrideEntry?.title;
  const overrideOrder = overrideEntry?.order;
  const overrideHidden = overrideEntry?.hidden;
  const titleFromIndex = index?.title;
  const dirName = scaffold.slug[scaffold.slug.length - 1] ?? "";
  const title = overrideTitle ?? titleFromIndex ?? (dirName ? titleFromFilename(dirName) : "Home");
  const href = index ? index.href : basePath + "/" + scaffold.slug.join("/");
  return {
    type: "dir",
    slug: scaffold.slug,
    href,
    title,
    order: overrideOrder ?? index?.order,
    hidden: overrideHidden ?? index?.hidden,
    index,
    children,
  };
}
async function materialize(
  source: ContentSource,
  scaffold: DirScaffold,
  overrides: NavigationOverrides,
  basePath: string
): Promise<ContentDirNode> {
  const children: ContentNode[] = [];
  let index: ContentFileNode | undefined;
  // Files in this directory
  for (const entry of scaffold.files) {
    const fileName = entry.path[entry.path.length - 1];
    const { base } = stripExt(fileName);
    if (isIndexFile(base) && scaffold.slug.length > 0) {
      // Index file represents the directory itself
      index = await buildFileNode(source, entry, scaffold.slug, basePath);
      continue;
    }
    const childSlug = [...scaffold.slug, base];
    const file = await buildFileNode(source, entry, childSlug, basePath);
    children.push(applyOverride(file, overrides) as ContentFileNode);
  }
  // Sub-directories
  for (const sub of scaffold.subs.values()) {
    const dirNode = await materialize(source, sub, overrides, basePath);
    // Skip dirs that contain no readable content anywhere inside
    if (dirNode.children.length === 0 && !dirNode.index) continue;
    children.push(applyOverride(dirNode, overrides) as ContentDirNode);
  }
  children.sort(compareNodes);
  return resolveDirOverride(scaffold, overrides, index, basePath, children);
}
async function loadOverrides(source: ContentSource): Promise<NavigationOverrides> {
  if (!source.readOptionalFile) return {};
  try {
    const raw = await source.readOptionalFile([NAVIGATION_FILE]);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "overrides" in parsed) {
      return parsed as NavigationOverrides;
    }
    return {};
  } catch {
    return {};
  }
}
// ---------------------------------------------------------------------------
// Public API — assembled around a single ContentSource factory
// ---------------------------------------------------------------------------
/**
 * Build the public read API around a `ContentSource` factory. The factory is
 * invoked lazily and only once per process (memoised by `cache()`) — pass a
 * thunk so that environment lookup happens at first use rather than at
 * module-eval time.
 */
export function createTreeAPI(getSource: () => ContentSource, options: { basePath?: string } = {}) {
  // URL prefix every href is built under. Defaults to `/read` (the user
  // Library). A second instance (see `lib/help-source.ts`) passes `/help`
  // so bundled docs render under their own route namespace.
  const basePath = options.basePath ?? "/read";
  const getActiveSource = cache((): ContentSource => getSource());
  const getContentTree = cache(async (): Promise<ContentDirNode> => {
    const source = getActiveSource();
    const [files, overrides] = await Promise.all([source.listFiles(), loadOverrides(source)]);
    // Filter readable files only — sources are expected to do this already
    // but we double-check so a misbehaving source can't poison the tree.
    const readable = files.filter((f) => {
      const name = f.path[f.path.length - 1] ?? "";
      return isReadable(name);
    });
    const root = makeScaffold([]);
    for (const entry of readable) ingest(root, entry);
    const tree = await materialize(source, root, overrides, basePath);
    return applyOverride(tree, overrides) as ContentDirNode;
  });
  const listAllFiles = cache(async (): Promise<ContentFileNode[]> => {
    const root = await getContentTree();
    const out: ContentFileNode[] = [];
    const seen = new Set<string>();
    function walk(node: ContentNode) {
      if (node.hidden) return;
      if (node.type === "file") {
        const key = node.slug.join("/");
        if (!seen.has(key)) {
          seen.add(key);
          out.push(node);
        }
        return;
      }
      if (node.index) {
        const key = node.index.slug.join("/");
        if (!seen.has(key)) {
          seen.add(key);
          out.push(node.index);
        }
      }
      for (const child of node.children) walk(child);
    }
    walk(root);
    return out;
  });
  const getNodeBySlug = cache(async (slug: string[]): Promise<ContentNode | null> => {
    const root = await getContentTree();
    if (slug.length === 0) return root;
    let cursor: ContentDirNode = root;
    for (let i = 0; i < slug.length; i++) {
      const seg = slug[i];
      const isLast = i === slug.length - 1;
      const child = cursor.children.find((c) => {
        const last = c.slug[c.slug.length - 1];
        return last === seg;
      });
      if (child) {
        if (isLast) return child;
        if (child.type === "dir") {
          cursor = child;
          continue;
        }
        return null;
      }
      if (isLast && cursor.index) {
        const idxLast = cursor.index.slug[cursor.index.slug.length - 1];
        if (idxLast === seg) return cursor.index;
      }
      return null;
    }
    return cursor;
  });
  async function getFileBySlug(slug: string[]): Promise<ContentFileNode | null> {
    const node = await getNodeBySlug(slug);
    if (!node) return null;
    if (node.type === "file") return node;
    if (node.index) return node.index;
    return null;
  }
  async function getPrevNext(
    slug: string[]
  ): Promise<[ContentFileNode | null, ContentFileNode | null]> {
    const files = await listAllFiles();
    const key = slug.join("/");
    const idx = files.findIndex((f) => f.slug.join("/") === key);
    if (idx === -1) return [null, null];
    return [idx > 0 ? files[idx - 1] : null, idx < files.length - 1 ? files[idx + 1] : null];
  }
  async function getAllReadableSlugs(): Promise<string[][]> {
    const root = await getContentTree();
    const out: string[][] = [];
    const seen = new Set<string>();
    function walk(node: ContentNode) {
      if (node.hidden) return;
      const key = node.slug.join("/");
      if (node.slug.length > 0 && !seen.has(key)) {
        seen.add(key);
        out.push(node.slug);
      }
      if (node.type === "dir") {
        if (node.index) {
          const ikey = node.index.slug.join("/");
          if (!seen.has(ikey)) {
            seen.add(ikey);
            out.push(node.index.slug);
          }
        }
        for (const child of node.children) walk(child);
      }
    }
    walk(root);
    return out;
  }
  /** Read the raw text of a file node via the active source. */
  async function readFileNodeSource(node: ContentFileNode): Promise<string> {
    // We deliberately do not pass `node.slug` as `path` — slug segments
    // strip the file extension and aren't a faithful reconstruction of
    // the source-relative path. Sources should rely on `node.id`.
    return getActiveSource().readFile({ id: node.id });
  }
  return {
    getActiveSource,
    getContentTree,
    listAllFiles,
    getNodeBySlug,
    getFileBySlug,
    getPrevNext,
    getAllReadableSlugs,
    readFileNodeSource,
  };
}
/**
 * Visit every node in the tree in depth-first, sorted order. Hidden nodes
 * (and their descendants) are skipped.
 */
export function walkTree(node: ContentNode, visit: (n: ContentNode) => void): void {
  if (node.hidden) return;
  visit(node);
  if (node.type === "dir") {
    if (node.index) visit(node.index);
    for (const child of node.children) walkTree(child, visit);
  }
}
