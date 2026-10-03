"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { browserArticleHref } from "@/lib/browser-articles";
import { importedDocumentHref } from "@/lib/imported-documents";
import { findMdxBookForArticle, readMdxBookSnapshot } from "@/lib/mdx-books/storage";
import { createMdxBookZip } from "@/lib/mdx-books/export";
import { bookIdInSource } from "@/lib/mdx-books/paths";
import type { MdxBookRecord } from "@/lib/mdx-books/types";
import styles from "./BookActions.module.css";

export function MdxBookActions({
  articleId,
  parentId,
  source = "",
  disabled = false,
}: {
  articleId: string;
  parentId?: string | null;
  source?: string;
  disabled?: boolean;
}) {
  const [owner, setOwner] = useState<{ articleId: string; book: MdxBookRecord | null }>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void findMdxBookForArticle(articleId)
      .then((book) => {
        if (active) {
          setOwner({ articleId, book });
          setLookupError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setOwner({ articleId, book: null });
          setLookupError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      active = false;
    };
  }, [articleId, parentId, retry]);
  const book = owner?.articleId === articleId ? owner.book : null;
  if (!book)
    return lookupError && bookIdInSource(source) ? (
      <div className={styles.message} role="alert">
        <p>Book actions could not be checked. {lookupError}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Retry book actions
        </button>
      </div>
    ) : null;
  async function exportBook() {
    if (!book || busy.current || disabled) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    setFailed(false);
    try {
      const snapshot = await readMdxBookSnapshot(book.id);
      const result = await createMdxBookZip(snapshot);
      if (!alive.current) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (result.issues.length)
        setMessage(
          `Export includes ${result.issues.length} notice(s). See export-report.md in the ZIP.`
        );
    } catch (cause) {
      if (alive.current) {
        setFailed(true);
        setMessage(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  return (
    <div>
      <div className={styles.actions} aria-label="MDX book actions">
        {articleId !== book.rootArticleId ? (
          <Link href={browserArticleHref(book.rootArticleId)}>
            <BookOpen aria-hidden />
            Book home
          </Link>
        ) : null}
        <Link href={importedDocumentHref(book.sourceDocumentId)}>Original EPUB</Link>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => void exportBook()}
          title={disabled ? "Save this page before exporting the book" : undefined}
        >
          <Download aria-hidden />
          {pending ? "Preparing book…" : "Export MDX book"}
        </button>
      </div>
      {message ? (
        <p className={styles.message} role={failed ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
