// The reading companion's tools. Read tools observe the open document and the
// reader's local notes; write tools (create_highlight_note, save_summary) are
// flagged `mutates` so the agent loop pauses for confirmation before they run.

import { describeRange, locateAnchor } from "@/lib/annotation-anchor";
import {
  annotationNote,
  annotationsForDoc,
  hydrateAnnotations,
  saveAnnotation,
} from "@/lib/annotations";
import { articleText, getArticleRoot } from "@/lib/annotation-dom";
import { findSummary, hydrateSummaries, saveSummary } from "@/lib/summaries";
import { describeDocContextScope } from "@/lib/ai/context";
import type { ToolCtx, ToolDef } from "./registry";
import { optionalString, parseObject, requireString } from "./registry";

const noArgs = { type: "object", properties: {}, additionalProperties: false } as const;

export function normalizedQuoteRange(
  text: string,
  quote: string
): { start: number; end: number } | null {
  const exact = locateAnchor(text, { quote, prefix: "", suffix: "", start: 0 });
  if (exact) return exact;

  const collapsedChars: string[] = [];
  const rawOffsets: number[] = [];
  let pendingSpace = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (/\s/.test(char)) {
      if (collapsedChars.length > 0) pendingSpace = true;
      continue;
    }
    if (pendingSpace) {
      collapsedChars.push(" ");
      rawOffsets.push(index - 1);
      pendingSpace = false;
    }
    collapsedChars.push(char);
    rawOffsets.push(index);
  }
  const normalizedQuote = quote.trim().replace(/\s+/g, " ");
  if (!normalizedQuote) return null;
  const collapsed = collapsedChars.join("");
  const located = locateAnchor(collapsed, {
    quote: normalizedQuote,
    prefix: "",
    suffix: "",
    start: 0,
  });
  if (!located) return null;
  return {
    start: rawOffsets[located.start],
    end: rawOffsets[located.end - 1] + 1,
  };
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `a-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

const getCurrentDoc: ToolDef<Record<string, unknown>> = {
  name: "get_current_doc",
  description:
    "Read the title and available text context for the document the reader is viewing. The result states when only the beginning of a longer document is attached.",
  mutates: false,
  parameters: noArgs,
  parse: parseObject,
  async run(_a, ctx) {
    if (!ctx.doc) return { ok: false, error: "No document is open." };
    return {
      ok: true,
      content: `# ${ctx.doc.title}\n\n${describeDocContextScope(ctx.doc)}\n\n${ctx.doc.body}`,
    };
  },
};

const searchDoc: ToolDef<{ query: string }> = {
  name: "search_doc",
  description: "Find passages in the current document that mention a phrase.",
  mutates: false,
  parameters: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
    additionalProperties: false,
  },
  parse: (raw) => ({ query: requireString(parseObject(raw), "query") }),
  async run({ query }, ctx) {
    if (!ctx.doc) return { ok: false, error: "No document is open." };
    const hits = ctx.doc.body
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
    return hits.length
      ? { ok: true, content: hits.join("\n---\n") }
      : {
          ok: true,
          content: ctx.doc.truncated
            ? `No passage in the attached beginning of the document mentions "${query}". The unseen remainder was not searched.`
            : `No passage mentions "${query}".`,
        };
  },
};

const listNotes: ToolDef<Record<string, unknown>> = {
  name: "list_notes",
  description: "List the reader's existing highlights and notes for this document.",
  mutates: false,
  parameters: noArgs,
  parse: parseObject,
  async run(_a, ctx) {
    if (!ctx.doc) return { ok: false, error: "No document is open." };
    const slug = ctx.doc.slug.join("/");
    const notes = annotationsForDoc((await hydrateAnnotations()).annotations, slug);
    if (!notes.length) return { ok: true, content: "No notes yet." };
    const lines = notes.map(
      (n) => `• "${n.quote}"${annotationNote(n) ? ` — ${annotationNote(n)}` : ""}`
    );
    return { ok: true, content: lines.join("\n") };
  },
};

const getSummary: ToolDef<Record<string, unknown>> = {
  name: "get_saved_summary",
  description: "Return the saved summary for this document, if one exists.",
  mutates: false,
  parameters: noArgs,
  parse: parseObject,
  async run(_a, ctx) {
    if (!ctx.doc) return { ok: false, error: "No document is open." };
    const s = findSummary((await hydrateSummaries()).summaries, ctx.doc.href);
    return s
      ? { ok: true, content: s.contextNote ? `${s.contextNote}\n\n${s.body}` : s.body }
      : { ok: true, content: "No saved summary." };
  },
};

const createHighlight: ToolDef<{ quote: string; note?: string }> = {
  name: "create_highlight_note",
  description: "Highlight an exact quote from the document and attach an optional note.",
  mutates: true,
  parameters: {
    type: "object",
    properties: { quote: { type: "string" }, note: { type: "string" } },
    required: ["quote"],
    additionalProperties: false,
  },
  parse: (raw) => {
    const o = parseObject(raw);
    return { quote: requireString(o, "quote"), note: optionalString(o, "note") };
  },
  async run({ quote, note }, ctx) {
    if (!ctx.doc) return { ok: false, error: "No document is open." };
    const root = typeof document !== "undefined" ? getArticleRoot() : null;
    const anchorText = root ? articleText(root) : ctx.doc.body;
    const at = normalizedQuoteRange(anchorText, quote);
    if (!at) return { ok: false, error: "That quote is not in the document." };
    const anchor = describeRange(anchorText, at.start, at.end);
    const now = new Date().toISOString();
    await saveAnnotation({
      id: newId(),
      docSlug: ctx.doc.slug.join("/"),
      quote: anchor.quote,
      anchor,
      color: "yellow",
      turns: note ? [{ id: newId(), author: "human", body: note, createdAt: now }] : [],
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, content: "Highlight saved." };
  },
};

const saveSummaryTool: ToolDef<{ body: string }> = {
  name: "save_summary",
  description: "Save a Markdown summary of the current document to the reader's library.",
  mutates: true,
  parameters: {
    type: "object",
    properties: { body: { type: "string" } },
    required: ["body"],
    additionalProperties: false,
  },
  parse: (raw) => ({ body: requireString(parseObject(raw), "body") }),
  async run({ body }, ctx) {
    if (!ctx.doc) return { ok: false, error: "No document is open." };
    await saveSummary({
      href: ctx.doc.href,
      slug: ctx.doc.slug,
      title: ctx.doc.title,
      body,
      model: "agent",
      contextNote: describeDocContextScope(ctx.doc),
      createdAt: new Date().toISOString(),
    });
    return { ok: true, content: "Summary saved." };
  },
};

export const READING_TOOLS = [
  getCurrentDoc,
  searchDoc,
  listNotes,
  getSummary,
  createHighlight,
  saveSummaryTool,
] as const;

export type ReadingTool = (typeof READING_TOOLS)[number];

export function readingToolCtx(doc: ToolCtx["doc"]): ToolCtx {
  return { doc };
}
