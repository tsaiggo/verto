import JSZip from "jszip";
import { validBookFilename } from "./storage-validation";
import type { BookTocItem, ConversionIssue, MdxBookSnapshot } from "./types";

export interface MdxBookExport {
  blob: Blob;
  filename: string;
  issues: ConversionIssue[];
}

function safeFilename(value: string) {
  return validBookFilename(value);
}
interface ExportTocItem {
  title: string;
  href?: string;
  children: ExportTocItem[];
}
function portableToc(
  items: BookTocItem[],
  files: Map<string, string>,
  present: Set<string>
): ExportTocItem[] {
  return items.flatMap((item) => {
    const children = portableToc(item.children, files, present);
    const file = files.get(item.articleId);
    if (!file || !present.has(item.articleId)) return children;
    return [
      { title: item.title, href: `./${file}${item.anchor ? `#${item.anchor}` : ""}`, children },
    ];
  });
}
function exportFiles(snapshot: MdxBookSnapshot): Map<string, string> {
  const files = new Map([[snapshot.book.rootArticleId, "index.mdx"]]);
  const used = new Set(["index.mdx"]);
  for (const chapter of snapshot.book.chapterFiles) {
    if (!safeFilename(chapter.filename) || used.has(chapter.filename.toLowerCase()))
      throw new Error("The saved book has invalid or duplicate chapter filenames.");
    files.set(chapter.articleId, chapter.filename);
    used.add(chapter.filename.toLowerCase());
  }
  for (const article of snapshot.articles) {
    if (files.has(article.id)) continue;
    let name = article.filename;
    if (!safeFilename(name) || used.has(name.toLowerCase())) name = `page-${article.id}.mdx`;
    if (!safeFilename(name) || used.has(name.toLowerCase()))
      throw new Error("A page cannot be exported safely.");
    used.add(name.toLowerCase());
    files.set(article.id, name);
  }
  return files;
}

/** Exports a coherent saved snapshot; current editor drafts are not mistaken for saved pages. */
export async function createMdxBookZip(snapshot: MdxBookSnapshot): Promise<MdxBookExport> {
  const root = snapshot.articles.find((article) => article.id === snapshot.book.rootArticleId);
  if (!root) throw new Error("The book's main page is missing. Restore it before exporting.");
  const files = exportFiles(snapshot);
  const suggestedName =
    snapshot.book.title
      .normalize("NFKC")
      .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "mdx-book";
  const packageName = safeFilename(suggestedName) ? suggestedName : `book-${suggestedName}`;
  const zip = new JSZip();
  const folder = zip.folder(packageName)!;
  const issues: ConversionIssue[] = [];
  const present = new Set(snapshot.articles.map((article) => article.id));
  for (const chapter of snapshot.book.chapterFiles)
    if (!present.has(chapter.articleId))
      issues.push({
        code: "removed-chapter",
        chapter: chapter.filename,
        message: `${chapter.filename} has been removed from the library and is not included.`,
      });
  const assetNames = new Set<string>();
  for (const asset of snapshot.assets) {
    if (
      asset.bookId !== snapshot.book.id ||
      !safeFilename(asset.filename) ||
      assetNames.has(asset.filename.toLowerCase())
    )
      throw new Error("A book image has an invalid filename or ownership.");
    assetNames.add(asset.filename.toLowerCase());
    folder.file(`assets/${asset.filename}`, asset.bytes);
  }
  for (const article of snapshot.articles) {
    folder.file(files.get(article.id)!, article.source);
  }
  folder.file(
    "book.json",
    JSON.stringify(
      {
        title: root.title ?? snapshot.book.title,
        author: snapshot.book.author,
        language: snapshot.book.language,
        sourceDocumentId: snapshot.book.sourceDocumentId,
        root: "index.mdx",
        pages: snapshot.articles.map((article) => ({
          id: article.id,
          title: article.title,
          file: files.get(article.id),
          parent:
            article.parentId && present.has(article.parentId) ? files.get(article.parentId) : null,
        })),
        toc: portableToc(snapshot.book.toc, files, present),
        issues,
      },
      null,
      2
    )
  );
  folder.file(
    "README.md",
    "# MDX book\n\nOpen index.mdx to begin. Chapter files and assets use portable relative paths.\nThe original EPUB remains in Verto's library. This archive contains the latest saved pages.\n"
  );
  if (issues.length)
    folder.file("export-report.md", issues.map((issue) => `- ${issue.message}`).join("\n") + "\n");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, filename: `${packageName}.zip`, issues };
}
