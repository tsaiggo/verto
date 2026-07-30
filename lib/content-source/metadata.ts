export function titleFromFilename(base: string): string {
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Find the first H1 outside fenced code blocks. */
export function firstH1(source: string): string | undefined {
  const lines = source.split("\n");
  let inCode = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (match) return match[1]?.trim();
  }
  return undefined;
}

/** Find and normalize the first prose paragraph outside headings and code. */
function firstParagraph(source: string, max = 200, ellipsis = "…"): string | undefined {
  const lines = source.split("\n");
  let inCode = false;
  const buffer: string[] = [];
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (inCode && buffer.length > 0) break;
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const trimmed = line.trim();
    if (trimmed === "") {
      if (buffer.length > 0) break;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      if (buffer.length > 0) break;
      continue;
    }
    buffer.push(trimmed);
  }
  if (buffer.length === 0) return undefined;
  const text = buffer
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}${ellipsis}` : text;
}

/** Keep SEO description fallback and visible frontmatter dek semantics aligned. */
export function deriveDescription(
  frontmatter: Record<string, unknown>,
  body: string,
  ellipsis = "…"
): { description?: string; dek?: string } {
  const description =
    typeof frontmatter.description === "string" && frontmatter.description.trim()
      ? frontmatter.description.trim()
      : undefined;
  return { description: description || firstParagraph(body, 200, ellipsis), dek: description };
}
