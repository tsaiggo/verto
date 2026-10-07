import { firstProseParagraph } from "./prose-summary";

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
  return { description: description || firstProseParagraph(body, 200, ellipsis), dek: description };
}
