"use client";

import { Download } from "lucide-react";
import { BookmarkButton } from "@/components/reader/BookmarkButton";
import { AddToCollectionButton } from "@/components/reader/AddToCollectionButton";
import ReadingSettings from "@/components/ui/ReadingSettings";
import { importedDocumentHref, type ImportedDocument } from "@/lib/imported-documents";
import styles from "./FileReader.module.css";

export function exportReadingFile(document: ImportedDocument, bytes: ArrayBuffer) {
  const blob = new Blob([bytes], {
    type: document.format === "pdf" ? "application/pdf" : "application/epub+zip",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FileReaderHeader({
  document,
  bytes,
}: {
  document: ImportedDocument;
  bytes: ArrayBuffer;
}) {
  const href = importedDocumentHref(document.id);
  return (
    <header className={styles.header} data-page-identity>
      <h1>{document.title}</h1>
      <p>
        {document.author ? `${document.author} · ` : ""}
        {document.filename} · Original file saved locally
      </p>
      <div className={styles.headerActions}>
        <button type="button" onClick={() => exportReadingFile(document, bytes)}>
          <Download aria-hidden />
          Export original
        </button>
        <BookmarkButton href={href} title={document.title} kind="document" />
        <AddToCollectionButton href={href} title={document.title} mobileSheet />
        {document.format === "epub" ? <ReadingSettings /> : null}
      </div>
    </header>
  );
}
