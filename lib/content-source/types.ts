// Public types for the content-source abstraction.
//
// A "content source" provides a flat list of readable file entries and a
// way to read each file's raw bytes. The tree builder (see `./tree.ts`) is
// source-agnostic and assembles `ContentNode` trees from this primitive.

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
  /** File modification time (ms since epoch). May be 0 if the source can't
   * supply it; UI should always fall back to frontmatter `date`/`updated`. */
  mtime: number;
  /**
   * Opaque source-specific identifier — passed back to `ContentSource.readFile`
   * to fetch the raw text. For the local source this is the absolute path on
   * disk; for the GitHub source the blob SHA; for OneDrive the item id or
   * download URL. Treat as opaque outside the source that produced it.
   */
  id: string;
  /** File extension including dot (`.md` or `.mdx`) */
  ext: string;
  /** Cover image URL/path from frontmatter */
  cover?: string;
  /** Whether the document is a draft (hidden in production) */
  draft?: boolean;
  /** Explicit "updated" date (overrides mtime in display) */
  updated?: string;
  /** Document language */
  lang?: string;
  /** TOC config: `false` to hide, or { minDepth, maxDepth } */
  toc?: false | { minDepth?: number; maxDepth?: number };
  /** Optional remote metadata */
  sha?: string;
  size?: number;
  etag?: string;
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
// Optional navigation overrides (`navigation.json` at the source root)
// ---------------------------------------------------------------------------

/**
 * Optional config to override the file-system derived tree. Keys are
 * slash-separated slug paths relative to the content root, **without** the
 * file extension.
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

// ---------------------------------------------------------------------------
// ContentSource interface
// ---------------------------------------------------------------------------

/**
 * Raw file entry produced by a `ContentSource`. The tree builder consumes
 * a flat list of these and derives directory structure from the `path`
 * segments — sources do not need to enumerate empty directories.
 */
export interface RawFileEntry {
  /** Path relative to the source root, as segments. e.g. `["docs","intro.md"]` */
  path: string[];
  /** Opaque id passed back to `readFile`. */
  id: string;
  /** Optional metadata; populated when the source can supply it cheaply. */
  sha?: string;
  size?: number;
  mtime?: number;
  etag?: string;
}

/**
 * Minimal contract a content provider must satisfy. Sources only need to
 * list readable file entries and stream raw bytes for a given entry — the
 * rest of the tree assembly (frontmatter parsing, sort, overrides, slug
 * resolution) lives in the source-agnostic `tree.ts` helper.
 */
export interface ContentSource {
  /** Short identifier, e.g. `"local"`, `"github"`, `"onedrive"`. */
  readonly id: string;
  /** Optional human-readable label, e.g. `"github (owner/repo@main)"`. */
  readonly label?: string;
  /** List every readable file (`.md` / `.mdx`) under the content root. */
  listFiles(): Promise<RawFileEntry[]>;
  /**
   * Read the raw text contents for an entry returned by `listFiles`. The
   * `id` is the opaque identifier the source produced; `path` is the
   * original path segments (including filename + extension) and is
   * optional — sources may use it as a fallback when `id` is insufficient,
   * but should not require it.
   */
  readFile(entry: { id: string; path?: string[] }): Promise<string>;
  /**
   * Optionally read a non-content file by path segments relative to the
   * source root (currently used for `navigation.json`). Should return `null`
   * when the file is absent — never throw for "not found".
   */
  readOptionalFile?(path: string[]): Promise<string | null>;
}
