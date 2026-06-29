// The reading companion's tools. Read tools observe the open document and the
// reader's local notes; write tools (create_highlight_note, save_summary) are
// flagged `mutates` so the agent loop pauses for confirmation before they run.

import { describeRange, locateAnchor } from "@/lib/annotation-anchor";
import { annotationNote, annotationsForDoc, loadAnnotations, saveAnnotation } from "@/lib/annotations";
import { findSummary, loadSummaries, saveSummary } from "@/lib/summaries";
import type { ToolCtx, ToolDef } from "./registry";
import { optionalString, parseObject, requireString } from "./registry";

const noArgs = { type: "object", properties: {}, additionalProperties: false } as const;

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
  description: "Read the title and full text of the document the reader is viewing.",
  mutates: false,
  parameters: noArgs,
  parse: parseObject,
  async run(_a, ctx) {
    if (!ctx.doc) return { ok: false, error: "No document is open." };
    return { ok: true, content: `# ${ctx.doc.title}\n\n${ctx.doc.body}` };
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
      : { ok: true, content: `No passage mentions "${query}".` };
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
    const notes = annotationsForDoc(loadAnnotations().annotations, slug);
    if (!notes.length) return { ok: true, content: "No notes yet." };
    const lines = notes.map((n) => `• "${n.quote}"${annotationNote(n) ? ` — ${annotationNote(n)}` : ""}`);
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
    const s = findSummary(loadSummaries().summaries, ctx.doc.href);
    return s ? { ok: true, content: s.body } : { ok: true, content: "No saved summary." };
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
    const at = locateAnchor(ctx.doc.body, { quote, prefix: "", suffix: "", start: 0 });
    if (!at) return { ok: false, error: "That quote is not in the document." };
    const now = new Date().toISOString();
    saveAnnotation({
      id: newId(),
      docSlug: ctx.doc.slug.join("/"),
      quote,
      anchor: describeRange(ctx.doc.body, at.start, at.end),
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
    saveSummary({
      href: ctx.doc.href,
      slug: ctx.doc.slug,
      title: ctx.doc.title,
      body,
      model: "agent",
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
