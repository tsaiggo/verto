import type { ContentService } from "@/lib/agent-content/service";
import type { ContentCitation } from "@/lib/agent-content/types";
import type { ToolDef } from "./registry";
import { optionalString, parseObject, requireString } from "./registry";

type ContentArguments = Record<string, unknown>;

function optionalInteger(args: ContentArguments, key: string): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Invalid "${key}"`);
  return value as number;
}

const pagination = {
  cursor: { type: "string" },
  limit: { type: "integer", minimum: 1, maximum: 40 },
};

/** Each turn retains only evidence returned by its own successful content reads. */
export function createContentTools(service: ContentService) {
  const evidence = new Map<string, ContentCitation>();
  function cite(citation: ContentCitation): string {
    for (const [token, existing] of evidence) {
      if (
        existing.docId === citation.docId &&
        existing.version === citation.version &&
        existing.blockId === citation.blockId &&
        existing.excerpt === citation.excerpt
      )
        return token;
    }
    const token = `e${evidence.size + 1}`;
    evidence.set(token, citation);
    return token;
  }
  function tool(
    name: string,
    description: string,
    properties: Record<string, unknown>,
    required: string[],
    run: (args: ContentArguments) => Promise<unknown>
  ): ToolDef<ContentArguments> {
    return {
      name,
      description,
      mutates: false,
      parameters: { type: "object", properties, required, additionalProperties: false },
      parse: (raw) => {
        const args = parseObject(raw);
        if (Array.isArray(args)) throw new Error("Arguments must be an object");
        for (const key of Object.keys(args))
          if (!(key in properties)) throw new Error(`Unknown "${key}"`);
        for (const key of required) requireString(args, key);
        return args;
      },
      async run(args) {
        return { ok: true, content: JSON.stringify(await run(args)) };
      },
    };
  }
  const tools = [
    tool(
      "list_documents",
      "List saved readable documents in this conversation's scope. Follow nextCursor to discover further documents.",
      pagination,
      [],
      async (args) =>
        service.listDocuments({
          cursor: optionalString(args, "cursor"),
          limit: optionalInteger(args, "limit"),
        })
    ),
    tool(
      "search_documents",
      "Search saved document text, titles and tags in this conversation's scope. Read the matching document before relying on it; title matches alone do not provide evidence.",
      { query: { type: "string" }, ...pagination },
      ["query"],
      async (args) =>
        service.searchDocuments({
          query: requireString(args, "query"),
          cursor: optionalString(args, "cursor"),
          limit: optionalInteger(args, "limit"),
        })
    ),
    tool(
      "read_document",
      "Read a bounded page of document blocks by the exact document ID returned by search/list. Each passage includes an evidenceToken for [[evidence:TOKEN]] citations. Follow nextCursor for more blocks; unseen remainder is unavailable.",
      {
        docId: { type: "string" },
        version: { type: "string" },
        offset: { type: "integer", minimum: 0 },
        ...pagination,
      },
      ["docId"],
      async (args) => {
        const result = await service.readDocument({
          docId: requireString(args, "docId"),
          version: optionalString(args, "version"),
          offset: optionalInteger(args, "offset"),
          cursor: optionalString(args, "cursor"),
          limit: optionalInteger(args, "limit"),
        });
        return {
          ...result,
          blocks: result.blocks.map((block) => ({ ...block, evidenceToken: cite(block.citation) })),
        };
      }
    ),
    tool(
      "list_annotations",
      "Read the user's saved annotations for an accessible document. Distinguish the user's note from the original quoted passage. A citation points to the original quote; include the annotation ID when discussing the user's interpretation.",
      { docId: { type: "string" }, ...pagination },
      ["docId"],
      async (args) => {
        const result = await service.listAnnotations({
          docId: requireString(args, "docId"),
          cursor: optionalString(args, "cursor"),
          limit: optionalInteger(args, "limit"),
        });
        return {
          ...result,
          annotations: result.annotations.map((annotation) => ({
            ...annotation,
            ...(annotation.citation ? { evidenceToken: cite(annotation.citation) } : {}),
          })),
        };
      }
    ),
    tool(
      "resolve_citation",
      "Verify that a cited passage still exists in the same document version.",
      {
        docId: { type: "string" },
        version: { type: "string" },
        blockId: { type: "string" },
        excerpt: { type: "string" },
      },
      ["docId", "version", "blockId", "excerpt"],
      async (args) =>
        service.resolveCitation({
          docId: requireString(args, "docId"),
          version: requireString(args, "version"),
          blockId: requireString(args, "blockId"),
          excerpt: requireString(args, "excerpt"),
        })
    ),
  ];
  return { tools, evidence };
}

/** Replace model tokens using verified evidence only; invented tokens cannot become links. */
export function resolveContentAnswer(text: string, evidence: Map<string, ContentCitation>) {
  const citations: Array<{
    index: number;
    label: string;
    href: string;
    sourceId: string;
    excerpt: string;
  }> = [];
  const indices = new Map<string, number>();
  const answer = text.replace(/\[\[evidence:([^\]\s]+)\]\]/g, (_match, token: string) => {
    const citation = evidence.get(token);
    if (!citation) return "";
    let index = indices.get(token);
    if (!index) {
      index = citations.length + 1;
      indices.set(token, index);
      citations.push({
        index,
        label: citation.label,
        href: citation.href,
        sourceId: citation.blockId,
        excerpt: citation.excerpt,
      });
    }
    return `[${index}](${citation.href})`;
  });
  return { text: answer, citations };
}
