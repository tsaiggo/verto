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
    const text = match[2].trim();
    items.push({
      id: slugger.slug(text),
      text,
      level,
    });
  }

  return items;
}

function clampDepth(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.min(6, Math.max(1, Math.floor(n)));
}
