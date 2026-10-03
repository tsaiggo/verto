"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import ReaderWorkspace from "@/components/reader/ReaderWorkspace";
import { importedDocumentHref, type ImportedDocument } from "@/lib/imported-documents";
import { loadPdfJs, PDF_ASSETS } from "@/lib/document-import/pdfjs";
import FileReaderHeader, { exportReadingFile } from "./FileReaderHeader";
import PdfPage from "./PdfPage";
import { FileReaderState } from "./ImportedFileReader";
import { useFilePosition } from "./use-file-position";
import styles from "./FileReader.module.css";

export default function PdfReader({
  document,
  bytes,
}: {
  document: ImportedDocument;
  bytes: ArrayBuffer;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let destroy: (() => Promise<void>) | undefined;
    void loadPdfJs()
      .then(async (pdfjs) => {
        if (!active) return;
        const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), ...PDF_ASSETS });
        destroy = () => task.destroy();
        try {
          const opened = await task.promise;
          if (active) {
            setPdf(opened);
            setError(null);
          }
        } catch (cause) {
          if (active)
            setError(
              cause instanceof Error && cause.name === "PasswordException"
                ? "This PDF is password protected. Import an unlocked copy to read it."
                : cause instanceof Error
                  ? cause.message
                  : String(cause)
            );
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
      void destroy?.();
    };
  }, [bytes, retry]);
  if (error)
    return (
      <FileReaderState
        title="This PDF couldn’t be read"
        description={`${error} Your original file is unchanged.`}
        actions={
          <button type="button" onClick={() => exportReadingFile(document, bytes)}>
            Export original
          </button>
        }
        retry={() => {
          setPdf(null);
          setError(null);
          setRetry((value) => value + 1);
        }}
      />
    );
  if (!pdf)
    return (
      <FileReaderState
        loading
        title="Preparing your PDF"
        description="Loading pages and selectable text from the original file."
      />
    );
  return <OpenPdf key={document.id} document={document} bytes={bytes} pdf={pdf} />;
}

interface PdfOutlineItem {
  title: string;
  page: number;
  level: number;
}
function usePdfOutline(pdf: PDFDocumentProxy) {
  const [outline, setOutline] = useState<PdfOutlineItem[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const source = await pdf.getOutline();
      const result: PdfOutlineItem[] = [];
      async function visit(items: NonNullable<typeof source>, level: number) {
        for (const item of items) {
          const destination =
            typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
          if (destination?.[0] != null) {
            const page =
              typeof destination[0] === "number"
                ? destination[0]
                : await pdf.getPageIndex(destination[0]);
            result.push({ title: item.title || `Page ${page + 1}`, page, level });
          }
          if (item.items.length) await visit(item.items, level + 1);
        }
      }
      if (source) await visit(source, 0);
      if (active) setOutline(result);
    })().catch(() => {
      /* An optional malformed outline must not block the pages. */
    });
    return () => {
      active = false;
    };
  }, [pdf]);
  return outline;
}

function OpenPdf({
  document,
  bytes,
  pdf,
}: {
  document: ImportedDocument;
  bytes: ArrayBuffer;
  pdf: PDFDocumentProxy;
}) {
  const position = useFilePosition(document, pdf.numPages);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(0);
  const [pageDraft, setPageDraft] = useState<{ index: number; value: string } | null>(null);
  const pageInput =
    pageDraft?.index === position.index ? pageDraft.value : String(position.index + 1);
  const [search, setSearch] = useState<{ pages: number[]; checked: number; error: string | null }>({
    pages: [],
    checked: 0,
    error: null,
  });
  const textCache = useRef(new Map<number, string>());
  const outline = usePdfOutline(pdf);
  const href = importedDocumentHref(document.id);
  const doc = useMemo(
    () => ({ href, slug: ["files", document.id], title: document.title }),
    [href, document.id, document.title]
  );
  useEffect(() => {
    let active = true;
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return;
    const timer = setTimeout(() => {
      void (async () => {
        const pages: number[] = [];
        for (let page = 1; page <= pdf.numPages; page++) {
          if (!active) return;
          let text = textCache.current.get(page);
          if (text === undefined) {
            const source = await pdf.getPage(page);
            const content = await source.getTextContent();
            text = content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
              .toLocaleLowerCase();
            textCache.current.set(page, text);
          }
          if (text.includes(needle)) pages.push(page);
          if (active) setSearch({ pages: [...pages], checked: page, error: null });
        }
      })().catch(() => {
        if (active)
          setSearch((current) => ({
            ...current,
            error: "Some pages couldn’t be searched. Clear the search and try again.",
          }));
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pdf, query]);
  function choose(index: number) {
    position.choose(index);
    window.getSelection()?.removeAllRanges();
  }
  function jump() {
    const value = Number(pageInput);
    if (Number.isInteger(value) && value >= 1 && value <= pdf.numPages) choose(value - 1);
    setPageDraft(null);
  }
  const toc = outline.length ? (
    <nav className={styles.outline} aria-label="PDF outline">
      <h2>Outline</h2>
      {outline.map((item, index) => (
        <button
          key={index}
          type="button"
          style={{ paddingInlineStart: `${8 + Math.min(item.level, 4) * 12}px` }}
          onClick={() => choose(item.page)}
          aria-current={item.page === position.index ? "page" : undefined}
        >
          {item.title}
        </button>
      ))}
    </nav>
  ) : undefined;
  return (
    <div
      className={styles.reader}
      ref={(element) =>
        position.bind(element?.querySelector<HTMLElement>("[data-page-scroll]") ?? null)
      }
    >
      <ReaderWorkspace
        masthead={<FileReaderHeader document={document} bytes={bytes} />}
        toc={toc}
        doc={doc}
        documentLabel="PDF content"
      >
        <div className={styles.controls} aria-label="PDF navigation">
          <button
            type="button"
            aria-label="Previous page"
            disabled={position.index === 0}
            onClick={() => choose(position.index - 1)}
          >
            <ChevronLeft aria-hidden />
          </button>
          <label className={styles.pageNumber}>
            Page
            <input
              type="number"
              min="1"
              max={pdf.numPages}
              aria-label="Page number"
              value={pageInput}
              onChange={(event) =>
                setPageDraft({ index: position.index, value: event.target.value })
              }
              onBlur={jump}
              onKeyDown={(event) => {
                if (event.key === "Enter") jump();
              }}
            />
            <span>of {pdf.numPages}</span>
          </label>
          <button
            type="button"
            aria-label="Next page"
            disabled={position.index >= pdf.numPages - 1}
            onClick={() => choose(position.index + 1)}
          >
            <ChevronRight aria-hidden />
          </button>
          <select
            aria-label="PDF zoom"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value="0">Fit width</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
          <label className={styles.search}>
            <Search aria-hidden />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearch({ pages: [], checked: 0, error: null });
              }}
              type="search"
              placeholder="Find in PDF"
              aria-label="Find in PDF"
            />
          </label>
          {query ? (
            <button type="button" aria-label="Clear PDF search" onClick={() => setQuery("")}>
              <X aria-hidden />
            </button>
          ) : null}
        </div>
        {position.error ? (
          <p className={styles.notice} role="alert">
            {position.error}
          </p>
        ) : null}
        {query.trim() ? (
          <section className={styles.searchResults} aria-label="PDF search results" role="status">
            <p>
              {search.error ??
                (search.checked < pdf.numPages
                  ? `Searching ${search.checked} of ${pdf.numPages} pages…`
                  : search.pages.length
                    ? `${search.pages.length} matching pages`
                    : "No matching text. Scanned pages may need OCR.")}
            </p>
            {search.pages.map((page) => (
              <button key={page} type="button" onClick={() => choose(page - 1)}>
                Page {page}
              </button>
            ))}
          </section>
        ) : null}
        {position.ready ? (
          <PdfPage
            key={position.index}
            document={document}
            pdf={pdf}
            pageNumber={position.index + 1}
            zoom={zoom}
            query={query.trim()}
            onRendered={position.restoreScroll}
          />
        ) : (
          <p className={styles.notice} role="status">
            Restoring reading position…
          </p>
        )}
      </ReaderWorkspace>
    </div>
  );
}
