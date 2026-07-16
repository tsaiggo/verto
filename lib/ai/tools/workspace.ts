// Read-only retrieval tools for the workspace Agent. The model receives source
// titles up front, then searches and opens only the documents relevant to the
// request. This keeps the conversation grounded without putting an entire
// library into every prompt.

import type { ToolCtx, ToolDef, WorkspaceSource } from "./registry";
import { parseObject, requireString } from "./registry";

const noArgs = { type: "object", properties: {}, additionalProperties: false } as const;
const MAX_LISTED_SOURCES = 80;
const MAX_SEARCH_RESULTS = 8;
const MAX_SOURCE_CHARS = 16_000;
const MAX_SNIPPET_CHARS = 420;

function workspaceSources(ctx: ToolCtx): WorkspaceSource[] {
  return ctx.workspace ?? [];
}

function sourceLabel(source: WorkspaceSource): string {
  const tags = source.tags?.length ? ` · ${source.tags.map((tag) => `#${tag}`).join(" ")}` : "";
  return `${source.title}: ${source.href}${tags}`;
}

function clip(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trimEnd()}\n\n[Source clipped after ${limit.toLocaleString()} characters.]`;
}

function matchingSnippet(body: string, query: string): string | null {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return null;
  const at = body.toLocaleLowerCase().indexOf(normalized);
  if (at < 0) return null;
  const start = Math.max(0, at - Math.floor(MAX_SNIPPET_CHARS / 3));
  const end = Math.min(
    body.length,
    at + normalized.length + Math.floor((MAX_SNIPPET_CHARS * 2) / 3)
  );
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  return `${prefix}${body.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

const listWorkspaceSources: ToolDef<Record<string, unknown>> = {
  name: "list_workspace_sources",
  description: "List the readable documents currently attached to this workspace.",
  mutates: false,
  parameters: noArgs,
  parse: parseObject,
  async run(_args, ctx) {
    const sources = workspaceSources(ctx);
    if (sources.length === 0)
      return { ok: true, content: "No readable workspace sources are attached." };
    const listed = sources.slice(0, MAX_LISTED_SOURCES).map((source) => `- ${sourceLabel(source)}`);
    if (sources.length > listed.length)
      listed.push(`- …and ${sources.length - listed.length} more sources.`);
    return { ok: true, content: listed.join("\n") };
  },
};

const searchWorkspace: ToolDef<{ query: string }> = {
  name: "search_workspace",
  description:
    "Search the attached workspace documents for a phrase. Returns relevant passages with their source URLs.",
  mutates: false,
  parameters: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
    additionalProperties: false,
  },
  parse: (raw) => ({ query: requireString(parseObject(raw), "query") }),
  async run({ query }, ctx) {
    const sources = workspaceSources(ctx);
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return { ok: false, error: 'Missing "query"' };

    const matches = sources
      .map((source) => {
        const titleMatch = source.title.toLocaleLowerCase().includes(normalized);
        const tagMatch = source.tags?.some((tag) => tag.toLocaleLowerCase().includes(normalized));
        const snippet = matchingSnippet(source.body, query);
        return {
          source,
          snippet,
          score: Number(titleMatch || tagMatch) * 2 + Number(Boolean(snippet)),
        };
      })
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title))
      .slice(0, MAX_SEARCH_RESULTS);

    if (matches.length === 0) {
      return { ok: true, content: `No workspace passages match "${query.trim()}".` };
    }

    return {
      ok: true,
      content: matches
        .map(({ source, snippet }) => {
          const passage =
            snippet ?? "Matched in the document title or tags; read this source for details.";
          return `# ${source.title}\nSource: ${source.href}\n${passage}`;
        })
        .join("\n\n---\n\n"),
    };
  },
};

const readWorkspaceSource: ToolDef<{ href: string }> = {
  name: "read_workspace_source",
  description:
    "Read a workspace document by the exact source URL returned from list_workspace_sources or search_workspace.",
  mutates: false,
  parameters: {
    type: "object",
    properties: { href: { type: "string" } },
    required: ["href"],
    additionalProperties: false,
  },
  parse: (raw) => ({ href: requireString(parseObject(raw), "href") }),
  async run({ href }, ctx) {
    const source = workspaceSources(ctx).find((candidate) => candidate.href === href);
    if (!source) return { ok: false, error: `No attached source has URL "${href}".` };
    return {
      ok: true,
      content: `# ${source.title}\nSource: ${source.href}\n\n${clip(source.body, MAX_SOURCE_CHARS)}`,
    };
  },
};

export const WORKSPACE_TOOLS = [
  listWorkspaceSources,
  searchWorkspace,
  readWorkspaceSource,
] as const;

export function workspaceToolCtx(workspace: WorkspaceSource[]): ToolCtx {
  return { doc: null, workspace };
}
