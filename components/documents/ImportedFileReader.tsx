"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  readImportedDocument,
  subscribeImportedDocuments,
  type ImportedDocument,
} from "@/lib/imported-documents";
import ReaderWorkspace from "@/components/reader/ReaderWorkspace";
import { isTauri } from "@/lib/tauri";
import EpubReader from "./EpubReader";
import PdfReader from "./PdfReader";
import styles from "./FileReader.module.css";

export function FileReaderState({
  title,
  description,
  retry,
  loading = false,
  actions,
}: {
  title: string;
  description: string;
  retry?: () => void;
  loading?: boolean;
  actions?: ReactNode;
}) {
  return (
    <ReaderWorkspace state={loading ? "loading" : "ready"} documentLabel={title}>
      <section
        className={styles.state}
        role={loading ? "status" : "alert"}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <Loader2 className={styles.spinner} aria-hidden />
        ) : (
          <TriangleAlert aria-hidden />
        )}
        <h1>{title}</h1>
        <p>{description}</p>
        <div className={styles.headerActions}>
          {actions}
          {retry ? (
            <button type="button" onClick={retry}>
              Try again
            </button>
          ) : null}
          <Link href="/library">Back to library</Link>
        </div>
      </section>
    </ReaderWorkspace>
  );
}
export function ImportedFileReaderFallback() {
  return (
    <FileReaderState
      loading
      title="Opening your document"
      description="Loading the original file from local storage."
    />
  );
}

export default function ImportedFileReader() {
  const id = useSearchParams()?.get("document")?.trim() ?? "";
  return id ? (
    <StoredFile key={id} id={id} />
  ) : (
    <FileReaderState
      title="Choose a document to read"
      description="Open an imported EPUB or PDF from your library."
    />
  );
}
function StoredFile({ id }: { id: string }) {
  const [file, setFile] = useState<{ document: ImportedDocument; bytes: ArrayBuffer } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      readImportedDocument(id).then(
        (next) => {
          if (!active || request !== current) return;
          setFile((previous) =>
            previous &&
            next &&
            previous.document.id === next.document.id &&
            previous.document.revision === next.document.revision
              ? previous
              : next
          );
          setStatus(next ? "ready" : "missing");
        },
        (cause: unknown) => {
          if (active && request === current) {
            setStatus("error");
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }
      );
    };
    const unsubscribe = subscribeImportedDocuments(refresh);
    queueMicrotask(refresh);
    return () => {
      active = false;
      request++;
      unsubscribe();
    };
  }, [id, revision]);
  const retry = () => {
    setStatus("loading");
    setRevision((value) => value + 1);
  };
  if (status === "loading") return <ImportedFileReaderFallback />;
  if (status === "missing")
    return (
      <FileReaderState
        title="This document isn’t saved here"
        description={
          isTauri()
            ? "It may have been removed from this desktop library. Open your library to import its original file again."
            : "It may have been removed, or imported at a different browser address. Open your library to import its original file again."
        }
        retry={retry}
      />
    );
  if (status === "error" || !file)
    return (
      <FileReaderState
        title="Your document couldn’t be opened"
        description={
          error || "Local storage is unavailable. Your original file has not been changed."
        }
        retry={retry}
      />
    );
  return file.document.format === "epub" ? (
    <EpubReader document={file.document} bytes={file.bytes} />
  ) : (
    <PdfReader document={file.document} bytes={file.bytes} />
  );
}
