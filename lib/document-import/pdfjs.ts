import type { PDFDocumentProxy } from "pdfjs-dist";

/** Load only in the browser: PDF.js requires DOMMatrix and a matching local worker. */
export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
}
export const PDF_ASSETS = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
  isEvalSupported: false,
};
export async function inspectBrowserPdf(
  bytes: Uint8Array
): Promise<{ title?: string; pageCount: number }> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: bytes.slice(), ...PDF_ASSETS });
  let document: PDFDocumentProxy | null = null;
  try {
    document = await task.promise;
    if (!document.numPages) throw new Error("This PDF contains no pages.");
    const metadata = await document.getMetadata();
    const rawTitle = (metadata.info as { Title?: unknown }).Title;
    return {
      title: typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : undefined,
      pageCount: document.numPages,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException")
      throw new Error("This PDF is password protected. Import an unlocked copy to read it.");
    throw error;
  } finally {
    await task.destroy();
  }
}
