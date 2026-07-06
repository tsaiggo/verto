import type { ContentFileNode } from "./types";

/** Normalise a frontmatter `toc` value into the reader's TOC config shape. */
function parseToc(fmToc: unknown): ContentFileNode["toc"] {
  if (fmToc === false) return false;
  if (fmToc && typeof fmToc === "object" && !Array.isArray(fmToc)) {
    const t = fmToc as Record<string, unknown>;
    return {
      minDepth: typeof t.minDepth === "number" ? t.minDepth : undefined,
      maxDepth: typeof t.maxDepth === "number" ? t.maxDepth : undefined,
    };
  }
  return undefined;
}

/**
 * Coerce the loosely-typed frontmatter record into the strongly-typed subset
 * of fields a {@link ContentFileNode} carries, applying the draft/prod
 * visibility rule. Kept separate from tree assembly so `tree.ts` stays focused
 * on structure rather than per-field parsing.
 */
export function coerceFrontmatter(fm: Record<string, unknown>, isProd: boolean) {
  const t = Array.isArray(fm.tags)
    ? fm.tags.filter((t): t is string => typeof t === "string")
    : undefined;
  const s = typeof fm.status === "string" && fm.status.trim() ? fm.status.trim() : undefined;
  return {
    date: typeof fm.date === "string" ? fm.date : undefined,
    author: typeof fm.author === "string" ? fm.author : undefined,
    tags: t,
    status: s,
    order: typeof fm.order === "number" ? fm.order : undefined,
    cover: typeof fm.cover === "string" ? fm.cover : undefined,
    draft: fm.draft === true ? true : undefined,
    updated: typeof fm.updated === "string" ? fm.updated : undefined,
    lang: typeof fm.lang === "string" ? fm.lang : undefined,
    toc: parseToc(fm.toc),
    hidden: fm.hidden === true || (fm.draft === true && isProd) ? true : undefined,
  };
}
