import JSZip from "jszip";

/** Deterministic valid source files; no production content is seeded. */
export async function epubFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );
  zip.file(
    "book/package.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">fixture-book</dc:identifier><dc:title>Reading field guide</dc:title><dc:creator>Verto test author</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`
  );
  zip.file(
    "book/nav.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="one.xhtml">First chapter</a></li><li><a href="two.xhtml#details">Second chapter</a></li></ol></nav></body></html>`
  );
  zip.file(
    "book/one.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><h1>First chapter</h1><p>A portable book belongs to its reader.</p><a href="two.xhtml#details">Continue to details</a><script>window.__epub_script_ran = true</script><img src="https://example.invalid/tracking.png"/></body></html>`
  );
  zip.file(
    "book/two.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Second chapter</title></head><body><h1>Second chapter</h1><h2 id="details">Reading details</h2><p>Keep your source and your reading progress.</p></body></html>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

export function pdfFixture(): Buffer {
  const text1 = "BT /F1 20 Tf 48 720 Td (Research notebook) Tj ET";
  const text2 = "BT /F1 20 Tf 48 720 Td (Portable reading second page) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text1.length} >>\nstream\n${text1}\nendstream`,
    `<< /Length ${text2.length} >>\nstream\n${text2}\nendstream`,
    "<< /Title (Research notebook) /Author (Verto test author) >>",
  ];
  let document = "%PDF-1.7\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(document);
}
