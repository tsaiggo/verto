// Helpers for turning the document the reader is viewing into chat context.
//
// Verto is a static reader, so rather than thread the current document's text
// through props, the assistant reads it from the rendered DOM at question time
// (see `readDocContextFromDom`). The pure helpers here build the system prompt
// and assemble the final message list; they are unit-tested in isolation.

import type { ChatMessage } from "./types";

/** The slice of the current document handed to the model as context. */
export interface DocContext {
  /** Document title (usually the first H1). */
  title?: string;
  /** Plain-text body, already truncated to a safe length. */
  body?: string;
  /** Number of normalized characters available in the rendered document. */
  totalChars?: number;
  /** Number of normalized characters included in `body`. */
  includedChars?: number;
  /** True when the rendered document was larger than the included context. */
  truncated?: boolean;
}

/** Default cap on how much body text we send as context. */
export const DEFAULT_CONTEXT_CHARS = 24_000;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Collapse whitespace and clip to `max` characters (adding an ellipsis). */
export function truncate(text: string, max: number): string {
  const collapsed = collapseWhitespace(text);
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max).trimEnd() + "…";
}

/** Human-readable disclosure used by the reading companion before a request. */
export function describeDocContextScope(ctx: DocContext): string {
  if (!ctx.body) return "Context: no readable page text is available.";

  const included = ctx.includedChars ?? ctx.body.replace(/…$/, "").length;
  const total = ctx.totalChars ?? included;
  if (ctx.truncated) {
    return `Context: first ${included.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} characters from this page.`;
  }
  return `Context: full page (${total.toLocaleString("en-US")} characters).`;
}

/**
 * Build the system prompt that primes the assistant. When document context is
 * available it is embedded so answers can be grounded in what the user reads.
 */
export function buildSystemPrompt(ctx: DocContext): string {
  const lines = [
    "You are Verto's reading companion, embedded in an agent-native MDX document workspace.",
    "Help the reader understand, annotate, extract, and connect the document they are currently viewing.",
    "Answer concisely in the same language as the user's question.",
    "When useful, structure your answer as short Markdown bullets or sections that can become MDX notes.",
    "Prefer information from the provided document; if the answer is not in it,",
    "say so briefly before adding any general knowledge.",
    "Do not invent quotes, links, backlinks, or document details that are not present in the provided context.",
  ];

  const title = ctx.title?.trim();
  const body = ctx.body?.trim();
  if (title || body) {
    lines.push("", "--- CURRENT DOCUMENT ---");
    if (title) lines.push(`Title: ${title}`);
    if (ctx.truncated && ctx.totalChars) {
      const included = ctx.includedChars ?? body?.replace(/…$/, "").length ?? 0;
      lines.push(
        `Context scope: the first ${included} of ${ctx.totalChars} normalized characters are available. Treat the unseen remainder as unavailable.`
      );
    }
    if (body) lines.push("", body);
    lines.push("--- END DOCUMENT ---");
  }

  return lines.join("\n");
}

/**
 * Assemble the full message list sent to the provider: a system prompt built
 * from the document context, followed by the prior conversation, followed by
 * the new user question.
 */
export function buildMessages(
  ctx: DocContext,
  history: ChatMessage[],
  question: string
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(ctx) },
    ...history,
    { role: "user", content: question },
  ];
}

/**
 * Build the message list for a one-shot document summary. Like the chat path
 * it grounds the model in the rendered document, but asks for a fixed,
 * Markdown-structured summary instead of answering a question.
 */
export function buildSummaryMessages(ctx: DocContext): ChatMessage[] {
  const lines = [
    "You are Verto's reading assistant, embedded in an MDX document reader.",
    "Produce a faithful, well-structured summary of the document below.",
    "Write GitHub-flavored Markdown with these sections, in order:",
    "## TL;DR",
    "One or two sentences capturing the document's core point.",
    "## Key points",
    "3 to 6 concise bullets covering the main ideas, claims, or steps.",
    "## Notable details",
    "Optional bullets for important specifics, examples, or caveats. Omit this section entirely if there are none.",
    "Base the summary only on the document content; do not invent facts.",
    "Answer in the same language as the document.",
  ];

  const title = ctx.title?.trim();
  const body = ctx.body?.trim();
  if (title || body) {
    lines.push("", "--- CURRENT DOCUMENT ---");
    if (title) lines.push(`Title: ${title}`);
    if (ctx.truncated && ctx.totalChars) {
      const included = ctx.includedChars ?? body?.replace(/…$/, "").length ?? 0;
      lines.push(
        `Context scope: the first ${included} of ${ctx.totalChars} normalized characters are available. Do not imply the unseen remainder was summarized.`
      );
    }
    if (body) lines.push("", body);
    lines.push("--- END DOCUMENT ---");
  }

  return [
    { role: "system", content: lines.join("\n") },
    { role: "user", content: "Summarize the current document as instructed." },
  ];
}

/**
 * Extract the current document's title + body text from the rendered page.
 * Returns an empty context outside the browser (SSR) or when no article is
 * present (e.g. directory index pages).
 */
export function readDocContextFromDom(
  root?: Document,
  maxChars: number = DEFAULT_CONTEXT_CHARS
): DocContext {
  const doc = root ?? (typeof document !== "undefined" ? document : undefined);
  if (!doc) return {};

  const article = doc.querySelector("article.content-wrap");
  if (!article) return {};

  const heading = article.querySelector("h1");
  const title = heading?.textContent?.trim() || undefined;

  const raw = (article as HTMLElement).innerText ?? article.textContent ?? "";
  const collapsed = collapseWhitespace(raw);
  if (!collapsed) return title ? { title } : {};

  const truncated = collapsed.length > maxChars;
  const includedChars = Math.min(collapsed.length, maxChars);
  const body = truncated ? `${collapsed.slice(0, maxChars).trimEnd()}…` : collapsed;

  return {
    title,
    body,
    totalChars: collapsed.length,
    includedChars,
    truncated,
  };
}
