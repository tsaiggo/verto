import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeMdxRenderer } from "safe-mdx";
import { createMdxProcessor } from "safe-mdx/parse";
import type { Root } from "mdast";
import type { ImportedDocument } from "@/lib/imported-documents";
import { convertEpubToMdx } from "./convert";
import { collectBookAssets } from "./convert-html";
import { openConversionArchive } from "./convert-archive";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64"
  )
);
interface FixtureOptions {
  version?: 2 | 3;
  chapter?: string;
  notes?: string;
  extraPackage?: string;
  secondImage?: Uint8Array;
  missing?: string;
}
async function fixture(options: FixtureOptions = {}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'
  );
  zip.file(
    "OPS/book.opf",
    `<package version="${options.version ?? 3}.0"><metadata xmlns:dc="urn:dc"><dc:title>A book {about} reading</dc:title><dc:creator>A Writer</dc:creator><dc:language>en</dc:language>${options.extraPackage ?? ""}</metadata><manifest><item id="one" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="text/two.xhtml" media-type="application/xhtml+xml"/><item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/><item id="a" href="images/cover.png" media-type="image/png"/><item id="b" href="other/cover.png" media-type="image/png"/>${options.version === 2 ? '<item id="nav" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' : '<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>'}</manifest><spine toc="nav"><itemref idref="one"/><itemref idref="two"/><itemref idref="notes" linear="no"/></spine></package>`
  );
  zip.file(
    "OPS/text/one.xhtml",
    `<html xmlns:epub="http://www.idpf.org/2007/ops"><body>${options.chapter ?? '<h1 id="intro">First chapter</h1><p>Use {value} and &lt;Literal&gt; as plain text. 中文章节。</p><p><a href="two.xhtml#target">Next chapter</a><sup><a epub:type="noteref" id="ref1" href="../notes.xhtml#note1">1</a></sup></p><p><img src="../images/cover.png" alt="First cover"/><img src="../images/cover.png" alt="Repeated cover"/></p><table><tr><th>Item</th><th>Value</th></tr><tr><td>Reading</td><td>Good</td></tr></table>'}</body></html>`
  );
  zip.file(
    "OPS/text/two.xhtml",
    '<html><body><h1 id="target">Second chapter</h1><p><a href="one.xhtml#intro">Back to first</a></p><img src="../other/cover.png" alt="Another cover"/></body></html>'
  );
  zip.file(
    "OPS/notes.xhtml",
    `<html xmlns:epub="http://www.idpf.org/2007/ops"><body>${options.notes ?? '<h1>Notes</h1><aside epub:type="footnote" id="note1"><p>The full footnote stays editable. <a href="text/one.xhtml#ref1">Return to passage</a></p></aside>'}</body></html>`
  );
  zip.file("OPS/images/cover.png", PNG);
  zip.file("OPS/other/cover.png", options.secondImage ?? PNG);
  zip.file(
    "OPS/nav.xhtml",
    '<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="text/one.xhtml#intro">Part one</a><ol><li><a href="text/two.xhtml#target">A nested chapter</a></li></ol></li><li><a href="notes.xhtml#note1">Notes</a></li></ol></nav></body></html>'
  );
  zip.file(
    "OPS/toc.ncx",
    '<ncx><navMap><navPoint><navLabel><text>Part one</text></navLabel><content src="text/one.xhtml#intro"/><navPoint><navLabel><text>A nested chapter</text></navLabel><content src="text/two.xhtml#target"/></navPoint></navPoint></navMap></ncx>'
  );
  if (options.missing) zip.remove(options.missing);
  return zip.generateAsync({ type: "arraybuffer" });
}
function source(bytes: ArrayBuffer): ImportedDocument {
  return {
    id: "source-epub",
    filename: "source.epub",
    title: "Source",
    format: "epub",
    byteLength: bytes.byteLength,
    createdAt: "2026-10-02T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
    revision: 3,
  };
}

describe("editable MDX book conversion", () => {
  it("builds a parent page, saved chapter pages, nested EPUB3 TOC and source revision", async () => {
    const bytes = await fixture();
    const draft = await convertEpubToMdx(bytes, source(bytes));
    expect(draft.book.title).toBe("A book {about} reading");
    expect(draft.sourceRevision).toBe(3);
    expect(draft.articles).toHaveLength(4);
    expect(draft.articles[0]).toMatchObject({
      id: draft.book.rootArticleId,
      filename: "index.mdx",
      parentId: null,
      revision: 0,
      status: "saved",
    });
    expect(
      draft.articles
        .slice(1)
        .every(
          (article) =>
            article.parentId === draft.book.rootArticleId &&
            article.status === "saved" &&
            article.revision === 0
        )
    ).toBe(true);
    expect(draft.book.toc[0]).toMatchObject({
      title: "Part one",
      anchor: "epub-001-intro",
      children: [{ title: "A nested chapter", anchor: "epub-002-target" }],
    });
    expect(draft.articles[0].source).toContain(
      "  - [A nested chapter](./002-second-chapter.mdx#epub-002-target)"
    );
    expect(
      draft.articles.every((article) => article.source.includes(`vertoBookId: "${draft.book.id}"`))
    ).toBe(true);
    expect(draft.book.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("uses a whole-book asset registry, deduplicating repeated and cross-path identical images", async () => {
    const bytes = await fixture();
    const draft = await convertEpubToMdx(bytes, source(bytes));
    expect(draft.assets).toHaveLength(1);
    expect(draft.assets[0].filename).toBe("image-001-cover.png");
    expect(new Uint8Array(draft.assets[0].bytes)).toEqual(PNG);
    expect(draft.assets[0].mime).toBe("image/png");
    expect(draft.articles[1].source.match(/\.\/assets\/image-001-cover.png/g)).toHaveLength(2);
    expect(draft.articles[2].source).toContain("./assets/image-001-cover.png");
  });
  it("prevents same-basename image collisions when their bytes differ", async () => {
    const other = PNG.slice();
    other[other.length - 1] ^= 1;
    const bytes = await fixture({ secondImage: other });
    const draft = await convertEpubToMdx(bytes, source(bytes));
    expect(draft.assets.map((asset) => asset.filename)).toEqual([
      "image-001-cover.png",
      "image-002-cover.png",
    ]);
    expect(draft.articles[2].source).toContain("./assets/image-002-cover.png");
  });
  it("preserves chapter anchors, non-linear footnote text, references and return links", async () => {
    const bytes = await fixture();
    const draft = await convertEpubToMdx(bytes, source(bytes));
    expect(draft.articles[1].source).toContain(
      "[Next chapter](./002-second-chapter.mdx#epub-002-target)"
    );
    expect(draft.articles[1].source).toContain('id="epub-001-ref1"');
    expect(draft.articles[1].source).toContain("./003-notes.mdx#epub-003-note1");
    expect(draft.articles[3].source).toContain("The full footnote stays editable.");
    expect(draft.articles[3].source).toContain("./001-first-chapter.mdx#epub-001-ref1");
    expect(draft.articles[3].source).toContain('id="epub-003-note1"');
  });
  it("converts EPUB2 NCX nesting and appends supplemental chapters absent from its TOC", async () => {
    const bytes = await fixture({ version: 2 });
    const draft = await convertEpubToMdx(bytes, source(bytes));
    expect(draft.book.toc[0].children[0].title).toBe("A nested chapter");
    expect(draft.book.toc[1].title).toBe("Notes");
  });
  it("produces MDX that parses and renders literal braces, angles, CJK, tables and image descriptions", async () => {
    const bytes = await fixture();
    const draft = await convertEpubToMdx(bytes, source(bytes));
    const processor = createMdxProcessor({ remarkPlugins: [] });
    const mdast = processor.runSync(processor.parse(draft.articles[1].source)) as Root;
    const rendered = renderToStaticMarkup(
      createElement(SafeMdxRenderer, { markdown: draft.articles[1].source, mdast })
    );
    expect(rendered).toContain("Use {value} and &lt;Literal&gt; as plain text. 中文章节。");
    expect(rendered).toContain("<table>");
    expect(rendered).toContain('id="epub-001-intro"');
  });
  it("preserves prose that starts with MDX import/export keywords as literal text", async () => {
    const bytes = await fixture({
      chapter:
        '<h1>Syntax</h1><p>import x from "module"</p><p>export const value = {message: "literal"}</p><pre><code>{"example": 1}</code></pre>',
    });
    const draft = await convertEpubToMdx(bytes, source(bytes));
    const processor = createMdxProcessor({ remarkPlugins: [] });
    const mdast = processor.runSync(processor.parse(draft.articles[1].source)) as Root;
    const rendered = renderToStaticMarkup(
      createElement(SafeMdxRenderer, { markdown: draft.articles[1].source, mdast })
    );
    expect(rendered).toContain("import x from &quot;module&quot;");
    expect(rendered).toContain("export const value = {message: &quot;literal&quot;}");
  });
  it("reports discarded unsafe or unsupported content and never keeps remote resource URLs", async () => {
    const bytes = await fixture({
      chapter:
        '<h1>Safety</h1><p>Retained text.</p><script>globalThis.secret()</script><img src="https://tracker.example/pixel" alt="Remote cover"/><img src="../missing.png" alt="Missing cover"/><svg aria-label="Diagram unavailable"><script>bad()</script></svg><a href="javascript:bad()">Unsafe link</a>',
    });
    const draft = await convertEpubToMdx(bytes, source(bytes));
    const text = draft.articles[1].source;
    expect(text).not.toMatch(/tracker\.example|secret\(|javascript:|<script|<svg/);
    expect(text).toContain("Remote cover");
    expect(text).toContain("Missing cover");
    expect(text).toContain("Diagram unavailable");
    expect(draft.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "remote-image",
        "image-unavailable",
        "unsupported-element",
        "internal-link",
      ])
    );
  });
  it("blocks missing chapter data instead of silently omitting pages", async () => {
    const bytes = await fixture({ missing: "OPS/text/two.xhtml" });
    await expect(convertEpubToMdx(bytes, source(bytes))).rejects.toThrow(
      "missing OPS/text/two.xhtml"
    );
  });
  it("preserves footnotes outside the spine and reports their supplemental chapter", async () => {
    const zip = await JSZip.loadAsync(await fixture());
    const pkg = await zip.file("OPS/book.opf")!.async("string");
    zip.file("OPS/book.opf", pkg.replace('<itemref idref="notes" linear="no"/>', ""));
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const draft = await convertEpubToMdx(bytes, source(bytes));
    expect(draft.articles[3].source).toContain("The full footnote stays editable.");
    expect(draft.issues.some((issue) => issue.code === "supplemental-chapter")).toBe(true);
  });
  it("reports unavailable anchors while preserving link labels and all source pages", async () => {
    const bytes = await fixture({
      chapter: '<h1>Start</h1><p><a href="two.xhtml#missing">Keep this link label</a></p>',
    });
    const draft = await convertEpubToMdx(bytes, source(bytes));
    expect(draft.articles[1].source).toContain("Keep this link label");
    expect(draft.articles[1].source).not.toContain("#missing");
    expect(draft.issues.some((issue) => issue.code === "internal-link")).toBe(true);
    expect(draft.articles).toHaveLength(4);
  });
  it("rejects dangling spine references instead of inventing a partial book", async () => {
    const zip = await JSZip.loadAsync(await fixture());
    const pkg = await zip.file("OPS/book.opf")!.async("string");
    zip.file("OPS/book.opf", pkg.replace('<itemref idref="two"/>', '<itemref idref="missing"/>'));
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    await expect(convertEpubToMdx(bytes, source(bytes))).rejects.toThrow(
      "spine refers to a missing chapter"
    );
  });
  it("rejects fixed layouts and encrypted chapters using the existing safety contract", async () => {
    const fixed = await fixture({
      extraPackage: '<meta property="rendition:layout">pre-paginated</meta>',
    });
    await expect(convertEpubToMdx(fixed, source(fixed))).rejects.toThrow("fixed layout");
    const zip = await JSZip.loadAsync(await fixture());
    zip.file(
      "META-INF/encryption.xml",
      '<encryption><EncryptedData><EncryptionMethod Algorithm="aes256"/></EncryptedData></encryption>'
    );
    const encrypted = await zip.generateAsync({ type: "arraybuffer" });
    await expect(convertEpubToMdx(encrypted, source(encrypted))).rejects.toThrow("encrypted");
  });
  it("applies the extracted asset budget before returning a book draft", async () => {
    const bytes = await fixture();
    const archive = await openConversionArchive(bytes, []);
    const chapters = archive.chapters.map((chapter, index) => ({
      ...chapter,
      filename: `${index}.mdx`,
      articleId: `${index}`,
      anchors: new Map<string, string>(),
    }));
    await expect(collectBookAssets(archive, chapters, "book", [], 1)).rejects.toThrow("100 MiB");
  });
});
