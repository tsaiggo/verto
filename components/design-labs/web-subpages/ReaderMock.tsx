"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Highlighter,
  MessageSquareText,
  Minus,
  Plus,
  ScanText,
  X,
} from "lucide-react";

import styles from "./ReaderMock.module.css";

export type ReaderFormat = "epub" | "pdf";

interface ReaderMockProps {
  format?: ReaderFormat;
  onFormatChange?: (format: ReaderFormat) => void;
  /** Zero-based index into the preview EPUB chapters. */
  chapter?: number;
  /** One-based PDF page number. */
  page?: number;
  onChapterChange?: (chapter: number) => void;
  onPageChange?: (page: number) => void;
}

const CHAPTERS = [
  { title: "The work of reading", section: "Chapter 1" },
  { title: "Making room to think", section: "Chapter 2" },
  { title: "What stays with us", section: "Chapter 3" },
] as const;

export const PDF_PAGE_COUNT = 48;

export default function ReaderMock({
  format,
  onFormatChange,
  chapter: controlledChapter,
  page: controlledPage,
  onChapterChange,
  onPageChange,
}: ReaderMockProps) {
  const [localFormat, setLocalFormat] = useState<ReaderFormat>("epub");
  const [localChapter, setLocalChapter] = useState(1);
  const [localPage, setLocalPage] = useState(12);
  const [fontScale, setFontScale] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [noText, setNoText] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [askQueued, setAskQueued] = useState(false);
  const activeFormat = format ?? localFormat;
  const chapter = Math.max(0, Math.min(CHAPTERS.length - 1, controlledChapter ?? localChapter));
  const page = Math.max(1, Math.min(PDF_PAGE_COUNT, controlledPage ?? localPage));
  const notesTrigger = useRef<HTMLButtonElement>(null);
  const passage = useRef<HTMLButtonElement>(null);

  const changeChapter = (next: number) => {
    const bounded = Math.max(0, Math.min(CHAPTERS.length - 1, next));
    if (controlledChapter === undefined) setLocalChapter(bounded);
    onChapterChange?.(bounded);
    setAskQueued(false);
  };

  const changePage = (next: number) => {
    const bounded = Math.max(1, Math.min(PDF_PAGE_COUNT, next));
    if (controlledPage === undefined) setLocalPage(bounded);
    onPageChange?.(bounded);
    setAskQueued(false);
  };

  const selectFormat = (next: ReaderFormat) => {
    if (format === undefined) setLocalFormat(next);
    onFormatChange?.(next);
    setNotesOpen(false);
    setAskQueued(false);
  };

  const closeNotes = (returnToPassage = false) => {
    setNotesOpen(false);
    requestAnimationFrame(() => {
      (returnToPassage ? passage.current : notesTrigger.current)?.focus();
    });
  };

  const title = activeFormat === "epub" ? "The Shape of Attention" : "Field Notes on Deep Reading";
  const location =
    activeFormat === "epub"
      ? `Chapter ${chapter + 1} of ${CHAPTERS.length}`
      : `Page ${page} of ${PDF_PAGE_COUNT}`;
  const progress =
    activeFormat === "epub"
      ? Math.round(((chapter + 0.4) / CHAPTERS.length) * 100)
      : Math.round((page / PDF_PAGE_COUNT) * 100);

  return (
    <section
      className={styles.reader}
      aria-label="Reading design preview"
      onKeyDown={(event) => {
        if (event.key === "Escape" && notesOpen) {
          event.stopPropagation();
          closeNotes();
        }
      }}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          <a
            className={styles.back}
            href="/library"
            aria-label="Back to Library"
            title="Back to Library"
          >
            <ArrowLeft size={17} aria-hidden />
          </a>
          <span className={styles.headerIcon} aria-hidden>
            {activeFormat === "epub" ? <BookOpen size={17} /> : <FileText size={17} />}
          </span>
          <div className={styles.identityText}>
            <strong>{title}</strong>
            <span>
              {activeFormat === "epub"
                ? "Sample EPUB · Verto Library"
                : "Sample PDF · Verto Library"}
            </span>
          </div>
        </div>
        <div className={styles.formatTabs} role="group" aria-label="Preview format">
          <button
            type="button"
            className={activeFormat === "epub" ? styles.formatActive : undefined}
            aria-pressed={activeFormat === "epub"}
            onClick={() => selectFormat("epub")}
          >
            EPUB
          </button>
          <button
            type="button"
            className={activeFormat === "pdf" ? styles.formatActive : undefined}
            aria-pressed={activeFormat === "pdf"}
            onClick={() => selectFormat("pdf")}
          >
            PDF
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.location}>
          <span>{location}</span>
          <span className={styles.toolbarDot} aria-hidden>
            ·
          </span>
          <span>{progress}% complete</span>
        </div>
        <div className={styles.tools}>
          {activeFormat === "epub" ? (
            <div className={styles.toolGroup} aria-label="Reading text size">
              <button
                type="button"
                aria-label="Decrease text size"
                disabled={fontScale <= 0.9}
                onClick={() => setFontScale((value) => Math.max(0.9, value - 0.1))}
              >
                <span className={styles.smallA}>A</span>
              </button>
              <button
                type="button"
                aria-label="Increase text size"
                disabled={fontScale >= 1.2}
                onClick={() => setFontScale((value) => Math.min(1.2, value + 0.1))}
              >
                <span className={styles.largeA}>A</span>
              </button>
            </div>
          ) : (
            <>
              <div className={styles.toolGroup} aria-label="PDF zoom">
                <button
                  type="button"
                  aria-label="Zoom out"
                  disabled={zoom <= 80}
                  onClick={() => setZoom((value) => Math.max(80, value - 10))}
                >
                  <Minus size={15} aria-hidden />
                </button>
                <span className={styles.zoomValue}>{zoom}%</span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  disabled={zoom >= 120}
                  onClick={() => setZoom((value) => Math.min(120, value + 10))}
                >
                  <Plus size={15} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className={styles.stateToggle}
                aria-pressed={noText}
                onClick={() => {
                  setNoText((value) => !value);
                  setAskQueued(false);
                }}
              >
                <ScanText size={15} aria-hidden />
                {noText ? "Text layer off" : "Text layer on"}
              </button>
            </>
          )}
          <button
            ref={notesTrigger}
            type="button"
            className={styles.notesButton}
            aria-expanded={notesOpen}
            aria-controls="reader-preview-notes"
            onClick={() => setNotesOpen((value) => !value)}
          >
            <MessageSquareText size={16} aria-hidden />
            <span>Notes</span>
            <span className={styles.noteCount}>1</span>
          </button>
        </div>
      </div>

      <div className={styles.readingArea}>
        <div className={styles.scrollArea} data-page-scroll>
          {activeFormat === "epub" ? (
            <article className={styles.epubArticle} style={{ fontSize: `${15 * fontScale}px` }}>
              <div className={styles.bookFolio}>
                <span>The Shape of Attention</span>
                <span>{CHAPTERS[chapter].section}</span>
              </div>
              <h1>{CHAPTERS[chapter].title}</h1>
              <p className={styles.lead}>
                Reading asks us to hold one thing in view long enough for it to become more than
                information. The page offers a pace of its own, and we can choose to meet it.
              </p>
              <p>
                We are used to treating attention as a resource to spend. Yet the most useful
                passages often ask for a different kind of exchange: a pause, a return, a few words
                written in the margin.{" "}
                <button
                  ref={passage}
                  type="button"
                  className={styles.inlineHighlight}
                  onClick={() => setNotesOpen(true)}
                >
                  A margin gives thought somewhere to land.
                </button>{" "}
                The note does not need to be polished; it only needs to preserve what mattered at
                the moment of reading.
              </p>
              <p>
                A book becomes part of a working library when its ideas can be found again. A line
                remembered without its setting is easily distorted. Keep the chapter, the passage,
                and your own response together, and the next visit begins with context instead of a
                guess.
              </p>
              <p>
                That is the quiet promise of a reading workspace: room for the source, room for a
                reaction, and a reliable path back from one to the other.
              </p>
              <div className={styles.chapterEnd}>
                End of {CHAPTERS[chapter].section.toLowerCase()}
              </div>
            </article>
          ) : (
            <div className={styles.pdfDesk}>
              {noText ? (
                <div className={styles.noTextNotice} role="status">
                  <ScanText size={17} aria-hidden />
                  <div>
                    <strong>No selectable text on this page</strong>
                    <p>
                      Page notes still work. Highlights and document-based Agent answers need a text
                      layer.
                    </p>
                  </div>
                </div>
              ) : null}
              <article
                className={`${styles.pdfPage}${noText ? ` ${styles.noTextPage}` : ""}`}
                aria-label={`PDF page ${page}`}
                style={{
                  width: `${Math.round((478 * zoom) / 100)}px`,
                  fontSize: `${(12 * zoom) / 100}px`,
                }}
              >
                <div className={styles.pdfRunningHead}>
                  <span>FIELD NOTES ON DEEP READING</span>
                  <span>RESEARCH SERIES</span>
                </div>
                <h1>Attention as a practice</h1>
                <p>
                  A document is easier to understand when we can see how its claims connect. Marking
                  an important sentence is the beginning of that work, rather than its conclusion.
                </p>
                <p>
                  In the course of a longer reading session, a small observation can become the
                  question that organizes everything which follows.{" "}
                  {noText ? (
                    <span className={styles.scanHighlight}>
                      Keep the passage and the page together.
                    </span>
                  ) : (
                    <button
                      ref={passage}
                      type="button"
                      className={styles.inlineHighlight}
                      onClick={() => setNotesOpen(true)}
                    >
                      Keep the passage and the page together.
                    </button>
                  )}{" "}
                  A useful annotation records both the idea and where it came from.
                </p>
                <p>
                  When a note returns to the exact page, readers can check the surrounding argument.
                  That trace makes later summaries and conversations more trustworthy.
                </p>
                <div className={styles.pdfPageNumber}>{page}</div>
              </article>
              <p className={styles.pdfCaption}>Sample PDF page · original layout preview</p>
            </div>
          )}
        </div>

        {notesOpen ? (
          <div className={styles.drawerLayer}>
            <button
              type="button"
              className={styles.drawerScrim}
              aria-label="Close notes"
              onClick={() => closeNotes()}
            />
            <aside
              id="reader-preview-notes"
              className={styles.notesDrawer}
              aria-label="Notes and highlights"
            >
              <header className={styles.drawerHeader}>
                <div>
                  <strong>Notes & highlights</strong>
                  <span>
                    {activeFormat === "epub" ? CHAPTERS[chapter].section : `Page ${page}`}
                  </span>
                </div>
                <button type="button" aria-label="Close notes" onClick={() => closeNotes()}>
                  <X size={17} aria-hidden />
                </button>
              </header>
              <div className={styles.noteBody}>
                <div className={styles.noteSource}>
                  <Highlighter size={16} aria-hidden />
                  <span>
                    {noText && activeFormat === "pdf" ? "Page note" : "Highlighted passage"}
                  </span>
                </div>
                <blockquote>
                  {activeFormat === "epub"
                    ? "A margin gives thought somewhere to land."
                    : noText
                      ? `Page ${page} · no text layer`
                      : "Keep the passage and the page together."}
                </blockquote>
                <p className={styles.noteText}>
                  {activeFormat === "epub"
                    ? "A useful reminder that notes can preserve the question, not just the answer."
                    : "The page reference keeps this observation connected to its original argument."}
                </p>
                <button
                  type="button"
                  className={styles.jumpLink}
                  onClick={() => closeNotes(!noText)}
                >
                  Return to {activeFormat === "epub" ? "passage" : "page"}
                  <ChevronRight size={15} aria-hidden />
                </button>
              </div>
              <div className={styles.drawerFoot}>Sample annotation · design preview</div>
            </aside>
          </div>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <div className={styles.progressLabel}>
          <span>{activeFormat === "epub" ? "Book progress" : "Document progress"}</span>
          <strong>{progress}%</strong>
        </div>
        <progress
          className={styles.progress}
          value={progress}
          max={100}
          aria-label={activeFormat === "epub" ? "Book progress" : "Document progress"}
        />
        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.pageButton}
            disabled={activeFormat === "epub" ? chapter === 0 : page === 1}
            onClick={() =>
              activeFormat === "epub" ? changeChapter(chapter - 1) : changePage(page - 1)
            }
          >
            <ChevronLeft size={16} aria-hidden />
            <span>Previous {activeFormat === "epub" ? "chapter" : "page"}</span>
          </button>
          <span className={styles.footerLocation}>{location}</span>
          <button
            type="button"
            className={styles.pageButton}
            disabled={
              activeFormat === "epub" ? chapter === CHAPTERS.length - 1 : page === PDF_PAGE_COUNT
            }
            onClick={() =>
              activeFormat === "epub" ? changeChapter(chapter + 1) : changePage(page + 1)
            }
          >
            <span>Next {activeFormat === "epub" ? "chapter" : "page"}</span>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        {askQueued ? (
          <p className={styles.askStatus} role="status">
            <Check size={14} aria-hidden /> Selected source ready for the Agent preview.
          </p>
        ) : (
          <button
            type="button"
            className={styles.askButton}
            disabled={activeFormat === "pdf" && noText}
            onClick={() => setAskQueued(true)}
          >
            Ask Agent about this {activeFormat === "epub" ? "chapter" : "page"}
          </button>
        )}
      </footer>
    </section>
  );
}
