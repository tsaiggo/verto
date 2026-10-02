"use client";

import { useCallback, useRef, useState } from "react";
import { importDocument, type ImportedDocument } from "@/lib/imported-documents";

export type DocumentImportState =
  | { status: "idle" }
  | { status: "reading" | "saving"; filename: string }
  | { status: "saved"; document: ImportedDocument }
  | { status: "error"; filename: string; error: string };

export function useDocumentImport() {
  const [state, setState] = useState<DocumentImportState>({ status: "idle" });
  const pending = useRef(false);
  const importFile = useCallback(async (file: File) => {
    if (pending.current) return;
    pending.current = true;
    try {
      const format = /\.epub$/i.test(file.name) ? "epub" : /\.pdf$/i.test(file.name) ? "pdf" : null;
      if (!format) throw new Error("Choose an EPUB or PDF file.");
      if (file.size === 0) throw new Error("This file is empty. Choose another file.");
      if (file.size > 50 * 1024 * 1024)
        throw new Error("This file is larger than 50 MB. Choose a smaller file.");
      setState({ status: "reading", filename: file.name });
      const bytes = await file.arrayBuffer();
      let metadata: { title?: string; author?: string; language?: string; pageCount?: number };
      if (format === "epub") {
        const { parseBrowserEpub } = await import("@/lib/document-import/epub");
        const parsed = await parseBrowserEpub(new Uint8Array(bytes));
        metadata = { title: parsed.title, author: parsed.author, language: parsed.language };
      } else {
        const { inspectBrowserPdf } = await import("@/lib/document-import/pdfjs");
        metadata = await inspectBrowserPdf(new Uint8Array(bytes.slice(0)));
      }
      setState({ status: "saving", filename: file.name });
      const document = await importDocument({ filename: file.name, format, bytes, ...metadata });
      setState({ status: "saved", document });
    } catch (error) {
      setState({
        status: "error",
        filename: file.name,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.current = false;
    }
  }, []);
  const dismiss = useCallback(() => {
    if (!pending.current) setState({ status: "idle" });
  }, []);
  return { state, importFile, dismiss };
}
