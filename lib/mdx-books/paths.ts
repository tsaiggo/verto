import { browserArticleHref } from "@/lib/browser-articles";
import type { MdxBookSnapshot } from "./types";

/** A body example must never opt an ordinary article into managed book loading. */
export function bookIdInSource(source: string): string | null {
  const header = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source)?.[1];
  return header
    ? (/^vertoBookId:[ \t]*["']?([\w-]+)["']?[ \t]*$/m.exec(header)?.[1] ?? null)
    : null;
}

/** Resolve only portable relative book paths; remote URLs never become local assets. */
export function portableBookPath(value: string): { path: string; fragment: string } | null {
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//") || value.startsWith("/"))
    return null;
  const hash = value.indexOf("#");
  const raw = hash < 0 ? value : value.slice(0, hash);
  let path: string;
  try {
    path = decodeURIComponent(raw.split("?")[0]);
  } catch {
    return null;
  }
  path = path.replace(/^\.\//, "");
  if (path.includes("\\") || path.includes("\0") || path.split("/").includes("..")) return null;
  return { path, fragment: hash < 0 ? "" : value.slice(hash) };
}

export function bookPageLinks(snapshot: MdxBookSnapshot): Map<string, string> {
  const files = new Map<string, string>();
  const reserved = new Set([
    "index.mdx",
    ...snapshot.book.chapterFiles.map((item) => item.filename),
  ]);
  const currentIds = new Set(snapshot.articles.map((article) => article.id));
  if (currentIds.has(snapshot.book.rootArticleId))
    files.set("index.mdx", browserArticleHref(snapshot.book.rootArticleId));
  for (const chapter of snapshot.book.chapterFiles) {
    if (currentIds.has(chapter.articleId))
      files.set(chapter.filename, browserArticleHref(chapter.articleId));
  }
  // New pages can participate without changing the immutable imported file mapping.
  for (const article of snapshot.articles)
    if (!reserved.has(article.filename) && !files.has(article.filename))
      files.set(article.filename, browserArticleHref(article.id));
  return files;
}

export function resolveBookHref(href: string, pages: Map<string, string>): string | undefined {
  if (href.startsWith("#")) return href;
  const target = portableBookPath(href);
  if (!target) return href;
  const route = pages.get(target.path);
  if (route) return `${route}${target.fragment}`;
  return /\.mdx?$/i.test(target.path) ? undefined : href;
}
