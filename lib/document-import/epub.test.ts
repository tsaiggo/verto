import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseBrowserEpub, resolveEpubPath } from "./epub";

async function makeBook({
  chapter = '<h1 id="start">第一章</h1><p>Read this passage.</p>',
  second = "<h1>Second chapter</h1><p>Another passage.</p>",
  manifest = "",
  assets = {},
}: { chapter?: string; second?: string; manifest?: string; assets?: Record<string, string> } = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container><rootfiles><rootfile full-path="OEBPS/book.opf" /></rootfiles></container>'
  );
  zip.file(
    "OEBPS/book.opf",
    `<package><metadata><dc:title xmlns:dc="urn:dc">Test book</dc:title><dc:creator xmlns:dc="urn:dc">Author</dc:creator><dc:language xmlns:dc="urn:dc">zh-CN</dc:language></metadata><manifest><item id="a" href="chapters/a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="chapters/b.xhtml" media-type="application/xhtml+xml"/>${manifest}</manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`
  );
  zip.file(
    "OEBPS/chapters/a.xhtml",
    `<html><head><title>Publisher title</title><style>body {color:red}</style></head><body>${chapter}</body></html>`
  );
  zip.file("OEBPS/chapters/b.xhtml", `<html><body>${second}</body></html>`);
  for (const [path, content] of Object.entries(assets)) zip.file(path, content);
  return zip.generateAsync({ type: "uint8array" });
}

describe("portable EPUB parser", () => {
  it("reads metadata, spine order, Unicode headings and stable anchors", async () => {
    const book = await parseBrowserEpub(await makeBook());
    expect(book).toMatchObject({ title: "Test book", author: "Author", language: "zh-CN" });
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["第一章", "Second chapter"]);
    expect(book.chapters[0].html).toContain('id="epub-chapter-1--start"');
    expect(book.chapters[0].text).toContain("Read this passage.");
    expect(book.chapters[0].html).not.toContain("Publisher title");
  });
  it("drops executable publisher HTML, tracking images and unsafe links", async () => {
    const book = await parseBrowserEpub(
      await makeBook({
        chapter:
          '<h1>Safe</h1><script>alert(1)</script><iframe src="https://tracker.test"></iframe><p onclick="alert(1)" style="color:red">Text <a href="javascript:alert(1)">bad</a></p><img src="https://tracker.test/pixel.png"><form><input value="secret"></form>',
      })
    );
    const html = book.chapters[0].html;
    expect(html).not.toMatch(/script|iframe|onclick|style=|javascript:|tracker\.test|<form|<input/);
    expect(html).toContain("Text");
    expect(book.assets).toEqual([]);
  });
  it("retains one portable local image reference and blocks image traversal", async () => {
    const book = await parseBrowserEpub(
      await makeBook({
        chapter:
          '<h1>Images</h1><img src="../images/cover.png" alt="Cover"><img src="../../../outside.png">',
        manifest: '<item id="cover" href="images/cover.png" media-type="image/png"/>',
        assets: { "OEBPS/images/cover.png": "original image bytes" },
      })
    );
    expect(book.chapters[0].html).toContain('src="verto-asset:OEBPS%2Fimages%2Fcover.png"');
    expect(book.assets).toHaveLength(1);
    expect(new TextDecoder().decode(book.assets[0].bytes)).toBe("original image bytes");
    expect(book.assets[0].path).toBe("OEBPS/images/cover.png");
  });
  it("preserves cross-chapter and same-chapter target identity", async () => {
    const book = await parseBrowserEpub(
      await makeBook({
        chapter:
          '<h1 id="intro">Intro</h1><a href="#intro">Here</a><a href="b.xhtml#target">Next</a><a href="https://example.com">External</a>',
        second: '<h1 id="target">Second</h1>',
      })
    );
    expect(book.chapters[0].html).toContain('href="#epub-chapter-1--intro"');
    expect(book.chapters[0].html).toContain('href="#epub-chapter-2--target"');
    expect(book.chapters[0].html).toContain('rel="noopener noreferrer"');
  });
  it("rejects corrupt zip files and EPUBs with no package", async () => {
    await expect(parseBrowserEpub(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    const zip = new JSZip();
    zip.file("readme.txt", "not a book");
    await expect(parseBrowserEpub(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(
      "missing META-INF/container.xml"
    );
  });
  it("rejects missing chapter data without silently losing a chapter", async () => {
    const zip = await JSZip.loadAsync(await makeBook());
    zip.remove("OEBPS/chapters/b.xhtml");
    await expect(parseBrowserEpub(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(
      "missing OEBPS/chapters/b.xhtml"
    );
  });
  it("rejects empty and unsupported image-only books with recovery copy", async () => {
    await expect(
      parseBrowserEpub(await makeBook({ chapter: "<script>bad()</script>", second: "" }))
    ).rejects.toThrow("no readable text");
  });
  it("rejects encrypted chapters", async () => {
    const zip = await JSZip.loadAsync(await makeBook());
    zip.file(
      "META-INF/encryption.xml",
      '<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256"/></EncryptedData></encryption>'
    );
    await expect(parseBrowserEpub(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(
      "encrypted"
    );
  });
  it("explains unsupported fixed layouts before storing an unusable book", async () => {
    const zip = await JSZip.loadAsync(await makeBook());
    const packageSource = await zip.file("OEBPS/book.opf")!.async("string");
    zip.file(
      "OEBPS/book.opf",
      packageSource.replace(
        "</metadata>",
        '<meta property="rendition:layout">pre-paginated</meta></metadata>'
      )
    );
    await expect(parseBrowserEpub(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(
      "fixed layout"
    );
  });
  it("rejects oversized expanded chapters before HTML processing", async () => {
    const zip = await JSZip.loadAsync(await makeBook());
    zip.file("OEBPS/chapters/a.xhtml", "x".repeat(8 * 1024 * 1024 + 1));
    await expect(
      parseBrowserEpub(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }))
    ).rejects.toThrow("8 MiB");
  });
});
describe("EPUB archive paths", () => {
  it("resolves relative references but refuses traversal, schemes and malformed paths", () => {
    expect(resolveEpubPath("OEBPS/chapters/a.xhtml", "../images/pic%20one.png#fragment")).toBe(
      "OEBPS/images/pic one.png"
    );
    for (const path of [
      "../../../secret",
      "https://evil.test/a",
      "//evil.test/a",
      "/absolute",
      "\\windows",
      "%00",
      "%ZZ",
    ])
      expect(resolveEpubPath("OEBPS/a.xhtml", path)).toBeNull();
  });
});
