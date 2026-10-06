import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ContentAccessError, type ContentService } from "./types";

const pageShape = {
  cursor: z.string().max(8000).optional(),
  limit: z.number().int().positive().max(40).optional(),
};
const documentShape = { docId: z.string().min(1).max(4096), includeDrafts: z.boolean().optional() };
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

async function result(operation: () => Promise<unknown>) {
  try {
    const data = await operation();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent: data as Record<string, unknown>,
    };
  } catch (error) {
    const code = error instanceof ContentAccessError ? error.code : "unavailable";
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: code,
            message:
              code === "unavailable"
                ? "The authorized content is unavailable."
                : (error as Error).message,
          }),
        },
      ],
    };
  }
}

export function createVertoMcpServer(service: ContentService): McpServer {
  const server = new McpServer(
    { name: "verto-content", version: "1.0.0" },
    {
      instructions:
        "Read-only access to documents explicitly shared from Verto. Only parsed Markdown/MDX source text is available. Expression syntax may remain as raw source text; it is never executed. Raw HTML, rendered MDX component output and media are unavailable. Search, read relevant blocks, and cite the returned evidence href. Drafts require both grant and request opt-in. A revoked grant immediately stops content access.",
    }
  );
  server.registerTool(
    "list_documents",
    {
      description: "List readable shared Markdown/MDX documents with bounded pagination.",
      inputSchema: { ...pageShape, includeDrafts: z.boolean().optional() },
      annotations,
    },
    (input) => result(() => service.listDocuments(input))
  );
  server.registerTool(
    "search_documents",
    {
      description:
        "Search all authorized document passages, including content beyond the beginning. Returns citable block evidence.",
      inputSchema: {
        ...pageShape,
        query: z.string().min(1).max(500),
        includeDrafts: z.boolean().optional(),
      },
      annotations,
    },
    (input) => result(() => service.searchDocuments(input))
  );
  server.registerTool(
    "read_document",
    {
      description:
        "Read at most six blocks (24k characters) from a shared document. Continue with nextCursor or a block offset; version detects stale evidence.",
      inputSchema: {
        ...pageShape,
        ...documentShape,
        version: z.string().max(200).optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      annotations,
    },
    (input) => result(() => service.readDocument(input))
  );
  server.registerTool(
    "list_annotations",
    {
      description:
        "Read quotes and notes for an authorized document. Requires separate annotations:read consent.",
      inputSchema: { ...pageShape, ...documentShape },
      annotations,
    },
    (input) => result(() => service.listAnnotations(input))
  );
  server.registerTool(
    "resolve_citation",
    {
      description:
        "Verify a returned passage against its exact current document version; provides a Verto source link.",
      inputSchema: {
        docId: documentShape.docId,
        version: z.string().min(1).max(200),
        blockId: z.string().min(1).max(200),
        excerpt: z.string().min(1).max(480),
        includeDrafts: z.boolean().optional(),
      },
      annotations,
    },
    (input) => result(() => service.resolveCitation(input))
  );
  server.registerResource(
    "shared-documents",
    "verto://documents",
    {
      description:
        "First page of authorized shared documents. Use list_documents for additional pages.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await service.listDocuments()),
        },
      ],
    })
  );
  server.registerResource(
    "document-blocks",
    new ResourceTemplate("verto://documents/{docId}", { list: undefined }),
    {
      description:
        "Read-only first page of a shared document. Additional blocks use read_document.",
      mimeType: "application/json",
    },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await service.readDocument({ docId: decodeURIComponent(String(variables.docId)) })
          ),
        },
      ],
    })
  );
  return server;
}
