import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { importEpub } from "@/lib/epub/import";

const CONTAINER_XML = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const CONTENT_OPF = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>A. Writer</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover" href="images/cover.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

const CH1 = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>
  <h1>Chapter One</h1>
  <p>A line with <strong>bold</strong> and <em>italic</em> words.</p>
  <ul><li>first</li><li>second</li></ul>
  <p><img src="images/cover.png" alt="the cover"/></p>
</body></html>`;

const CH2 = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>
  <h2>Chapter Two</h2>
  <p>Second chapter body.</p>
  <p><a id="target">anchored text</a></p>
  <p><a href="https://example.com">a link</a></p>
</body></html>`;

async function buildEpub(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("OEBPS/content.opf", CONTENT_OPF);
  zip.file("OEBPS/ch1.xhtml", CH1);
  zip.file("OEBPS/text/ch2.xhtml", CH2);
  zip.file("OEBPS/images/cover.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  return zip.generateAsync({ type: "uint8array" });
}

describe("importEpub", () => {
  it("extracts book metadata from the OPF", async () => {
    const book = await importEpub(await buildEpub());
    expect(book.title).toBe("Test Book");
    expect(book.author).toBe("A. Writer");
    expect(book.language).toBe("en");
    expect(book.slug).toBe("test-book");
  });

  it("produces one MDX chapter per spine item, in order", async () => {
    const book = await importEpub(await buildEpub());
    expect(book.chapters).toHaveLength(2);
    expect(book.chapters.map((c) => c.order)).toEqual([0, 1]);
    expect(book.chapters[0].title).toBe("Chapter One");
    expect(book.chapters[1].title).toBe("Chapter Two");
  });

  it("converts XHTML to Markdown with frontmatter", async () => {
    const book = await importEpub(await buildEpub());
    const ch1 = book.chapters[0].mdx;
    expect(ch1).toMatch(/^---\n/);
    expect(ch1).toContain('title: "Chapter One"');
    expect(ch1).toContain("**bold**");
    expect(ch1).toContain("_italic_");
    expect(ch1).toContain("- first");
    expect(ch1).toContain("- second");
    expect(book.chapters[1].mdx).toContain("[a link](https://example.com)");
  });

  it("unwraps anchors used only as link targets (no href)", async () => {
    const book = await importEpub(await buildEpub());
    expect(book.chapters[1].mdx).toContain("anchored text");
    expect(book.chapters[1].mdx).not.toContain("[anchored text]()");
  });

  it("extracts referenced images and rewrites their src", async () => {
    const book = await importEpub(await buildEpub(), { imageUrlPrefix: "/books" });
    expect(book.images).toHaveLength(1);
    expect(book.images[0].zipPath).toBe("OEBPS/images/cover.png");
    expect(book.images[0].outPath).toBe("images/cover.png");
    expect(book.chapters[0].mdx).toContain("/books/test-book/images/cover.png");
  });
});
