"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import { loadPdfJs } from "@/lib/document-import/pdfjs";
import AnnotationsLayer from "@/components/reader/AnnotationsLayer";
import type { ImportedDocument } from "@/lib/imported-documents";
import { importedDocumentHref } from "@/lib/imported-documents";
import styles from "./FileReader.module.css";

export default function PdfPage({
  pdf,
  pageNumber,
  zoom,
  query,
  onRendered,
  document,
}: {
  document: ImportedDocument;
  pdf: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  query: string;
  onRendered: () => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const text = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(700);
  const [size, setSize] = useState({ width: 700, height: 900 });
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const [textEmpty, setTextEmpty] = useState(false);
  const [retry, setRetry] = useState(0);
  const renderKey = `${pageNumber}:${width}:${zoom}:${retry}`;
  const ready = renderedKey === renderKey;
  const error = failure?.key === renderKey ? failure.message : null;
  const paintMatches = useCallback(() => {
    const needle = query.toLocaleLowerCase();
    for (const span of text.current?.querySelectorAll<HTMLElement>("span") ?? []) {
      span.toggleAttribute(
        "data-search-match",
        !!needle && (span.textContent ?? "").toLocaleLowerCase().includes(needle)
      );
    }
  }, [query]);
  useEffect(() => {
    paintMatches();
  }, [paintMatches, ready]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, entry.contentRect.width))
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let render: RenderTask | undefined;
    let layer: TextLayer | undefined;
    void (async () => {
      const page = await pdf.getPage(pageNumber);
      const pdfjs = await loadPdfJs();
      if (!active || !canvas.current || !text.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = zoom || width / base.width;
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(16_000_000 / (viewport.width * viewport.height))
      );
      const element = canvas.current;
      element.width = Math.ceil(viewport.width * ratio);
      element.height = Math.ceil(viewport.height * ratio);
      element.style.width = `${viewport.width}px`;
      element.style.height = `${viewport.height}px`;
      text.current.style.setProperty("--total-scale-factor", String(viewport.scale));
      text.current.replaceChildren();
      setSize({ width: viewport.width, height: viewport.height });
      render = page.render({
        canvas: element,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      await render.promise;
      if (!active) return;
      const content = await page.getTextContent();
      if (!active || !text.current) return;
      layer = new pdfjs.TextLayer({
        textContentSource: content,
        container: text.current,
        viewport,
      });
      await layer.render();
      if (!active) return;
      setTextEmpty(!content.items.some((item) => "str" in item && item.str.trim()));
      setRenderedKey(renderKey);
      requestAnimationFrame(() => {
        if (active) onRendered();
      });
    })().catch((cause: unknown) => {
      if (active && !(cause instanceof Error && cause.name === "RenderingCancelledException"))
        setFailure({
          key: renderKey,
          message: cause instanceof Error ? cause.message : String(cause),
        });
    });
    return () => {
      active = false;
      render?.cancel();
      layer?.cancel();
    };
  }, [pdf, pageNumber, width, zoom, retry, onRendered, renderKey]);
  return (
    <div className={styles.pdfViewport} ref={container}>
      {!ready && !error ? (
        <p className={styles.notice} role="status">
          Rendering page {pageNumber}…
        </p>
      ) : null}
      {error ? (
        <div className={styles.notice} role="alert">
          <p>This page couldn’t be rendered. {error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry page
          </button>
        </div>
      ) : null}
      <article
        className={styles.pdfPage}
        aria-label={`PDF page ${pageNumber}`}
        data-article
        data-pdf-page={pageNumber}
        style={
          {
            width: size.width,
            height: size.height,
            visibility: ready ? "visible" : "hidden",
          } as CSSProperties
        }
      >
        <canvas ref={canvas} aria-hidden />
        <div ref={text} className={styles.pdfTextLayer} aria-label="Selectable page text" />
      </article>
      {ready && textEmpty ? (
        <p className={styles.notice}>
          This page has no selectable text. It may be a scan; OCR is not available yet.
        </p>
      ) : null}
      {ready ? (
        <AnnotationsLayer
          key={`${pageNumber}:${width}:${zoom}`}
          docSlug={`files/${document.id}/page-${pageNumber}`}
          share={{
            title: `${document.title} — Page ${pageNumber}`,
            author: document.author ?? "",
            tags: [],
            href: importedDocumentHref(document.id),
          }}
        />
      ) : null}
    </div>
  );
}
