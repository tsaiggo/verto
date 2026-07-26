import type { DocContext, DocSourceAnchor } from "@/lib/ai/context";

export interface AssistantSourceCitation extends DocSourceAnchor {
  index: number;
}

export interface ParsedAssistantSources {
  content: string;
  citations: AssistantSourceCitation[];
  invalidCitationCount: number;
  hasCurrentPageEvidence: boolean;
}

const SOURCE_CITATION = /\[\[\s*source\s*:\s*([^\]\r\n]+?)\s*\]\]/gi;
const INLINE_CITATION_MARKER = "@@VERTO_SOURCE_(\\d+)@@";
const INLINE_CITATION_PREFIX = "#verto-source-citation-";

export function assistantCitationHref(index: number): string {
  return `${INLINE_CITATION_PREFIX}${index}`;
}

export function assistantCitationIndexFromHref(href?: string): number | null {
  if (!href?.startsWith(INLINE_CITATION_PREFIX)) return null;
  const index = Number(href.slice(INLINE_CITATION_PREFIX.length));
  return Number.isSafeInteger(index) && index > 0 ? index : null;
}

export function assistantCitationTargetHref(
  citation: Pick<AssistantSourceCitation, "targetId">
): string {
  return `#${encodeURIComponent(citation.targetId)}`;
}

/**
 * Convert valid machine-readable tokens into inline [n] markers and retain
 * only ids present in the current rendered-page context.
 */
export function parseAssistantSources(
  content: string,
  currentContext: DocContext
): ParsedAssistantSources {
  const available = new Map(
    (currentContext.sourceAnchors ?? []).map((source) => [source.id, source] as const)
  );
  const citations: AssistantSourceCitation[] = [];
  const seen = new Map<string, AssistantSourceCitation>();
  let invalidCitationCount = 0;

  const cleaned = content.replace(SOURCE_CITATION, (_token, rawId: string) => {
    const id = rawId.trim();
    const source = available.get(id);
    if (!source) {
      invalidCitationCount += 1;
      return "";
    }
    let citation = seen.get(id);
    if (!citation) {
      citation = { ...source, index: citations.length + 1 };
      seen.set(id, citation);
      citations.push(citation);
    }
    return `@@VERTO_SOURCE_${citation.index}@@`;
  });
  const withInlineNumbers = cleaned.replace(
    new RegExp(`\\s*${INLINE_CITATION_MARKER}`, "g"),
    (_marker, index: string) => ` [${index}](${assistantCitationHref(Number(index))})`
  );

  return {
    content: withInlineNumbers.replace(/[ \t]+\n/g, "\n").trim(),
    citations,
    invalidCitationCount,
    hasCurrentPageEvidence: citations.length > 0,
  };
}

function articleFromDocument(doc: Document): Element | null {
  return doc.querySelector("article.content-wrap, article[data-article]");
}

/**
 * Scroll and move keyboard focus to a citation target inside the current
 * article. Targets outside that article are deliberately ignored.
 */
export function focusAssistantSource(
  citation: Pick<AssistantSourceCitation, "id" | "targetId"> &
    Partial<Pick<AssistantSourceCitation, "text">>,
  root?: Document
): boolean {
  const doc = root ?? (typeof document !== "undefined" ? document : undefined);
  if (!doc) return false;

  const article = articleFromDocument(doc);
  if (!article) return false;

  const sourceTarget = Array.from(
    article.querySelectorAll<HTMLElement>("[data-source-anchor]")
  ).find((element) => element.dataset.sourceAnchor === citation.id);
  const idTarget = doc.getElementById(citation.targetId);
  const directTarget =
    sourceTarget ??
    (idTarget instanceof HTMLElement && article.contains(idTarget) ? idTarget : null);
  const excerpt = citation.text?.trim().replace(/\s+/g, " ");
  const excerptTarget =
    !directTarget && excerpt
      ? Array.from(
          article.querySelectorAll<HTMLElement>(
            "[data-source-anchor], h1, h2, h3, h4, h5, h6, p, li, blockquote"
          )
        ).find((element) => element.textContent?.trim().replace(/\s+/g, " ").includes(excerpt))
      : null;
  const target = directTarget ?? excerptTarget;
  if (!target) return false;

  const reduceMotion =
    doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.setAttribute("data-agent-source-active", "true");
  doc.defaultView?.setTimeout(() => target.removeAttribute("data-agent-source-active"), 1800);
  return true;
}
