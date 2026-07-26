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
  /** Heading and paragraph passages that the model may cite verbatim by id. */
  sourceAnchors?: DocSourceAnchor[];
}

export interface DocSourceAnchor {
  /** Stable, model-facing source id. */
  id: string;
  /** DOM id used as a progressive-enhancement href target. */
  targetId: string;
  /** Human-readable section/paragraph label. */
  label: string;
  /** Exact normalized passage text included in the model context. */
  text: string;
}

/** Default cap on how much body text we send as context. */
export const DEFAULT_CONTEXT_CHARS = 24_000;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function sourceHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function nextSourceId(kind: "h" | "p", seed: string, occurrences: Map<string, number>): string {
  const base = `source-${kind}-${sourceHash(seed)}`;
  const occurrence = (occurrences.get(base) ?? 0) + 1;
  occurrences.set(base, occurrence);
  return occurrence === 1 ? base : `${base}-${occurrence}`;
}

function usableDomId(value: string | null): value is string {
  return Boolean(value && !/[\s"'<>]/.test(value));
}

/**
 * Assign deterministic source ids to headings and paragraphs in the rendered
 * article. Existing heading ids remain intact so outline links keep working;
 * generated paragraph ids are refreshed when their text changes.
 */
export function sourceAnchorsFromArticle(article: Element): DocSourceAnchor[] {
  const occurrences = new Map<string, number>();
  const anchors: DocSourceAnchor[] = [];
  let sectionLabel = "Document";
  let paragraphIndex = 0;

  for (const element of article.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p")) {
    const text = collapseWhitespace(element.textContent ?? "");
    if (!text) continue;

    const isHeading = /^H[1-6]$/.test(element.tagName);
    if (isHeading) {
      sectionLabel = text;
      paragraphIndex = 0;
    } else {
      paragraphIndex += 1;
    }

    const sourceId = nextSourceId(
      isHeading ? "h" : "p",
      isHeading ? `${element.tagName}:${text}` : `${sectionLabel}\n${text}`,
      occurrences
    );
    const generatedTarget = element.dataset.vertoSourceTarget === "generated";
    const existingTarget = element.getAttribute("id");
    const targetId = !generatedTarget && usableDomId(existingTarget) ? existingTarget : sourceId;

    if (targetId === sourceId) {
      element.id = sourceId;
      element.dataset.vertoSourceTarget = "generated";
    }
    element.dataset.sourceAnchor = sourceId;

    anchors.push({
      id: sourceId,
      targetId,
      label: isHeading ? text : `${sectionLabel} · paragraph ${paragraphIndex}`,
      text,
    });
  }

  return anchors;
}

function includedSourceAnchors(
  anchors: DocSourceAnchor[],
  maxChars: number,
  fullText: string
): DocSourceAnchor[] {
  const included: DocSourceAnchor[] = [];
  let searchFrom = 0;

  for (const anchor of anchors) {
    const passageStart = fullText.indexOf(anchor.text, searchFrom);
    if (passageStart === -1) continue;
    searchFrom = passageStart + anchor.text.length;

    const remaining = maxChars - passageStart;
    if (remaining <= 0) break;

    const clipped = anchor.text.length > remaining;
    const text = clipped ? `${anchor.text.slice(0, remaining).trimEnd()}…` : anchor.text;
    if (!text.replace(/…$/, "").trim()) break;

    included.push({ ...anchor, text });
    if (clipped) break;
  }

  return included;
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
  const sourceAnchors = ctx.sourceAnchors ?? [];
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
  if (sourceAnchors.length > 0) {
    lines.push(
      "",
      "SOURCE CITATION CONTRACT:",
      'The current document is split into passages with ids such as [SOURCE id="source-p-abc"].',
      "For every statement supported by the current document, append the exact token [[source:SOURCE_ID]] immediately after that statement.",
      "Use only SOURCE_ID values listed below. Never invent, shorten, or transform an id.",
      "A citation means the named passage directly supports the statement. If no listed passage supports an answer, say that the current page does not provide the evidence and emit no citation token."
    );
  } else {
    lines.push(
      "",
      "No citable current-page passages are available. Do not emit [[source:...]] tokens or claim that an answer is grounded in the current page."
    );
  }

  if (title || body) {
    lines.push("", "--- CURRENT DOCUMENT ---");
    if (title) lines.push(`Title: ${title}`);
    if (ctx.truncated && ctx.totalChars) {
      const included = ctx.includedChars ?? body?.replace(/…$/, "").length ?? 0;
      lines.push(
        `Context scope: the first ${included} of ${ctx.totalChars} normalized characters are available. Treat the unseen remainder as unavailable.`
      );
    }
    if (sourceAnchors.length > 0) {
      for (const source of sourceAnchors) {
        lines.push(
          "",
          `[SOURCE id=${JSON.stringify(source.id)} label=${JSON.stringify(source.label)}]`,
          source.text,
          "[/SOURCE]"
        );
      }
    } else if (body) {
      lines.push("", body);
    }
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
    "3–6 concise bullets covering the main ideas, claims, or steps.",
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

  const article = doc.querySelector("article.content-wrap, article[data-article]");
  if (!article) return {};

  const heading = article.querySelector("h1");
  const title = heading?.textContent?.trim() || undefined;

  const raw = (article as HTMLElement).innerText ?? article.textContent ?? "";
  const collapsed = collapseWhitespace(raw);
  if (!collapsed) return title ? { title } : {};

  const allSourceAnchors = sourceAnchorsFromArticle(article);
  const limit = Math.max(0, Math.floor(maxChars));
  const truncated = collapsed.length > limit;
  const includedChars = Math.min(collapsed.length, limit);
  const body = truncated ? `${collapsed.slice(0, limit).trimEnd()}…` : collapsed;
  const sourceAnchors = includedSourceAnchors(allSourceAnchors, limit, collapsed);

  return {
    title,
    body,
    totalChars: collapsed.length,
    includedChars,
    truncated,
    sourceAnchors,
  };
}
