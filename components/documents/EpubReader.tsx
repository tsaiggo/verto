"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import ReaderWorkspace from "@/components/reader/ReaderWorkspace";
import AnnotationsLayer from "@/components/reader/AnnotationsLayer";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import { importedDocumentHref, type ImportedDocument } from "@/lib/imported-documents";
import { parseBrowserEpub, type ParsedEpub } from "@/lib/document-import/epub";
import FileReaderHeader, { exportReadingFile } from "./FileReaderHeader";
import { FileReaderState } from "./ImportedFileReader";
import { useFilePosition } from "./use-file-position";
import styles from "./FileReader.module.css";

/** Mark only text nodes in already sanitized content; publisher markup never enters controls. */
function highlightText(html: string, query: string): string {
  if (!query || typeof window === "undefined") return html;
  const host = window.document.createElement("div");
  host.innerHTML = html;
  const walker = window.document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const needle = query.toLocaleLowerCase();
  let marks = 0;
  for (const node of nodes) {
    const value = node.data;
    const folded = value.toLocaleLowerCase();
    if (!folded.includes(needle)) continue;
    const fragment = window.document.createDocumentFragment();
    let cursor = 0;
    let found = folded.indexOf(needle);
    while (found !== -1 && marks < 1000) {
      fragment.append(value.slice(cursor, found));
      const mark = window.document.createElement("mark");
      mark.textContent = value.slice(found, found + query.length);
      fragment.append(mark);
      marks++;
      cursor = found + query.length;
      found = folded.indexOf(needle, cursor);
    }
    fragment.append(value.slice(cursor));
    node.replaceWith(fragment);
  }
  return host.innerHTML;
}

export default function EpubReader({
  document,
  bytes,
}: {
  document: ImportedDocument;
  bytes: ArrayBuffer;
}) {
  const [book, setBook] = useState<ParsedEpub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    parseBrowserEpub(new Uint8Array(bytes)).then(
      (parsed) => {
        if (active) {
          setBook(parsed);
          setError(null);
        }
      },
      (cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      }
    );
    return () => {
      active = false;
    };
  }, [bytes, retry]);
  if (error)
    return (
      <FileReaderState
        title="This EPUB couldn’t be read"
        description={`${error} Your original file is unchanged. Export it to open in another reader.`}
        actions={
          <button type="button" onClick={() => exportReadingFile(document, bytes)}>
            Export original
          </button>
        }
        retry={() => {
          setError(null);
          setRetry((value) => value + 1);
        }}
      />
    );
  if (!book)
    return (
      <FileReaderState
        loading
        title="Preparing your book"
        description="Reading the chapter order and local images from your EPUB."
      />
    );
  return <OpenEpub key={document.id} document={document} bytes={bytes} book={book} />;
}

function OpenEpub({
  document,
  bytes,
  book,
}: {
  document: ImportedDocument;
  bytes: ArrayBuffer;
  book: ParsedEpub;
}) {
  const position = useFilePosition(document, book.chapters.length);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<string | null>(null);
  const chapter = book.chapters[position.index];
  const href = importedDocumentHref(document.id);
  const doc = useMemo(
    () => ({ href, slug: ["files", document.id], title: document.title }),
    [href, document.id, document.title]
  );
  useEffect(() => {
    let active = true;
    const next: Record<string, string> = {};
    for (const asset of book.assets)
      next[asset.path] = URL.createObjectURL(
        new Blob([asset.bytes.slice().buffer], { type: asset.mime })
      );
    queueMicrotask(() => {
      if (active) setUrls(next);
    });
    return () => {
      active = false;
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [book]);
  const html = useMemo(() => {
    const withImages = chapter.html.replace(
      /verto-asset:([^"\s<]+)/g,
      (_match, path: string) => urls[decodeURIComponent(path)] ?? ""
    );
    return highlightText(withImages, query.trim());
  }, [chapter.html, query, urls]);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? book.chapters
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.text.toLocaleLowerCase().includes(needle))
      : [];
  }, [book, query]);
  const { ready: positionReady, restoreScroll } = position;
  useEffect(() => {
    if (!positionReady || book.assets.some((asset) => !urls[asset.path])) return;
    let active = true;
    let frame = 0;
    const images = Array.from(
      window.document.querySelectorAll<HTMLImageElement>("[data-article] img")
    );
    void Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
      if (!active) return;
      frame = requestAnimationFrame(() => {
        if (anchor) {
          window.document.getElementById(anchor)?.scrollIntoView({ block: "start" });
          setAnchor(null);
        } else restoreScroll();
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [chapter.id, html, positionReady, restoreScroll, anchor, book.assets, urls]);
  function choose(index: number, target?: string) {
    position.choose(index);
    setAnchor(target ?? null);
    window.getSelection()?.removeAllRanges();
  }
  function followInternal(event: MouseEvent<HTMLElement>) {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    const target = link?.getAttribute("href");
    if (!target?.startsWith("#epub-chapter-")) return;
    event.preventDefault();
    const raw = target.slice(1);
    const chapterId = raw.split("--")[0];
    const index = book.chapters.findIndex((item) => item.id === chapterId);
    if (index >= 0) choose(index, raw.includes("--") ? raw : undefined);
  }
  const outline = (
    <nav aria-label="Book chapters" className={styles.outline}>
      <h2>Chapters</h2>
      {book.chapters.map((item, index) => (
        <button
          key={item.id}
          type="button"
          aria-current={index === position.index ? "page" : undefined}
          onClick={() => choose(index)}
        >
          {item.title}
        </button>
      ))}
    </nav>
  );
  return (
    <div
      className={styles.reader}
      ref={(element) =>
        position.bind(element?.querySelector<HTMLElement>("[data-page-scroll]") ?? null)
      }
    >
      <ReaderWorkspace
        masthead={<FileReaderHeader document={document} bytes={bytes} />}
        toc={outline}
        doc={doc}
        documentLabel="EPUB content"
      >
        <div className={styles.controls} aria-label="Book navigation">
          <button
            type="button"
            aria-label="Previous chapter"
            disabled={position.index === 0}
            onClick={() => choose(position.index - 1)}
          >
            <ChevronLeft aria-hidden />
          </button>
          <span>
            {position.index + 1} / {book.chapters.length} chapters
          </span>
          <button
            type="button"
            aria-label="Next chapter"
            disabled={position.index >= book.chapters.length - 1}
            onClick={() => choose(position.index + 1)}
          >
            <ChevronRight aria-hidden />
          </button>
          <label className={styles.search}>
            <Search aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Find in book"
              aria-label="Find in book"
            />
          </label>
          {query ? (
            <button type="button" aria-label="Clear book search" onClick={() => setQuery("")}>
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
          <section className={styles.searchResults} aria-label="Book search results" role="status">
            <p>{matches.length ? `${matches.length} matching chapters` : "No matching chapters"}</p>
            {matches.map(({ item, index }) => (
              <button key={item.id} type="button" onClick={() => choose(index)}>
                {item.title}
              </button>
            ))}
          </section>
        ) : null}
        <article
          className={`content-wrap prose ${styles.epubContent}`}
          data-article
          id={chapter.id}
          onClick={followInternal}
          lang={book.language}
        >
          <InlineCommentProvider>
            <div data-prose-body dangerouslySetInnerHTML={{ __html: html }} />
            <AnnotationsLayer
              key={`${chapter.id}:${query}:${Object.keys(urls).length}`}
              docSlug={`files/${document.id}/${chapter.id}`}
              share={{
                title: `${document.title} — ${chapter.title}`,
                author: document.author ?? "",
                tags: [],
                href,
              }}
            />
          </InlineCommentProvider>
        </article>
        <div className={styles.chapterFooter}>
          <button
            type="button"
            disabled={position.index === 0}
            onClick={() => choose(position.index - 1)}
          >
            <ChevronLeft aria-hidden />
            Previous chapter
          </button>
          <button
            type="button"
            disabled={position.index >= book.chapters.length - 1}
            onClick={() => choose(position.index + 1)}
          >
            Next chapter
            <ChevronRight aria-hidden />
          </button>
        </div>
      </ReaderWorkspace>
    </div>
  );
}
