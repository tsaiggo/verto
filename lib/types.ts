import type { Node } from 'unist';

export interface DocFrontmatter {
  title?: string;
  description?: string;
  order?: number;
}

export interface BlogFrontmatter {
  title?: string;
  description?: string;
  date?: string;
  author?: string;
  tags?: string[];
  order?: number;
}

export interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export interface InlineCommentRefNode extends Node {
  type: 'inlineCommentRef';
  commentId: string;
  children: Node[];
}

export interface InlineCommentDefNode extends Node {
  type: 'inlineCommentDef';
  commentId: string;
  value: string;
}
