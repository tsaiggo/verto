// Text-quote anchoring for reader annotations.
//
// A highlight is stored as a quote plus a little surrounding context and an
// offset hint, not as raw DOM offsets, so it survives minor edits to the
// document and can be re-located on a later visit even when surrounding content
// has shifted. This mirrors the W3C Web Annotation text-quote + text-position
// selectors. `locateAnchor` is a pure string search and is fully unit-tested;
// the DOM bridge that turns a live Range into offsets lives separately.

const CONTEXT_LENGTH = 32;

export interface TextAnchor {
  /** The exact selected text. */
  quote: string;
  /** Up to CONTEXT_LENGTH characters immediately before the quote. */
  prefix: string;
  /** Up to CONTEXT_LENGTH characters immediately after the quote. */
  suffix: string;
  /** Character offset of the quote in the article text when created (a hint). */
  start: number;
}

export function describeRange(text: string, start: number, end: number): TextAnchor {
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + CONTEXT_LENGTH),
    start,
  };
}

export function locateAnchor(
  text: string,
  anchor: TextAnchor
): { start: number; end: number } | null {
  const { quote } = anchor;
  if (quote === "") return null;

  const positions: number[] = [];
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
    positions.push(i);
  }
  if (positions.length === 0) return null;
  if (positions.length === 1) {
    return { start: positions[0], end: positions[0] + quote.length };
  }

  // Several matches: prefer the one whose surrounding context best matches,
  // breaking ties by proximity to the original offset.
  let best = positions[0];
  let bestScore = -Infinity;
  for (const pos of positions) {
    const before = text.slice(Math.max(0, pos - anchor.prefix.length), pos);
    const after = text.slice(pos + quote.length, pos + quote.length + anchor.suffix.length);
    const score =
      commonSuffixLength(before, anchor.prefix) +
      commonPrefixLength(after, anchor.suffix) -
      Math.abs(pos - anchor.start) * 0.001;
    if (score > bestScore) {
      bestScore = score;
      best = pos;
    }
  }
  return { start: best, end: best + quote.length };
}

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

function commonSuffixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}
