import type { Element } from "hast";
import { resolveEpubPath } from "@/lib/document-import/epub";
import type { BookTocItem, ConversionIssue } from "./types";
import {
  list,
  nodeText,
  parseHtml,
  property,
  readArchiveText,
  walkElements,
  xmlParser,
  xmlText,
  type BookArchive,
  type ConversionChapter,
} from "./convert-archive";

export function resolveChapterLink(
  chapters: ConversionChapter[],
  from: string,
  href: string
): { chapter: ConversionChapter; anchor?: string } | null {
  const path = href.startsWith("#") ? from : resolveEpubPath(from, href);
  const chapter = chapters.find((candidate) => candidate.path === path);
  if (!chapter) return null;
  if (!href.includes("#") || !href.split("#")[1]) return { chapter };
  let fragment: string;
  try {
    fragment = decodeURIComponent(href.slice(href.indexOf("#") + 1));
  } catch {
    return null;
  }
  const anchor = chapter.anchors.get(fragment);
  return anchor ? { chapter, anchor } : null;
}
function elements(node: Element, tag: string): Element[] {
  return node.children.filter(
    (child): child is Element => child.type === "element" && child.tagName === tag
  );
}
function readHtmlList(
  ol: Element,
  path: string,
  chapters: ConversionChapter[],
  issues: ConversionIssue[]
): BookTocItem[] {
  const items: BookTocItem[] = [];
  for (const li of elements(ol, "li")) {
    const nested = elements(li, "ol").flatMap((child) =>
      readHtmlList(child, path, chapters, issues)
    );
    const label = li.children.find(
      (node): node is Element => node.type === "element" && ["a", "span"].includes(node.tagName)
    );
    const target =
      label?.tagName === "a" ? resolveChapterLink(chapters, path, property(label, "href")) : null;
    if (label?.tagName === "a" && !target)
      issues.push({
        code: "toc-link",
        message: `The table-of-contents link “${nodeText(label)}” has no readable local target.`,
      });
    if (target || nested.length)
      items.push({
        title: label ? nodeText(label).trim() : nested[0].title,
        articleId: target?.chapter.articleId ?? nested[0].articleId,
        ...(target?.anchor ? { anchor: target.anchor } : {}),
        children: nested,
      });
  }
  return items;
}
function readNcxPoints(
  points: unknown,
  path: string,
  chapters: ConversionChapter[],
  issues: ConversionIssue[]
): BookTocItem[] {
  const result: BookTocItem[] = [];
  for (const point of list<Record<string, unknown>>(points as Record<string, unknown>[])) {
    const target = resolveChapterLink(
      chapters,
      path,
      String((point.content as Record<string, unknown>)?.["@_src"] ?? "")
    );
    const children = readNcxPoints(point.navPoint, path, chapters, issues);
    const title = xmlText((point.navLabel as Record<string, unknown>)?.text) ?? "Chapter";
    if (!target)
      issues.push({
        code: "toc-link",
        message: `The table-of-contents link “${title}” has no readable local target.`,
      });
    if (target || children.length)
      result.push({
        title,
        articleId: target?.chapter.articleId ?? children[0].articleId,
        ...(target?.anchor ? { anchor: target.anchor } : {}),
        children,
      });
  }
  return result;
}
export async function readBookToc(
  archive: BookArchive,
  chapters: ConversionChapter[],
  issues: ConversionIssue[]
): Promise<BookTocItem[]> {
  let toc: BookTocItem[] = [];
  const nav = archive.manifest.find((item) => /(?:^|\s)nav(?:\s|$)/.test(item.properties));
  const ncx = archive.manifest.find((item) => item.mime === "application/x-dtbncx+xml");
  if (nav) {
    const tree = parseHtml(await readArchiveText(archive.zip, nav.path));
    let tocNav: Element | undefined;
    walkElements(tree, (node) => {
      if (
        node.tagName === "nav" &&
        (property(node, "epub:type").split(/\s+/).includes("toc") ||
          property(node, "role") === "doc-toc")
      )
        tocNav = node;
    });
    const ol = tocNav ? elements(tocNav, "ol")[0] : undefined;
    if (ol) toc = readHtmlList(ol, nav.path, chapters, issues);
    else
      issues.push({
        code: "toc-unreadable",
        message:
          "The EPUB navigation document has no readable table of contents. Chapter order is preserved.",
      });
  } else if (ncx) {
    const tree = xmlParser.parse(await readArchiveText(archive.zip, ncx.path));
    toc = readNcxPoints(tree?.ncx?.navMap?.navPoint, ncx.path, chapters, issues);
  }
  const covered = new Set<string>();
  const collect = (items: BookTocItem[]) => {
    for (const item of items) {
      covered.add(item.articleId);
      collect(item.children);
    }
  };
  collect(toc);
  for (const chapter of chapters)
    if (!covered.has(chapter.articleId))
      toc.push({ title: chapter.title, articleId: chapter.articleId, children: [] });
  return toc;
}
