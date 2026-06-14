import type { Node } from "unist";

export interface DocFrontmatter {
  title?: string;
  description?: string;
  order?: number;
  /** Cover image URL or path */
  cover?: string;
  /** Hide from production builds (still visible in dev) */
  draft?: boolean;
  /** Display tags as chips in the article header */
  tags?: string[];
  /** Override the file mtime for "Updated …" display */
  updated?: string;
  /** Document language (sets `<article lang>`) */
  lang?: string;
  /** Control table of contents (false to hide, object to limit depth) */
  toc?: false | { minDepth?: number; maxDepth?: number };
}

export interface BlogFrontmatter {
  title?: string;
  description?: string;
  date?: string;
  author?: string;
  tags?: string[];
  order?: number;
  cover?: string;
  draft?: boolean;
  updated?: string;
  lang?: string;
  toc?: false | { minDepth?: number; maxDepth?: number };
}

/** Configuration for table of contents extraction */
export interface TocConfig {
  /** Minimum heading depth to include (default: 2) */
  minDepth?: number;
  /** Maximum heading depth to include (default: 3) */
  maxDepth?: number;
}

export interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export interface InlineCommentRefNode extends Node {
  type: "inlineCommentRef";
  commentId: string;
  children: Node[];
}

export interface InlineCommentDefNode extends Node {
  type: "inlineCommentDef";
  commentId: string;
  value: string;
}
