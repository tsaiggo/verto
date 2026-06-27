// DOM bridge between the rendered article and the pure offset/anchor model.
//
// Client-only. The article is server-rendered HTML; to create and repaint
// reader highlights we need to (a) read the article as one plain-text string,
// (b) turn a live selection Range into character offsets, and (c) wrap an
// offset range in <mark> elements. The text model skips code blocks so offsets
// stay consistent between create-time and repaint-time. The pure anchoring
// (lib/annotation-anchor) is unit-tested; this DOM glue is exercised in the
// browser.

export const ARTICLE_SELECTOR = "[data-article]";
export const HIGHLIGHT_CLASS = "annotation-highlight";

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

interface TextMap {
  text: string;
  segments: TextSegment[];
}

export function getArticleRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(ARTICLE_SELECTOR);
}

function isSkippedText(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || parent.closest("pre") !== null;
}

function buildTextMap(root: HTMLElement): TextMap {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: TextSegment[] = [];
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    if (isSkippedText(textNode)) continue;
    const start = text.length;
    text += textNode.data;
    segments.push({ node: textNode, start, end: text.length });
  }
  return { text, segments };
}

export function articleText(root: HTMLElement): string {
  return buildTextMap(root).text;
}

/** Map a live selection Range to {start,end} character offsets in the article. */
export function rangeToOffsets(
  root: HTMLElement,
  range: Range
): { start: number; end: number } | null {
  const map = buildTextMap(root);
  const start = pointToOffset(map, range.startContainer, range.startOffset);
  const end = pointToOffset(map, range.endContainer, range.endOffset);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

function pointToOffset(map: TextMap, container: Node, offset: number): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const segment = map.segments.find((s) => s.node === container);
    return segment ? segment.start + offset : null;
  }
  // Element container: `offset` is a child index. Use the first text segment
  // at or after that child, falling back to the end of the article.
  const child = container.childNodes[offset] ?? null;
  if (!child) return map.text.length;
  for (const segment of map.segments) {
    const position = child.compareDocumentPosition(segment.node);
    if (
      segment.node === child ||
      position & Node.DOCUMENT_POSITION_CONTAINED_BY ||
      position & Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      return segment.start;
    }
  }
  return map.text.length;
}

/** Wrap the offset range in <mark> elements (one per spanned text node). */
export function paintAnnotation(
  root: HTMLElement,
  range: { start: number; end: number },
  meta: { id: string; color: string }
): HTMLElement[] {
  const map = buildTextMap(root);
  // Capture every spanned text-node fragment before mutating the DOM; each
  // fragment lives in a distinct node, so wrapping one never invalidates another.
  const fragments: { node: Text; from: number; to: number }[] = [];
  for (const segment of map.segments) {
    const from = Math.max(range.start, segment.start);
    const to = Math.min(range.end, segment.end);
    if (from >= to) continue;
    fragments.push({ node: segment.node, from: from - segment.start, to: to - segment.start });
  }

  const marks: HTMLElement[] = [];
  for (const fragment of fragments) {
    try {
      const domRange = document.createRange();
      domRange.setStart(fragment.node, fragment.from);
      domRange.setEnd(fragment.node, fragment.to);
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_CLASS;
      mark.dataset.annotationId = meta.id;
      mark.dataset.color = meta.color;
      domRange.surroundContents(mark);
      marks.push(mark);
    } catch {
      // surroundContents throws if the range partially selects a non-text node;
      // skip that fragment rather than break the whole repaint.
    }
  }
  return marks;
}

/** Unwrap every annotation <mark>, restoring the original text nodes. */
export function clearAnnotationHighlights(root: HTMLElement): void {
  const marks = root.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`);
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/** Scroll the first <mark> for an annotation into view and flash it. */
export function scrollToAnnotation(root: HTMLElement, id: string): void {
  const mark = root.querySelector<HTMLElement>(
    `mark.${HIGHLIGHT_CLASS}[data-annotation-id="${CSS.escape(id)}"]`
  );
  if (!mark) return;
  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  mark.classList.add("is-flashing");
  window.setTimeout(() => mark.classList.remove("is-flashing"), 1200);
}
