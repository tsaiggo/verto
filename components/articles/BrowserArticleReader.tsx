"use client";

import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FilePenLine, Loader2, TriangleAlert } from "lucide-react";
import {
  articleFormat,
  browserArticleEditorHref,
  readBrowserArticle,
  subscribeBrowserArticles,
  type BrowserArticle,
} from "@/lib/browser-articles";
import { estimateReadingTime } from "@/lib/reading-time";
import { extractTOC } from "@/lib/toc";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import ReaderWorkspace from "@/components/reader/ReaderWorkspace";
import { DocMasthead } from "@/components/reader/DocMasthead";
import TableOfContents from "@/components/layout/TableOfContents";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import AnnotationsLayer from "@/components/reader/AnnotationsLayer";
import {
  articleLibrarySection,
  browserArticleReadingBody,
  browserArticleToContentNode,
} from "./browser-library-docs";
import { PageBreadcrumbs } from "./PageBreadcrumbs";
import { useBrowserArticles } from "./useBrowserArticles";
import styles from "./BrowserArticleReader.module.css";
import { isTauri } from "@/lib/tauri";
import { ManagedBookRuntime } from "@/components/books/MdxBookRuntime";
import { MdxBookActions } from "@/components/books/MdxBookActions";
import ArticleNavigation from "./ArticleNavigation";

interface ArticleReadState {
  status: "loading" | "ready" | "missing" | "error";
  article: BrowserArticle | null;
  newer: BrowserArticle | null;
  error: string | null;
}

function useBrowserArticle(id: string) {
  const [retryRevision, setRetryRevision] = useState(0);
  const [state, setState] = useState<ArticleReadState>({
    status: "loading",
    article: null,
    newer: null,
    error: null,
  });
  const retry = useCallback(() => setRetryRevision((value) => value + 1), []);
  const loadLatest = useCallback(() => {
    setState((previous) =>
      previous.newer
        ? { status: "ready", article: previous.newer, newer: null, error: null }
        : previous
    );
  }, []);

  useEffect(() => {
    let active = true;
    let requestRevision = 0;
    const refresh = () => {
      if (!active) return;
      const request = ++requestRevision;
      readBrowserArticle(id).then(
        (article) => {
          if (!active || request !== requestRevision) return;
          setState((previous) => {
            if (!article) return { status: "missing", article: null, newer: null, error: null };
            if (previous.article && previous.article.revision !== article.revision) {
              // Keep reading and annotation anchors stable until the reader
              // intentionally loads an update saved in another window.
              return { ...previous, status: "ready", newer: article, error: null };
            }
            return { status: "ready", article, newer: null, error: null };
          });
        },
        (error: unknown) => {
          if (!active || request !== requestRevision) return;
          setState((previous) => ({
            ...previous,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      );
    };
    const unsubscribe = subscribeBrowserArticles(refresh);
    queueMicrotask(refresh);
    return () => {
      active = false;
      requestRevision++;
      unsubscribe();
    };
  }, [id, retryRevision]);

  return { ...state, retry, loadLatest };
}

export function BrowserArticleReaderFallback() {
  return (
    <ReaderWorkspace state="loading" documentLabel="Loading article">
      <div className={styles.state} role="status" aria-busy="true">
        <Loader2 className={styles.spinner} aria-hidden />
        <h1>Opening your article</h1>
        <p>
          {isTauri()
            ? "Loading the document saved on this device."
            : "Loading the document saved in this browser."}
        </p>
      </div>
    </ReaderWorkspace>
  );
}

function ArticleReadFailure({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <ReaderWorkspace documentLabel="Article unavailable">
      <section className={styles.state} role="alert">
        <TriangleAlert aria-hidden />
        <h1>{title}</h1>
        <p>{description}</p>
        <div className={styles.actions}>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          <Link href="/library">
            <ArrowLeft aria-hidden />
            Back to library
          </Link>
        </div>
      </section>
    </ReaderWorkspace>
  );
}

export default function BrowserArticleReader() {
  const id = useSearchParams()?.get("document")?.trim() ?? "";
  if (!id) {
    return (
      <ArticleReadFailure
        title="Choose an article to read"
        description={
          isTauri()
            ? "Open a saved article from your desktop library."
            : "Open a saved article from your browser library."
        }
      />
    );
  }
  return <SavedBrowserArticle key={id} id={id} />;
}

function SavedBrowserArticle({ id }: { id: string }) {
  const state = useBrowserArticle(id);
  const article = state.article;
  const file = useMemo(() => (article ? browserArticleToContentNode(article) : null), [article]);
  const body = useMemo(() => (article ? browserArticleReadingBody(article) : ""), [article]);
  const toc = useMemo(() => extractTOC(body), [body]);
  const doc = useMemo(
    () => (file ? { href: file.href, slug: file.slug, title: file.title } : undefined),
    [file]
  );

  if (state.status === "loading") return <BrowserArticleReaderFallback />;
  if (state.status === "missing") {
    return (
      <ArticleReadFailure
        title={
          isTauri()
            ? "This article isn’t saved on this device"
            : "This article isn’t in this browser"
        }
        description="It may have been removed, or saved on a different device or browser address. Open your library to choose another article."
        onRetry={state.retry}
      />
    );
  }
  if (!article || !file) {
    return (
      <ArticleReadFailure
        title="Your article couldn’t be opened"
        description={
          state.error ||
          "Browser storage is unavailable. Your saved articles have not been changed."
        }
        onRetry={state.retry}
      />
    );
  }

  return (
    <ReaderWorkspace
      navigation={
        <ArticleNavigation
          articleId={id}
          toc={toc.length > 0 ? <TableOfContents items={toc} /> : undefined}
        />
      }
      masthead={
        <>
          {article.parentId ? (
            <SavedArticleBreadcrumbs article={article} />
          ) : (
            <PageBreadcrumbs article={article} articles={[article]} />
          )}
          <DocMasthead
            file={file}
            category={articleLibrarySection()}
            readingMinutes={estimateReadingTime(body)}
            editHref={browserArticleEditorHref(id)}
          />
          <MdxBookActions
            key={id}
            articleId={id}
            parentId={article.parentId}
            source={article.source}
          />
        </>
      }
      toc={toc.length > 0 ? <TableOfContents items={toc} /> : undefined}
      doc={doc}
      documentLabel="Article content"
      citationSource={{ source: article.source, revision: article.revision }}
    >
      {state.status === "error" ? (
        <div className={styles.notice} role="alert">
          <p>
            New saved changes couldn’t be checked. This is the last article you opened.{" "}
            {state.error}
          </p>
          <button type="button" onClick={state.retry}>
            Retry
          </button>
        </div>
      ) : state.newer ? (
        <div className={styles.notice} role="status">
          <p>
            A newer version was saved in another window. Your current reading position is unchanged.
          </p>
          <button type="button" onClick={state.loadLatest}>
            Reload latest
          </button>
        </div>
      ) : null}
      <article className="content-wrap prose" data-article>
        <ArticleRenderBoundary
          key={`${id}:${article.revision}`}
          editHref={browserArticleEditorHref(id)}
        >
          <InlineCommentProvider>
            <ManagedBookRuntime
              key={id}
              articleId={id}
              parentId={article.parentId}
              source={article.source}
            >
              <ReadingStateTracker
                href={file.href}
                slug={file.slug}
                title={file.title}
                path={article.filename}
              />
              <RuntimeDocument source={body} format={articleFormat(article.filename)} />
              <AnnotationsLayer
                docSlug={file.slug.join("/")}
                share={{ title: file.title, author: "Verto", tags: [], href: file.href }}
              />
            </ManagedBookRuntime>
          </InlineCommentProvider>
        </ArticleRenderBoundary>
      </article>
    </ReaderWorkspace>
  );
}

function SavedArticleBreadcrumbs({ article }: { article: BrowserArticle }) {
  const pages = useBrowserArticles();
  return <PageBreadcrumbs article={article} articles={pages.articles} />;
}

class ArticleRenderBoundary extends Component<
  { children: ReactNode; editHref: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={styles.renderFailure} role="alert">
        <h2>This document couldn’t be rendered</h2>
        <p>The saved source is unchanged. Open the editor to correct its Markdown or MDX syntax.</p>
        <Link href={this.props.editHref}>
          <FilePenLine aria-hidden />
          Open editor
        </Link>
      </div>
    );
  }
}
