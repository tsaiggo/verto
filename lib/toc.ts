import GithubSlugger from "github-slugger";
import type { TOCItem, TocConfig } from "@/lib/types";

/**
 * Slugify a heading string using the same algorithm as `rehype-slug`
 * (which uses `github-slugger` under the hood). This guarantees the
 * generated `id` matches the `id` attribute placed on the rendered
 * `<h*>` element, so TOC anchor links resolve correctly — including
 * for headings containing CJK or other non-ASCII characters.
 */

/**
 * Extract a table of contents from raw MDX source.
 *
 * Parses headings between `minDepth` (default 2) and `maxDepth` (default 3).
 * h1 is excluded by default since it represents the page title.
 *
 * Skipped:
 *  - Headings inside fenced code blocks
 *  - Headings inside HTML comments
 *
 * Generated `id` values match what `rehype-slug` would produce.
 */
export function extractTOC(rawMdx: string, config: TocConfig = {}): TOCItem[] {
  const minDepth = clampDepth(config.minDepth ?? 2);
  const maxDepth = clampDepth(config.maxDepth ?? 3);
  if (minDepth > maxDepth) return [];

  const lines = rawMdx.split("\n");
  const items: TOCItem[] = [];
  const slugger = new GithubSlugger();
  let inCodeBlock = false;
  let inHtmlComment = false;

  for (const rawLine of lines) {
    const line = rawLine;

    // HTML comment span tracking (single-line or multi-line)
    if (inHtmlComment) {
      if (line.includes("-->")) inHtmlComment = false;
      continue;
    }
    if (line.includes("<!--") && !line.includes("-->")) {
      inHtmlComment = true;
      continue;
    }

    // Toggle code block state on fenced code markers
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    // Match h1-h6 headings; filter by configured depth range.
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const level = match[1].length;
    if (level < minDepth || level > maxDepth) continue;
    // Converted books preserve the publisher's stable anchor inside the heading.
    // Only this exact generated span shape gets special handling; ordinary MDX
    // headings retain their existing title and slug behavior.
    const bookHeading = line.match(
      /^#{1,6}[ \t]+((?:<span id="epub-[\p{L}\p{N}-]+" \/>[ \t]*)+)([^\r\n]+)$/u
    );
    const text = bookHeading
      ? epubHeadingText(bookHeading[2].replace(/[ \t]+#+[ \t]*$/, ""))
      : match[2].trim();
    const generatedId = slugger.slug(text);
    items.push({
      id: bookHeading ? /id="([^"]+)"/.exec(bookHeading[1])![1] : generatedId,
      text,
      level,
    });
  }

  return items;
}

/** Decode the serializer's literal escapes without interpreting MDX or inline HTML. */
function epubHeadingText(heading: string): string {
  return heading
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1")
    .replace(
      /&#(?:x([0-9a-f]+)|(\d+));|&(amp|lt|gt|quot|apos);/gi,
      (reference, hex, decimal, name) => {
        if (name)
          return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[
            name.toLowerCase()
          ];
        const point = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
        return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point)
          : reference;
      }
    )
    .trim();
}

function clampDepth(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.min(6, Math.max(1, Math.floor(n)));
}
