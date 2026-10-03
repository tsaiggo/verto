"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronRight, FilePenLine, Loader2, Save, X } from "lucide-react";
import {
  articleBody,
  articleDisplayTitle,
  browserArticleEditorHref,
  browserArticleHref,
} from "@/lib/browser-articles";
import type { ImportedDocument } from "@/lib/imported-documents";
import { convertEpubToMdx } from "@/lib/mdx-books/convert";
import {
  listMdxBooks,
  MdxBookAlreadyExistsError,
  saveConvertedBook,
} from "@/lib/mdx-books/storage";
import type { BookTocItem, MdxBookDraft, MdxBookRecord } from "@/lib/mdx-books/types";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import { MdxBookRuntimeProvider } from "./MdxBookRuntime";
import styles from "./EpubConversion.module.css";

interface ConversionState {
  phase: "checking" | "converting" | "preview" | "saving" | "saved" | "existing" | "error";
  draft: MdxBookDraft | null;
  book: MdxBookRecord | null;
  error: string | null;
}

const initialState: ConversionState = { phase: "checking", draft: null, book: null, error: null };

function useEpubConversion(document: ImportedDocument, bytes: ArrayBuffer) {
  const [state, setState] = useState<ConversionState>(initialState);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  const saving = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function prepare() {
      setState(initialState);
      try {
        const existing = (await listMdxBooks()).find(
          (book) => book.sourceDocumentId === document.id
        );
        if (!active) return;
        if (existing) {
          setState({ phase: "existing", draft: null, book: existing, error: null });
          return;
        }
        setState({ phase: "converting", draft: null, book: null, error: null });
        const draft = await convertEpubToMdx(bytes, document);
        if (!active) return;
        setState({ phase: "preview", draft, book: null, error: null });
      } catch (cause) {
        if (active)
          setState({
            phase: "error",
            draft: null,
            book: null,
            error:
              cause instanceof Error
                ? cause.message
                : "The EPUB could not be converted. Try again.",
          });
      }
    }
    void prepare();
    return () => {
      active = false;
    };
  }, [bytes, document, retry]);

  async function save() {
    if (!state.draft || saving.current) return;
    const draft = state.draft;
    saving.current = true;
    setState((previous) => ({ ...previous, phase: "saving", error: null }));
    try {
      // Another window may have finished a conversion after this preview opened.
      const existing = (await listMdxBooks()).find((book) => book.sourceDocumentId === document.id);
      const book = existing ?? (await saveConvertedBook(draft));
      if (mounted.current)
        setState({ phase: existing ? "existing" : "saved", draft, book, error: null });
    } catch (cause) {
      if (mounted.current && cause instanceof MdxBookAlreadyExistsError) {
        setState({ phase: "existing", draft, book: cause.existingBook, error: null });
      } else if (mounted.current)
        setState({
          phase: "preview",
          draft,
          book: null,
          error:
            cause instanceof Error
              ? cause.message
              : "The MDX book could not be saved. Your preview is kept; try again.",
        });
    } finally {
      saving.current = false;
    }
  }

  return { state, save, retry: () => setRetry((value) => value + 1) };
}

/** Preview is transient. Only Save creates the editable book; the EPUB stays intact. */
export default function EpubConversion({
  document,
  bytes,
  id,
  onClose,
}: {
  document: ImportedDocument;
  bytes: ArrayBuffer;
  id: string;
  onClose: () => void;
}) {
  const { state, save, retry } = useEpubConversion(document, bytes);
  const draft = state.draft;
  const preparing = state.phase === "checking" || state.phase === "converting";
  const busy = ["checking", "converting", "saving"].includes(state.phase);
  return (
    <section
      id={id}
      className={styles.workflow}
      aria-label="EPUB to MDX conversion"
      aria-busy={busy}
    >
      <div className={styles.heading}>
        <div>
          <h2>Convert to MDX</h2>
          <p>
            Keep the original EPUB and create an editable book with chapter pages and local images.
          </p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close conversion"
          onClick={onClose}
          disabled={state.phase === "saving"}
        >
          <X aria-hidden />
        </button>
      </div>
      {preparing ? (
        <p className={styles.status} role="status">
          <Loader2 className={styles.spinner} aria-hidden />
          {state.phase === "checking"
            ? "Checking your library…"
            : "Preparing the book and its chapters…"}
        </p>
      ) : state.book ? (
        <div>
          <p className={styles.status} role="status">
            <Check aria-hidden />
            {state.phase === "existing"
              ? "An MDX book from this EPUB is already saved. Your existing edits are preserved."
              : "MDX book saved. The original EPUB is unchanged."}
          </p>
          <div className={styles.actions}>
            <Link href={browserArticleHref(state.book.rootArticleId)}>
              <BookOpen aria-hidden />
              Open MDX book
            </Link>
            <Link href={browserArticleEditorHref(state.book.rootArticleId)}>
              <FilePenLine aria-hidden />
              Edit book
            </Link>
          </div>
        </div>
      ) : draft ? (
        <>
          <ConversionDraftPreview key={draft.book.id} draft={draft} />
          <div className={styles.footer}>
            <p>
              Nothing is saved until you choose Save MDX book. Original EPUB content stays intact.
            </p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void save()}
              disabled={state.phase === "saving"}
            >
              {state.phase === "saving" ? (
                <Loader2 className={styles.spinner} aria-hidden />
              ) : (
                <Save aria-hidden />
              )}
              {state.phase === "saving"
                ? "Saving MDX book…"
                : state.error
                  ? "Retry saving MDX book"
                  : "Save MDX book"}
            </button>
          </div>
        </>
      ) : null}
      {state.error && (
        <div className={styles.error} role="alert">
          <p>{state.error}</p>
          {!draft && (
            <button type="button" onClick={retry}>
              Retry conversion
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ConversionDraftPreview({ draft }: { draft: MdxBookDraft }) {
  const [selectedId, setSelectedId] = useState(
    draft.book.chapterFiles[0]?.articleId ?? draft.book.rootArticleId
  );
  const [selectedAnchor, setSelectedAnchor] = useState<string | undefined>();
  const preview = useRef<HTMLDivElement>(null);
  const selected = draft.articles.find((article) => article.id === selectedId);
  const select = (articleId: string, anchor?: string) => {
    setSelectedId(articleId);
    setSelectedAnchor(anchor);
  };
  useEffect(() => {
    if (!selectedAnchor || !preview.current) return;
    const frame = requestAnimationFrame(() =>
      preview.current
        ?.querySelector(`#${CSS.escape(selectedAnchor)}`)
        ?.scrollIntoView({ block: "nearest" })
    );
    return () => cancelAnimationFrame(frame);
  }, [selectedId, selectedAnchor]);

  return (
    <>
      <div className={styles.summary}>
        <h3>{draft.book.title}</h3>
        {draft.book.author && <p>{draft.book.author}</p>}
        <p>
          {draft.book.chapterFiles.length} chapter pages · {draft.assets.length} local image
          {draft.assets.length === 1 ? "" : "s"}
        </p>
      </div>
      {draft.issues.length > 0 && (
        <details className={styles.issues}>
          <summary>Conversion notes ({draft.issues.length})</summary>
          <ul>
            {draft.issues.slice(0, 10).map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                {issue.chapter ? <strong>{issue.chapter}: </strong> : null}
                {issue.message}
              </li>
            ))}
          </ul>
          {draft.issues.length > 10 && <p>Showing the first 10 of {draft.issues.length} notes.</p>}
        </details>
      )}
      <div className={styles.content}>
        <nav className={styles.chapters} aria-label="Conversion chapters">
          <h3>Chapters</h3>
          {draft.book.toc.length ? (
            <ConversionToc
              items={draft.book.toc}
              selectedId={selectedId}
              selectedAnchor={selectedAnchor}
              onSelect={select}
            />
          ) : (
            <ul>
              {draft.book.chapterFiles.map((chapter) => {
                const article = draft.articles.find(
                  (candidate) => candidate.id === chapter.articleId
                );
                return (
                  <li key={chapter.articleId}>
                    <button
                      type="button"
                      aria-current={selectedId === chapter.articleId ? "page" : undefined}
                      onClick={() => select(chapter.articleId)}
                    >
                      {article ? articleDisplayTitle(article) : chapter.filename}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        <div
          className={styles.preview}
          ref={preview}
          data-conversion-preview
          aria-label="Converted chapter preview"
          tabIndex={0}
        >
          {selected ? (
            <ConversionPreviewBoundary key={`${selected.id}:${selected.source}`}>
              <MdxBookRuntimeProvider snapshot={draft} preview>
                <article className="prose">
                  <RuntimeDocument source={articleBody(selected.source)} format="mdx" />
                </article>
              </MdxBookRuntimeProvider>
            </ConversionPreviewBoundary>
          ) : (
            <p>Choose a chapter to preview its content.</p>
          )}
        </div>
      </div>
    </>
  );
}

function ConversionToc({
  items,
  selectedId,
  selectedAnchor,
  onSelect,
}: {
  items: BookTocItem[];
  selectedId: string;
  selectedAnchor?: string;
  onSelect: (articleId: string, anchor?: string) => void;
}) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={`${item.articleId}:${item.anchor ?? ""}:${index}`}>
          <button
            type="button"
            aria-current={
              selectedId === item.articleId && selectedAnchor === item.anchor ? "page" : undefined
            }
            onClick={() => onSelect(item.articleId, item.anchor)}
          >
            <ChevronRight aria-hidden />
            <span>{item.title}</span>
          </button>
          {item.children.length > 0 && (
            <ConversionToc
              items={item.children}
              selectedId={selectedId}
              selectedAnchor={selectedAnchor}
              onSelect={onSelect}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

class ConversionPreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">This chapter preview could not render. The original EPUB is unchanged.</p>
    ) : (
      this.props.children
    );
  }
}
