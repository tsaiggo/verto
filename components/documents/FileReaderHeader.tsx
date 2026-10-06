"use client";

import { useId, useState } from "react";
import { BookOpen, Download, FilePenLine, FileText } from "lucide-react";
import { BookmarkButton } from "@/components/reader/BookmarkButton";
import { AddToCollectionButton } from "@/components/reader/AddToCollectionButton";
import ReadingSettings from "@/components/ui/ReadingSettings";
import { importedDocumentHref, type ImportedDocument } from "@/lib/imported-documents";
import styles from "./FileReader.module.css";
import EpubConversion from "@/components/books/EpubConversion";

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
  const [conversionOpen, setConversionOpen] = useState(false);
  const conversionId = useId();
  return (
    <>
      <header className={styles.header} data-page-identity data-reader-format={document.format}>
        <div className={styles.headerActions}>
          <button type="button" onClick={() => exportReadingFile(document, bytes)}>
            <Download aria-hidden />
            Export original
          </button>
          <BookmarkButton href={href} title={document.title} kind="document" />
          <AddToCollectionButton href={href} title={document.title} mobileSheet />
          {document.format === "epub" ? <ReadingSettings /> : null}
          {document.format === "epub" ? (
            <button
              type="button"
              onClick={() => setConversionOpen((open) => !open)}
              aria-expanded={conversionOpen}
              aria-controls={conversionId}
            >
              <FilePenLine aria-hidden />
              Convert to MDX
            </button>
          ) : null}
        </div>
        <div className={styles.fileIdentity}>
          {document.format === "epub" ? <BookOpen aria-hidden /> : <FileText aria-hidden />}
          <div>
            <h1>{document.title}</h1>
            <p>
              <span className={styles.fileFormat}>{document.format.toUpperCase()}</span>
              {document.author ? <span>{document.author}</span> : null}
              <span>{document.filename}</span>
              <span>Original saved locally</span>
            </p>
          </div>
        </div>
      </header>
      {conversionOpen && document.format === "epub" ? (
        <EpubConversion
          key={document.id}
          document={document}
          bytes={bytes}
          id={conversionId}
          onClose={() => setConversionOpen(false)}
        />
      ) : null}
    </>
  );
}
