import type { TOCItem } from "@/lib/types";

/**
 * Slugify a heading string to match rehype-slug / GitHub Slugger behavior.
 *
 * - Lowercase
 * - Strip characters that aren't alphanumeric, hyphens, or spaces
 * - Replace spaces with hyphens
 * - Collapse consecutive hyphens
 * - Trim leading/trailing hyphens
 */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract a table of contents from raw MDX source.
 *
 * Parses h2 (`##`) and h3 (`###`) headings only (h1 is excluded as it
 * represents the page title). Headings inside fenced code blocks are ignored.
 *
 * Generated `id` values match what `rehype-slug` would produce.
 */
export function extractTOC(rawMdx: string): TOCItem[] {
  const lines = rawMdx.split("\n");
  const items: TOCItem[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Toggle code block state on fenced code markers
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    // Match h2 and h3 headings (## or ### followed by a space)
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length as 2 | 3;
      const text = match[2].trim();
      items.push({
        id: slugify(text),
        text,
        level,
      });
    }
  }

  return items;
}
