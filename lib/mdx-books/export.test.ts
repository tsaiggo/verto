import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createBrowserArticle } from "@/lib/browser-articles";
import { createMdxBookZip } from "./export";
import type { MdxBookSnapshot } from "./types";

function snapshot(): MdxBookSnapshot {
  const root = {
    ...createBrowserArticle({ filename: "index.mdx", source: "# Book\n", status: "saved" }),
    id: "root",
    title: "Book",
  };
  const chapter = {
    ...createBrowserArticle({
      filename: "renamed.mdx",
      source: "\uFEFF# Edited chapter\r\n\r\n![Cover](./assets/cover.png)\r\n",
      parentId: root.id,
      status: "saved",
    }),
    id: "chapter",
  };
  return {
    book: {
      id: "book",
      rootArticleId: root.id,
      sourceDocumentId: "original-epub",
      title: "Reading guide",
      author: "A Writer",
      language: "en",
      createdAt: "2026-10-02T00:00:00Z",
      chapterFiles: [
        { articleId: chapter.id, filename: "001-chapter.mdx", originalPath: "OPS/chapter.xhtml" },
      ],
      toc: [{ title: "Part one", articleId: chapter.id, anchor: "section", children: [] }],
    },
    articles: [root, chapter],
    assets: [
      {
        id: "cover",
        bookId: "book",
        filename: "cover.png",
        mime: "image/png",
        bytes: Uint8Array.from([137, 80, 78, 71, 0, 255]).buffer,
      },
    ],
  };
}
async function archive(value: MdxBookSnapshot) {
  const result = await createMdxBookZip(value);
  return { ...result, zip: await JSZip.loadAsync(await result.blob.arrayBuffer()) };
}

describe("portable edited MDX book export", () => {
  it("packages the exact latest saved sources, stable chapter filenames, image bytes and portable nested TOC", async () => {
    const book = snapshot();
    const child = {
      ...createBrowserArticle({
        filename: "notes.mdx",
        source: "# My note",
        parentId: "chapter",
        status: "saved",
      }),
      id: "note",
    };
    book.articles.push(child);
    book.book.toc[0].children.push({ title: "My note", articleId: child.id, children: [] });
    const { zip, filename, issues } = await archive(book);
    expect(filename).toBe("Reading-guide.zip");
    expect(await zip.file("Reading-guide/001-chapter.mdx")!.async("string")).toBe(
      book.articles[1].source
    );
    expect(await zip.file("Reading-guide/notes.mdx")!.async("string")).toBe(child.source);
    expect(await zip.file("Reading-guide/assets/cover.png")!.async("uint8array")).toEqual(
      new Uint8Array(book.assets[0].bytes)
    );
    const manifest = JSON.parse(await zip.file("Reading-guide/book.json")!.async("string"));
    expect(manifest).toMatchObject({
      root: "index.mdx",
      author: "A Writer",
      language: "en",
      toc: [{ href: "./001-chapter.mdx#section", children: [{ href: "./notes.mdx" }] }],
    });
    expect(manifest.pages.find((page: { id: string }) => page.id === "note").parent).toBe(
      "001-chapter.mdx"
    );
    expect(zip.file("Reading-guide/README.md")).not.toBeNull();
    expect(issues).toEqual([]);
  });
  it("reports removed chapters and promotes surviving nested TOC entries without exporting missing pages", async () => {
    const book = snapshot();
    book.articles = [book.articles[0]];
    book.book.toc[0].children.push({ title: "Home", articleId: "root", children: [] });
    const { zip, issues } = await archive(book);
    expect(zip.file("Reading-guide/001-chapter.mdx")).toBeNull();
    expect(issues[0].code).toBe("removed-chapter");
    expect(await zip.file("Reading-guide/export-report.md")!.async("string")).toContain(
      "001-chapter.mdx has been removed"
    );
    const manifest = JSON.parse(await zip.file("Reading-guide/book.json")!.async("string"));
    expect(manifest.toc).toEqual([{ title: "Home", href: "./index.mdx", children: [] }]);
  });
  it("keeps original filenames reserved and gives colliding or Windows-invalid new pages safe unique names", async () => {
    const book = snapshot();
    book.book.title = "CON";
    book.articles.push(
      {
        ...createBrowserArticle({
          filename: "001-chapter.mdx",
          source: "Collision",
          status: "saved",
        }),
        id: "new-note",
      },
      {
        ...createBrowserArticle({ filename: "aux.mdx", source: "Reserved", status: "saved" }),
        id: "reserved-note",
      }
    );
    const { zip, filename } = await archive(book);
    expect(filename).toBe("book-CON.zip");
    expect(await zip.file("book-CON/page-new-note.mdx")!.async("string")).toBe("Collision");
    expect(await zip.file("book-CON/page-reserved-note.mdx")!.async("string")).toBe("Reserved");
  });
  it("refuses a missing book home and invalid or duplicate imported filenames", async () => {
    const missing = snapshot();
    missing.articles.shift();
    await expect(createMdxBookZip(missing)).rejects.toThrow("main page is missing");
    for (const filename of ["../escaped.mdx", "index.mdx", "bad?.mdx", "chapter.mdx."]) {
      const book = snapshot();
      book.book.chapterFiles[0].filename = filename;
      await expect(createMdxBookZip(book)).rejects.toThrow("invalid or duplicate chapter");
    }
  });
  it("refuses unowned, duplicate or unsafe image names before creating a ZIP", async () => {
    const unowned = snapshot();
    unowned.assets[0].bookId = "another-book";
    await expect(createMdxBookZip(unowned)).rejects.toThrow("invalid filename or ownership");
    const duplicate = snapshot();
    duplicate.assets.push({ ...duplicate.assets[0], id: "duplicate" });
    await expect(createMdxBookZip(duplicate)).rejects.toThrow("invalid filename or ownership");
    const traversal = snapshot();
    traversal.assets[0].filename = "../cover.png";
    await expect(createMdxBookZip(traversal)).rejects.toThrow("invalid filename or ownership");
  });
  it("uses a default directory for a title without filename characters", async () => {
    const book = snapshot();
    book.book.title = "🎉";
    expect((await createMdxBookZip(book)).filename).toBe("mdx-book.zip");
  });
});
