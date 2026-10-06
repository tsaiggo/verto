import { documentBlocks, normalizeContentText } from "@/lib/agent-content/blocks";
import type { ContentCitation, ContentDocument } from "@/lib/agent-content/types";

type CitationTarget = Pick<ContentCitation, "version" | "blockId" | "excerpt">;

const BLOCK_ELEMENTS = new Set([
  "BR",
  "P",
  "DIV",
  "LI",
  "UL",
  "OL",
  "BLOCKQUOTE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "PRE",
]);

/** The content parser separates Markdown blocks, rows and cells, while DOM
 * textContent concatenates adjacent cells/list items. Keep inline text joined
 * and add semantic separators only at those block boundaries. */
function renderedCitationText(element: HTMLElement): string {
  if (element.tagName === "PRE")
    return normalizeContentText(
      element.querySelector("code")?.textContent ?? element.textContent ?? ""
    );
  function text(node: Node): string {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";
    const child = node as HTMLElement;
    if (
      child.getAttribute("aria-hidden") === "true" ||
      ["BUTTON", "SCRIPT", "STYLE"].includes(child.tagName)
    )
      return "";
    if (child.tagName === "BR") return " ";
    const value = Array.from(child.childNodes).map(text).join("");
    return BLOCK_ELEMENTS.has(child.tagName) ? ` ${value} ` : value;
  }
  return normalizeContentText(text(element));
}

/** Match only content inside the reader. Repeated quotes need an unambiguous
 * source block; we never guess among duplicate passages after a revision. */
export function findAgentCitationTarget(
  root: Element,
  citation: CitationTarget,
  source?: string,
  version?: string
): HTMLElement | null {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(
      "[data-page-identity] h1, article[data-article] h1, article[data-article] h2, article[data-article] h3, article[data-article] h4, article[data-article] h5, article[data-article] h6, article[data-article] p, article[data-article] li, article[data-article] blockquote, article[data-article] pre, article[data-article] ul, article[data-article] ol, article[data-article] table"
    )
  );
  const quote = normalizeContentText(citation.excerpt);
  if (!quote) return null;
  const matches = candidates
    .filter((element) => renderedCitationText(element).includes(quote))
    .filter(
      (element, _index, all) => !all.some((other) => other !== element && element.contains(other))
    );

  if (source !== undefined && version === citation.version) {
    const doc: ContentDocument = {
      id: "current",
      title: "Current document",
      href: "",
      version,
      format: "md",
      draft: false,
      tags: [],
      sourceLabel: "Reader",
    };
    const blocks = documentBlocks(doc, source);
    const selected = blocks.find((block) => block.id === citation.blockId);
    // Caller-supplied excerpts must actually belong to the cited block.
    if (!selected || !selected.text.includes(quote)) return null;
    const sameTextBlocks = blocks.filter((block) => block.text === selected.text);
    const sameTextTargets = matches.filter(
      (element) => renderedCitationText(element) === selected.text
    );
    if (sameTextTargets.length === sameTextBlocks.length)
      return sameTextTargets[sameTextBlocks.findIndex((block) => block.id === selected.id)] ?? null;
  }
  return matches.length === 1 ? matches[0] : null;
}

export function focusAgentCitationTarget(target: HTMLElement): void {
  const reduced = target.ownerDocument.defaultView?.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.setAttribute("data-agent-source-active", "true");
}
