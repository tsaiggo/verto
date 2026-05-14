import fs from "fs/promises";
import path from "path";
import { cache } from "react";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");
const READABLE_EXTS = [".mdx", ".md"];

/**
 * A node in the content tree.
 *
 *  - `file`: a single readable document (`.md` / `.mdx`).
 *  - `dir`:  a directory that may contain children + an optional index file
 *            (`_index.md(x)` or `index.md(x)` or `README.md(x)`).
 */
export interface ContentFileNode {
  type: "file";
  /** URL slug segments (e.g. ["features", "blog"]) */
  slug: string[];
  /** Public URL (always under `/read`) */
  href: string;
  /** Display title (frontmatter → first H1 → filename) */
  title: string;
  /** Plain-text description for previews (frontmatter → first paragraph) */
  description?: string;
  /** Date string from frontmatter, when present */
  date?: string;
  /** Tag list from frontmatter, when present */
  tags?: string[];
  /** Author from frontmatter, when present */
  author?: string;
  /** Numeric sort hint from frontmatter (lower = earlier) */
  order?: number;
  /** Whether this node is hidden in navigation (overrides) */
  hidden?: boolean;
  /** File modification time (ms since epoch) */
  mtime: number;
  /** Absolute path on disk (server-side only) */
  filePath: string;
  /** File extension including dot (`.md` or `.mdx`) */
  ext: string;
}

export interface ContentDirNode {
  type: "dir";
  /** URL slug segments leading to this dir */
  slug: string[];
  /** Public URL — points at the index page if any, else `/read/<slug>` */
  href: string;
  /** Display title (override → frontmatter of index → directory name) */
  title: string;
  /** Numeric sort hint */
  order?: number;
  hidden?: boolean;
  /** Optional index document for this directory */
  index?: ContentFileNode;
  /** Sorted children */
  children: ContentNode[];
}

export type ContentNode = ContentFileNode | ContentDirNode;

// ---------------------------------------------------------------------------
// Optional navigation overrides (`content/navigation.json`)
// ---------------------------------------------------------------------------

/**
 * Optional config to override the file-system derived tree.
 *
 * Keys are slash-separated slug paths relative to `content/`, **without**
 * the file extension. Example:
 *
 * ```json
 * {
 *   "overrides": {
 *     "getting-started":            { "title": "Start Here", "order": 1 },
 *     "features/inline-comments":   { "title": "Annotations", "order": 5 },
 *     "drafts":                     { "hidden": true }
 *   }
 * }
 * ```
 */
export interface NavigationOverrides {
  overrides?: Record<
    string,
    {
      title?: string;
      order?: number;
      hidden?: boolean;
    }
  >;
}

const loadOverrides = cache(async (): Promise<NavigationOverrides> => {
  try {
    const raw = await fs.readFile(
      path.join(CONTENT_DIR, "navigation.json"),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "overrides" in parsed) {
      return parsed as NavigationOverrides;
    }
    return {};
  } catch {
    return {};
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isReadable(name: string): boolean {
  return READABLE_EXTS.some((ext) => name.toLowerCase().endsWith(ext));
}

function stripExt(name: string): { base: string; ext: string } {
  for (const ext of READABLE_EXTS) {
    if (name.toLowerCase().endsWith(ext)) {
      return { base: name.slice(0, -ext.length), ext };
    }
  }
  return { base: name, ext: "" };
}

const INDEX_BASES = new Set(["_index", "index", "readme"]);

function isIndexFile(base: string): boolean {
  return INDEX_BASES.has(base.toLowerCase());
}

function titleFromFilename(base: string): string {
  // Convert kebab/snake_case to Title Case
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
function firstH1(source: string): string | undefined {
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
function firstParagraph(source: string, max = 200): string | undefined {
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
    // Skip list items / blockquote markers / frontmatter delimiters
    if (trimmed.startsWith("---")) continue;
    buf.push(trimmed);
  }
  if (buf.length === 0) return undefined;
  let text = buf
    .join(" ")
    // Strip simple inline markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  if (text.length > max) text = text.slice(0, max - 1).trimEnd() + "…";
  return text;
}

function compareNodes(a: ContentNode, b: ContentNode): number {
  // 1. explicit `order` wins (lower first)
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;

  // 2. dirs after files at the same level so the index reads naturally?
  //    Actually, prefer dirs first so groups come before loose pages — matches
  //    the previous Sidebar layout where groups led navigation.
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

function applyOverride(
  node: ContentNode,
  overrides: NavigationOverrides,
): ContentNode {
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
// Tree builder
// ---------------------------------------------------------------------------

async function readFileNode(
  filePath: string,
  slug: string[],
): Promise<ContentFileNode> {
  const raw = await fs.readFile(filePath, "utf-8");
  const stat = await fs.stat(filePath);
  const { data } = matter(raw);
  const fm = data as Record<string, unknown>;

  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, ext);

  const title =
    (typeof fm.title === "string" && fm.title.trim()) ||
    firstH1(raw) ||
    titleFromFilename(baseName);

  const description =
    (typeof fm.description === "string" && fm.description.trim()) ||
    firstParagraph(raw);

  const date = typeof fm.date === "string" ? fm.date : undefined;
  const author = typeof fm.author === "string" ? fm.author : undefined;
  const tags = Array.isArray(fm.tags)
    ? fm.tags.filter((t): t is string => typeof t === "string")
    : undefined;
  const order = typeof fm.order === "number" ? fm.order : undefined;
  const hidden = fm.hidden === true ? true : undefined;

  return {
    type: "file",
    slug,
    href: "/read/" + slug.join("/"),
    title,
    description,
    date,
    author,
    tags,
    order,
    hidden,
    mtime: stat.mtimeMs,
    filePath,
    ext,
  };
}

async function buildDir(
  absDir: string,
  slug: string[],
  overrides: NavigationOverrides,
): Promise<ContentDirNode> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const children: ContentNode[] = [];
  let index: ContentFileNode | undefined;

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const abs = path.join(absDir, entry.name);

    if (entry.isDirectory()) {
      const childSlug = [...slug, entry.name];
      const dirNode = await buildDir(abs, childSlug, overrides);
      // Skip empty dirs entirely (no readable content anywhere inside)
      if (dirNode.children.length === 0 && !dirNode.index) continue;
      children.push(applyOverride(dirNode, overrides) as ContentDirNode);
      continue;
    }

    if (!entry.isFile() || !isReadable(entry.name)) continue;

    const { base } = stripExt(entry.name);

    if (isIndexFile(base) && slug.length > 0) {
      // Index file represents the directory itself
      index = await readFileNode(abs, slug);
      continue;
    }

    const childSlug = [...slug, base];
    const file = await readFileNode(abs, childSlug);
    children.push(applyOverride(file, overrides) as ContentFileNode);
  }

  children.sort(compareNodes);

  // Title: override → index frontmatter → directory name
  const overrideTitle = overrides.overrides?.[slug.join("/")]?.title;
  const titleFromIndex = index?.title;
  const dirName = slug[slug.length - 1] ?? "";
  const title =
    overrideTitle ??
    titleFromIndex ??
    (dirName ? titleFromFilename(dirName) : "Home");

  // Order/hidden: override → index frontmatter
  const overrideOrder = overrides.overrides?.[slug.join("/")]?.order;
  const overrideHidden = overrides.overrides?.[slug.join("/")]?.hidden;

  const href = index ? index.href : "/read/" + slug.join("/");

  return {
    type: "dir",
    slug,
    href,
    title,
    order: overrideOrder ?? index?.order,
    hidden: overrideHidden ?? index?.hidden,
    index,
    children,
  };
}

/**
 * Build the full content tree rooted at `content/`.
 */
export const getContentTree = cache(async (): Promise<ContentDirNode> => {
  const overrides = await loadOverrides();
  const root = await buildDir(CONTENT_DIR, [], overrides);
  return applyOverride(root, overrides) as ContentDirNode;
});

/**
 * Visit every node in the tree in depth-first, sorted order.
 * Hidden nodes (and their descendants) are skipped.
 */
export function walkTree(
  node: ContentNode,
  visit: (n: ContentNode) => void,
): void {
  if (node.hidden) return;
  visit(node);
  if (node.type === "dir") {
    if (node.index) visit(node.index);
    for (const child of node.children) walkTree(child, visit);
  }
}

/**
 * Flat list of all visible file nodes in reading order. Includes directory
 * index files at the position of their directory (so prev/next works as
 * expected).
 */
export const listAllFiles = cache(async (): Promise<ContentFileNode[]> => {
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

/**
 * Resolve a slug (URL path segments) to a node. Empty slug returns the root
 * directory. Returns `null` if nothing matches.
 */
export const getNodeBySlug = cache(
  async (slug: string[]): Promise<ContentNode | null> => {
    const root = await getContentTree();
    if (slug.length === 0) return root;

    let cursor: ContentDirNode = root;
    for (let i = 0; i < slug.length; i++) {
      const seg = slug[i];
      const isLast = i === slug.length - 1;

      // Look in current children
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

      // No matching child — last-segment match against directory index?
      if (isLast && cursor.index) {
        const idxLast = cursor.index.slug[cursor.index.slug.length - 1];
        if (idxLast === seg) return cursor.index;
      }
      return null;
    }
    return cursor;
  },
);

/**
 * Resolve a slug to a file node, descending into directory indexes if
 * needed. Returns `null` if no file is reachable.
 */
export async function getFileBySlug(
  slug: string[],
): Promise<ContentFileNode | null> {
  const node = await getNodeBySlug(slug);
  if (!node) return null;
  if (node.type === "file") return node;
  if (node.index) return node.index;
  return null;
}

/**
 * Return `[prev, next]` siblings (in flat reading order) for the given file.
 */
export async function getPrevNext(
  slug: string[],
): Promise<[ContentFileNode | null, ContentFileNode | null]> {
  const files = await listAllFiles();
  const key = slug.join("/");
  const idx = files.findIndex((f) => f.slug.join("/") === key);
  if (idx === -1) return [null, null];
  return [
    idx > 0 ? files[idx - 1] : null,
    idx < files.length - 1 ? files[idx + 1] : null,
  ];
}

/**
 * Slug enumeration for `generateStaticParams`. Includes both files and
 * directory paths (so `/read/foo` works even when only `foo/_index.md`
 * exists). The empty slug (root) is **not** returned — root is rendered by
 * the home page.
 */
export async function getAllReadableSlugs(): Promise<string[][]> {
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
