import { documentBlocks, makeCitation, normalizeContentText } from "./blocks";
import { contentHash } from "./identity";
import {
  ContentAccessError,
  documentMetadata,
  type ContentCitation,
  type ContentDocument,
  type DocumentListInput,
  type DocumentRepository,
  type PageInput,
  type StoredDocument,
} from "./types";

const MAX_PAGE = 40;
const DEFAULT_PAGE = 12;
const TEXT_COVERAGE = {
  textOnly: true as const,
  omittedKinds: ["raw_html", "evaluated_mdx", "media"],
};

function pageLimit(limit = DEFAULT_PAGE): number {
  if (!Number.isInteger(limit) || limit < 1)
    throw new ContentAccessError("invalid_request", "Limit must be a positive integer.");
  return Math.min(limit, MAX_PAGE);
}

function pageOffset(cursor: string | undefined, key: string): number {
  if (!cursor) return 0;
  try {
    const value = JSON.parse(decodeURIComponent(cursor));
    if (value.key === key && Number.isSafeInteger(value.offset) && value.offset >= 0)
      return value.offset;
  } catch {
    /* Malformed cursors never become document ids or paths. */
  }
  throw new ContentAccessError("invalid_cursor", "This cursor is invalid or its source changed.");
}

function paginate<T>(items: T[], input: PageInput, key: string, offset?: number) {
  const start = offset ?? pageOffset(input.cursor, key);
  const page = items.slice(start, start + pageLimit(input.limit));
  const next = start + page.length;
  return {
    items: page,
    total: items.length,
    ...(next < items.length
      ? { nextCursor: encodeURIComponent(JSON.stringify({ key, offset: next })) }
      : {}),
  };
}

async function documentKey(documents: ContentDocument[]): Promise<string> {
  return contentHash(documents.map((document) => `${document.id}@${document.version}`).join("|"));
}

async function annotationPage(
  repository: DocumentRepository,
  document: StoredDocument,
  input: PageInput
) {
  const blocks = documentBlocks(document, document.source);
  const annotations = (await repository.listAnnotations(document.id)).map((annotation) => {
    const quote = normalizeContentText(annotation.quote);
    const candidates = blocks.filter((item) => quote && item.text.includes(quote));
    const block = candidates.length === 1 ? candidates[0] : undefined;
    return {
      ...annotation,
      ...(block ? { citation: makeCitation(document, block.id, quote, block.label) } : {}),
    };
  });
  const page = paginate(
    annotations,
    { ...input, limit: Math.min(input.limit ?? 6, 6) },
    `annotations:${document.id}:${document.version}:${await contentHash(annotations.map((item) => item.updatedAt).join("|"))}`
  );
  return { annotations: page.items, total: page.total, nextCursor: page.nextCursor };
}

export function createContentService(repository: DocumentRepository) {
  async function readable(docId: string, includeDrafts = false) {
    const metadata = (await repository.listDocuments()).find((item) => item.id === docId);
    if (!metadata || (metadata.draft && !includeDrafts))
      throw new ContentAccessError("not_found", "Document is unavailable.");
    const document = await repository.readDocument(docId);
    if (!document || (document.draft && !includeDrafts))
      throw new ContentAccessError("not_found", "Document is unavailable.");
    return document;
  }

  return {
    async listDocuments(input: DocumentListInput = {}) {
      const documents = (await repository.listDocuments()).filter(
        (item) => input.includeDrafts || !item.draft
      );
      const page = paginate(documents, input, `list:${await documentKey(documents)}`);
      return { documents: page.items, total: page.total, nextCursor: page.nextCursor };
    },
    async searchDocuments(input: DocumentListInput & { query: string }) {
      const query = normalizeContentText(input.query).toLocaleLowerCase();
      if (!query || query.length > 500)
        throw new ContentAccessError(
          "invalid_request",
          "Provide a search query of 1–500 characters."
        );
      const terms = query.split(" ");
      const documents = (await repository.listDocuments()).filter(
        (item) => input.includeDrafts || !item.draft
      );
      const matches: {
        document: ContentDocument;
        blockIndex?: number;
        snippet: string;
        citation?: ContentCitation;
        score: number;
      }[] = [];
      const batch = repository.readDocuments
        ? await repository.readDocuments(documents.map((item) => item.id))
        : undefined;
      for (const metadata of documents) {
        const stored = batch
          ? batch.find((item) => item.id === metadata.id)
          : await repository.readDocument(metadata.id);
        if (!stored || (stored.draft && !input.includeDrafts)) continue;
        const current = documentMetadata(stored);
        const titleMatches = terms.every((term) =>
          `${current.title} ${current.tags.join(" ")}`.toLocaleLowerCase().includes(term)
        );
        const blocks = documentBlocks(current, stored.source);
        const hits = blocks
          .filter((block) => terms.every((term) => block.text.toLocaleLowerCase().includes(term)))
          .slice(0, 3);
        if (hits.length) {
          for (const block of hits) {
            const at = Math.max(0, block.text.toLocaleLowerCase().indexOf(terms[0]) - 100);
            const excerpt = block.text.slice(at, at + 480);
            matches.push({
              document: current,
              blockIndex: block.index,
              snippet: excerpt,
              citation: makeCitation(current, block.id, excerpt, block.label),
              score: titleMatches ? 3 : 1,
            });
          }
        } else if (titleMatches)
          matches.push({
            document: current,
            snippet: "Matched the document title or tags.",
            score: 2,
          });
      }
      matches.sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title));
      const page = paginate(matches, input, `search:${query}:${await documentKey(documents)}`);
      return {
        matches: page.items.map((match) => ({
          document: match.document,
          blockIndex: match.blockIndex,
          snippet: match.snippet,
          citation: match.citation,
        })),
        total: page.total,
        nextCursor: page.nextCursor,
      };
    },
    async readDocument(
      input: PageInput & {
        docId: string;
        version?: string;
        offset?: number;
        includeDrafts?: boolean;
      }
    ) {
      const document = await readable(input.docId, input.includeDrafts);
      if (input.version && input.version !== document.version)
        throw new ContentAccessError(
          "stale_version",
          "The document changed. Search or read it again."
        );
      if (input.offset !== undefined && (!Number.isSafeInteger(input.offset) || input.offset < 0))
        throw new ContentAccessError(
          "invalid_request",
          "Offset must be a nonnegative block index."
        );
      const blocks = documentBlocks(document, document.source);
      const page = paginate(
        blocks,
        { ...input, limit: Math.min(input.limit ?? 6, 6) },
        `read:${document.id}:${document.version}`,
        input.offset
      );
      return {
        document: documentMetadata(document),
        blocks: page.items,
        totalBlocks: page.total,
        nextCursor: page.nextCursor,
        coverage: TEXT_COVERAGE,
      };
    },
    async listAnnotations(input: PageInput & { docId: string; includeDrafts?: boolean }) {
      const document = await readable(input.docId, input.includeDrafts);
      return annotationPage(repository, document, input);
    },
    async resolveCitation(
      input: Pick<ContentCitation, "docId" | "version" | "blockId" | "excerpt"> & {
        includeDrafts?: boolean;
      }
    ) {
      let document;
      try {
        document = await readable(input.docId, input.includeDrafts);
      } catch (error) {
        if (error instanceof ContentAccessError && error.code === "not_found")
          return { status: "missing" as const };
        throw error;
      }
      if (input.version !== document.version) return { status: "stale" as const };
      const excerpt = normalizeContentText(input.excerpt);
      const block = documentBlocks(document, document.source).find(
        (item) => item.id === input.blockId && excerpt && item.text.includes(excerpt)
      );
      if (!block) return { status: "missing" as const };
      return {
        status: "resolved" as const,
        citation: makeCitation(document, block.id, excerpt, block.label),
      };
    },
  };
}

export type ContentService = ReturnType<typeof createContentService>;
