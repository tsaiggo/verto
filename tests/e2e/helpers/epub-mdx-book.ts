import JSZip from "jszip";

/** A real, minimal EPUB with nested navigation and immutable embedded media. */
export async function editableEpubFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );
  zip.file(
    "EPUB/package.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">editable-epub-fixture</dc:identifier><dc:title>A portable field book</dc:title><dc:creator>Verto conversion test author</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="one" href="chapters/one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapters/two.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="diagram" href="images/diagram.png" media-type="image/png"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`
  );
  zip.file(
    "EPUB/nav.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="chapters/one.xhtml">Opening chapter</a><ol><li><a href="chapters/one.xhtml#observations">Field observations</a></li></ol></li><li><a href="chapters/two.xhtml#details">Further reading</a></li></ol></nav></body></html>`
  );
  zip.file(
    "EPUB/chapters/one.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Opening chapter</title></head><body><h1>Opening chapter</h1><p>Original words are kept beside an editable copy.</p><h2 id="observations">Field observations</h2><p>An <strong>important observation</strong> with <em>quiet emphasis</em>.</p><img src="../images/diagram.png" alt="A local diagram"/><table><thead><tr><th>Place</th><th>Reading</th></tr></thead><tbody><tr><td>Desk</td><td>Notes</td></tr></tbody></table><ul><li>Keep the source.</li><li>Edit the chapter.</li></ul><a href="two.xhtml#details">Continue to details</a><img src="https://example.invalid/remote.png" alt="Remote tracker"/><script>window.__converted_epub_script = true</script></body></html>`
  );
  zip.file(
    "EPUB/chapters/two.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Further reading</title></head><body><h1>Further reading</h1><h2 id="details">Reading details</h2><p>This second chapter stays connected to its book.</p><pre><code>const reading = "portable";</code></pre><a href="one.xhtml#observations">Return to observations</a></body></html>`
  );
  zip.file(
    "EPUB/images/diagram.png",
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII=",
      "base64"
    )
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
