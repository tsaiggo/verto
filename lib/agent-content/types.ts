export interface ContentDocument {
  id: string;
  title: string;
  href: string;
  version: string;
  format: "md" | "mdx";
  draft: boolean;
  tags: string[];
  sourceLabel: string;
}

export interface StoredDocument extends ContentDocument {
  source: string;
  annotationSlug: string;
}

export function documentMetadata(document: ContentDocument): ContentDocument {
  const { id, title, href, version, format, draft, tags, sourceLabel } = document;
  return {
    id,
    title: title.slice(0, 300),
    href,
    version,
    format,
    draft,
    tags: tags.slice(0, 20).map((tag) => tag.slice(0, 80)),
    sourceLabel: sourceLabel.slice(0, 120),
  };
}

export interface ContentCitation {
  docId: string;
  version: string;
  blockId: string;
  excerpt: string;
  href: string;
  label: string;
}

export interface ContentBlock {
  id: string;
  index: number;
  kind: "heading" | "paragraph" | "code";
  label: string;
  text: string;
  citation: ContentCitation;
}

export interface ContentAnnotation {
  id: string;
  quote: string;
  note: string;
  turns: { author: "human" | "ai"; body: string }[];
  createdAt: string;
  updatedAt: string;
  truncated?: boolean;
  citation?: ContentCitation;
}

/** Implementations recheck their authority on every call, including reads. */
export interface DocumentRepository {
  listDocuments(): Promise<ContentDocument[]>;
  readDocument(docId: string): Promise<StoredDocument | null>;
  readDocuments?(docIds: string[]): Promise<StoredDocument[]>;
  listAnnotations(docId: string): Promise<ContentAnnotation[]>;
}

export interface PageInput {
  cursor?: string;
  limit?: number;
}

export interface DocumentListInput extends PageInput {
  includeDrafts?: boolean;
}

export interface ContentPage<T> {
  total: number;
  nextCursor?: string;
  items: T[];
}

export type ContentService = import("./service").ContentService;

export class ContentAccessError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "access_denied"
      | "stale_version"
      | "invalid_cursor"
      | "invalid_request",
    message: string
  ) {
    super(message);
    this.name = "ContentAccessError";
  }
}
