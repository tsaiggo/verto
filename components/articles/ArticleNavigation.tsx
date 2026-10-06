"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, FilePlus2, FileText, Search } from "lucide-react";
import {
  articleBody,
  articleDisplayTitle,
  articleFormat,
  browserArticleEditorHref,
  browserArticleHref,
  type BrowserArticle,
} from "@/lib/browser-articles";
import { findMdxBookForArticle } from "@/lib/mdx-books/storage";
import type { BookTocItem, MdxBookRecord } from "@/lib/mdx-books/types";
import { isTauri } from "@/lib/tauri";
import {
  articleAncestors,
  articleDescendantIds,
  buildArticlePageTree,
  type ArticlePageNode,
} from "./page-hierarchy";
import { useBrowserArticles } from "./useBrowserArticles";
import styles from "./ArticleNavigation.module.css";

interface NavigationChapter {
  article: BrowserArticle;
  title: string;
  anchor?: string;
  primary: boolean;
  children: NavigationChapter[];
}

interface NavigationDocument {
  article: BrowserArticle;
  excerpt: string;
  children: NavigationDocument[];
}

export interface SourceNavigationDocument {
  title: string;
  href: string;
  description?: string;
  tags?: string[];
  section?: string;
}

/** Keep imported section labels, while page names and deleted pages follow the live library. */
function liveBookChapters(items: BookTocItem[], articles: Map<string, BrowserArticle>) {
  const seen = new Set<string>();
  const visit = (entries: BookTocItem[]): NavigationChapter[] =>
    entries.flatMap((item) => {
      const article = articles.get(item.articleId);
      const primary = !seen.has(item.articleId);
      if (article) seen.add(item.articleId);
      const children = visit(item.children);
      if (!article) return children;
      return [
        {
          article,
          title: primary ? articleDisplayTitle(article) : item.title,
          anchor: item.anchor,
          primary,
          children,
        },
      ];
    });
  return { chapters: visit(items), seen };
}

function filterChapters(chapters: NavigationChapter[], query: string): NavigationChapter[] {
  if (!query) return chapters;
  return chapters.flatMap((chapter) => {
    if (`${chapter.title} ${chapter.article.filename}`.toLocaleLowerCase().includes(query))
      return [chapter];
    const children = filterChapters(chapter.children, query);
    return children.length ? [{ ...chapter, children }] : [];
  });
}

function articleExcerpt(article: BrowserArticle): string {
  return articleBody(article.source)
    .slice(0, 1800)
    .replace(/^\s*#[^\r\n]*(?:\r?\n|$)/, "")
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, " ")
    .replace(/<[^>]*>|\{[^}]*\}/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(?:^|\n)\s*[#>*-]+\s*/g, " ")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function articleHref(articleId: string, mode: "read" | "edit", anchor?: string) {
  const href =
    mode === "edit" ? browserArticleEditorHref(articleId) : browserArticleHref(articleId);
  return mode === "read" && anchor ? `${href}#${encodeURIComponent(anchor)}` : href;
}

function documentHierarchy(articles: BrowserArticle[]): NavigationDocument[] {
  const positions = new Map(articles.map((article, index) => [article.id, index]));
  const roots = buildArticlePageTree(articles, { includeDrafts: true });
  // Root cards retain the existing recent-first ordering; children follow page order.
  roots.sort(
    (left, right) => (positions.get(left.article.id) ?? 0) - (positions.get(right.article.id) ?? 0)
  );
  const visit = (nodes: ArticlePageNode[]): NavigationDocument[] =>
    nodes.map(({ article, children }) => ({
      article,
      excerpt: articleExcerpt(article),
      children: visit(children),
    }));
  return visit(roots);
}

function filterDocuments(nodes: NavigationDocument[], query: string): NavigationDocument[] {
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    if (
      `${articleDisplayTitle(node.article)} ${node.article.filename} ${node.excerpt}`
        .toLocaleLowerCase()
        .includes(query)
    )
      return [node];
    const children = filterDocuments(node.children, query);
    return children.length ? [{ ...node, children }] : [];
  });
}

function branchIds(nodes: NavigationDocument[]): string[] {
  return nodes.flatMap((node) =>
    node.children.length ? [node.article.id, ...branchIds(node.children)] : []
  );
}

export default function ArticleNavigation({
  articleId,
  mode = "read",
  toc,
  sourceDocuments,
  activeHref,
}: {
  articleId?: string;
  mode?: "read" | "edit";
  toc?: ReactNode;
  sourceDocuments?: SourceNavigationDocument[];
  activeHref?: string;
}) {
  const supplied = sourceDocuments !== undefined;
  const local = useBrowserArticles({ enabled: !supplied });
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [retryRevision, setRetryRevision] = useState(0);
  const [owner, setOwner] = useState<{
    articleId: string;
    book: MdxBookRecord | null;
    error: string | null;
  }>();
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!articleId || supplied) return;
    let active = true;
    void findMdxBookForArticle(articleId).then(
      (book) => {
        if (active) setOwner({ articleId, book, error: null });
      },
      (cause: unknown) => {
        if (active)
          setOwner((previous) => ({
            articleId,
            book: previous?.articleId === articleId ? previous.book : null,
            error: cause instanceof Error ? cause.message : String(cause),
          }));
      }
    );
    return () => {
      active = false;
    };
  }, [articleId, local.articles, supplied, retryRevision]);
  const currentOwner = owner?.articleId === articleId ? owner : undefined;
  const book = supplied ? null : currentOwner?.book;
  const searching = query.trim().toLocaleLowerCase();
  const byId = useMemo(
    () => new Map(local.articles.map((article) => [article.id, article])),
    [local.articles]
  );
  const bookNavigation = useMemo(() => {
    if (!book) return null;
    const imported = liveBookChapters(book.toc, byId);
    const members = articleDescendantIds(local.articles, book.rootArticleId);
    book.chapterFiles.forEach((chapter) => members.add(chapter.articleId));
    const ordered = new Map(book.chapterFiles.map((chapter, index) => [chapter.articleId, index]));
    const extra = local.articles
      .filter(
        (article) =>
          members.has(article.id) &&
          article.id !== book.rootArticleId &&
          !imported.seen.has(article.id)
      )
      .sort(
        (left, right) =>
          (ordered.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (ordered.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
          (left.order ?? 0) - (right.order ?? 0) ||
          left.createdAt.localeCompare(right.createdAt)
      );
    return {
      chapters: filterChapters(imported.chapters, searching),
      extra: extra.filter((article) =>
        `${articleDisplayTitle(article)} ${article.filename}`
          .toLocaleLowerCase()
          .includes(searching)
      ),
    };
  }, [book, byId, local.articles, searching]);
  const hierarchyCards = useMemo(
    () => (book || supplied ? [] : documentHierarchy(local.articles)),
    [book, supplied, local.articles]
  );
  const documents = useMemo(
    () => filterDocuments(hierarchyCards, searching),
    [hierarchyCards, searching]
  );
  useEffect(() => {
    const openIds = searching
      ? branchIds(documents)
      : articleId
        ? articleAncestors(local.articles, articleId).map((article) => article.id)
        : [];
    if (!openIds.length) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setCollapsed((previous) => {
        if (!openIds.some((id) => previous.has(id))) return previous;
        const next = new Set(previous);
        openIds.forEach((id) => next.delete(id));
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [articleId, local.articles, documents, searching]);
  const toggleBranch = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const initialLoading =
    !supplied &&
    ((local.status === "loading" && !local.articles.length) || (!!articleId && !currentOwner));
  const sourceMatches = useMemo(
    () =>
      sourceDocuments?.filter((document) =>
        `${document.title} ${document.description ?? ""} ${document.section ?? ""} ${document.tags?.join(" ") ?? ""}`
          .toLocaleLowerCase()
          .includes(searching)
      ) ?? [],
    [sourceDocuments, searching]
  );
  const rootArticle = book ? byId.get(book.rootArticleId) : undefined;
  const bookTitle = rootArticle ? articleDisplayTitle(rootArticle) : book?.title;
  const resultCount = bookNavigation
    ? bookNavigation.chapters.length + bookNavigation.extra.length
    : documents.length;
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const revealCurrent = () =>
      list
        .querySelector<HTMLElement>("[aria-current='page']")
        ?.scrollIntoView?.({ block: "nearest" });
    revealCurrent();
    if (typeof ResizeObserver === "undefined") return;
    let visible = list.clientWidth > 0 && list.clientHeight > 0;
    const observer = new ResizeObserver(() => {
      const nextVisible = list.clientWidth > 0 && list.clientHeight > 0;
      if (nextVisible && !visible) revealCurrent();
      visible = nextVisible;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [articleId, activeHref, book?.id, local.status, initialLoading, documents, collapsed]);

  return (
    <section className={styles.navigation} aria-label="Document navigation">
      <header className={styles.header}>
        <div className={styles.heading}>
          {book ? <BookOpen aria-hidden /> : <FileText aria-hidden />}
          <h2>{book ? "Chapters" : "Documents"}</h2>
          <Link
            href={isTauri() ? "/editor?managed=1" : "/editor"}
            className={styles.newPage}
            aria-label="Create article"
            title="Create article"
          >
            <FilePlus2 aria-hidden />
          </Link>
        </div>
        {bookTitle ? (
          <p className={styles.bookTitle} title={bookTitle}>
            {bookTitle}
          </p>
        ) : null}
        {book?.author ? <p className={styles.author}>{book.author}</p> : null}
        <label className={styles.search}>
          <Search aria-hidden />
          <input
            type="search"
            aria-label={book ? "Search chapters" : "Search documents"}
            placeholder={book ? "Search chapters" : "Search documents"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      <div className={styles.content} ref={listRef} data-document-navigation-scroll>
        {!supplied && local.status === "error" ? (
          <div className={styles.notice} role="alert">
            <p>Documents couldn’t load. {local.error}</p>
            <button type="button" onClick={local.retry}>
              Retry documents
            </button>
          </div>
        ) : null}
        {!supplied && currentOwner?.error ? (
          <div className={styles.notice} role="alert">
            <p>Book navigation couldn’t be checked. {currentOwner.error}</p>
            <button type="button" onClick={() => setRetryRevision((revision) => revision + 1)}>
              Retry book navigation
            </button>
          </div>
        ) : null}
        {supplied ? (
          <>
            <nav aria-label="Source documents">
              <ul className={styles.documents}>
                {sourceMatches.map((document) => (
                  <li key={document.href}>
                    <Link
                      href={document.href}
                      className={styles.document}
                      aria-current={document.href === activeHref ? "page" : undefined}
                    >
                      <div className={styles.documentTitle}>
                        <FileText aria-hidden />
                        <span>{document.title}</span>
                      </div>
                      {document.description ? (
                        <p className={styles.excerpt}>{document.description}</p>
                      ) : null}
                      {document.section || document.tags?.length ? (
                        <div className={styles.metadata}>
                          {document.section ? (
                            <span className={styles.source}>{document.section}</span>
                          ) : null}
                          {document.tags?.map((tag) => (
                            <span className={styles.source} key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {!sourceMatches.length ? (
              <p className={styles.empty}>
                {searching
                  ? "No documents match this search."
                  : "No documents are available from this source."}
              </p>
            ) : null}
          </>
        ) : initialLoading ? (
          <p className={styles.empty} role="status">
            Loading documents…
          </p>
        ) : local.status === "error" && !local.articles.length ? null : book && bookNavigation ? (
          <>
            {rootArticle ? (
              <Link
                className={styles.bookHome}
                href={articleHref(rootArticle.id, mode)}
                aria-current={articleId === rootArticle.id ? "page" : undefined}
              >
                <BookOpen aria-hidden />
                <span>Book overview</span>
              </Link>
            ) : (
              <p className={styles.empty}>The book overview was removed.</p>
            )}
            <nav aria-label="Book chapters">
              <ChapterList chapters={bookNavigation.chapters} articleId={articleId} mode={mode} />
              {bookNavigation.extra.length ? (
                <ul className={styles.chapters}>
                  {bookNavigation.extra.map((article) => (
                    <li key={article.id}>
                      <Link
                        className={styles.chapter}
                        href={articleHref(article.id, mode)}
                        aria-current={article.id === articleId ? "page" : undefined}
                      >
                        <FileText aria-hidden />
                        <span>{articleDisplayTitle(article)}</span>
                        {article.status === "draft" ? (
                          <span className={styles.draft}>Draft</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </nav>
            {!resultCount ? (
              <p className={styles.empty}>
                {searching ? "No chapters match this search." : "No chapters remain in this book."}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <nav aria-label="Local articles">
              <DocumentCards
                documents={documents}
                articleId={articleId}
                mode={mode}
                collapsed={collapsed}
                onToggle={toggleBranch}
              />
            </nav>
            {!documents.length && local.status !== "error" ? (
              <p className={styles.empty}>
                {searching
                  ? "No documents match this search."
                  : "Your saved articles and drafts will appear here."}
              </p>
            ) : null}
          </>
        )}
        {toc ? (
          <details className={styles.outline}>
            <summary>On this page</summary>
            {toc}
          </details>
        ) : null}
      </div>
      <footer className={styles.footer}>
        <Link href="/library">Browse library</Link>
        <span>
          {book
            ? "Editable EPUB"
            : supplied
              ? `${sourceDocuments.length} documents`
              : "Local articles"}
        </span>
      </footer>
    </section>
  );
}

function DocumentCards({
  documents,
  articleId,
  mode,
  collapsed,
  onToggle,
  nested = false,
}: {
  documents: NavigationDocument[];
  articleId?: string;
  mode: "read" | "edit";
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  nested?: boolean;
}) {
  return (
    <ul
      className={nested ? styles.documentBranch : styles.documents}
      aria-label={nested ? undefined : "Documents"}
    >
      {documents.map(({ article, excerpt, children }) => {
        const title = articleDisplayTitle(article);
        const open = !collapsed.has(article.id);
        return (
          <li key={article.id}>
            <div className={styles.documentCard}>
              <Link
                className={`${styles.document}${children.length ? ` ${styles.parentDocument}` : ""}`}
                href={articleHref(article.id, mode)}
                aria-label={title}
                aria-current={article.id === articleId ? "page" : undefined}
              >
                <div className={styles.documentTitle}>
                  <FileText aria-hidden />
                  <span>{title}</span>
                </div>
                {excerpt ? <p className={styles.excerpt}>{excerpt}</p> : null}
                <div className={styles.metadata}>
                  <span className={styles.source}>
                    Local · {articleFormat(article.filename).toUpperCase()}
                  </span>
                  <span className={article.status === "draft" ? styles.draft : styles.status}>
                    {article.status === "draft" ? "Draft" : "Saved"}
                  </span>
                  <time dateTime={article.updatedAt}>
                    {new Date(article.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </Link>
              {children.length ? (
                <button
                  type="button"
                  className={styles.disclosure}
                  aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
                  aria-expanded={open}
                  onClick={() => onToggle(article.id)}
                >
                  <ChevronRight className={open ? styles.expanded : undefined} aria-hidden />
                </button>
              ) : null}
            </div>
            {open && children.length ? (
              <DocumentCards
                documents={children}
                articleId={articleId}
                mode={mode}
                collapsed={collapsed}
                onToggle={onToggle}
                nested
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ChapterList({
  chapters,
  articleId,
  mode,
}: {
  chapters: NavigationChapter[];
  articleId?: string;
  mode: "read" | "edit";
}) {
  return (
    <ol className={styles.chapters}>
      {chapters.map((chapter, index) => (
        <li key={`${chapter.article.id}:${chapter.anchor ?? "page"}:${index}`}>
          <Link
            className={styles.chapter}
            href={articleHref(chapter.article.id, mode, chapter.anchor)}
            aria-current={chapter.article.id === articleId && chapter.primary ? "page" : undefined}
          >
            {chapter.primary ? (
              <FileText aria-hidden />
            ) : (
              <span className={styles.sectionMarker} aria-hidden />
            )}
            <span>{chapter.title}</span>
            {chapter.primary && chapter.article.status === "draft" ? (
              <span className={styles.draft}>Draft</span>
            ) : null}
          </Link>
          {chapter.children.length ? (
            <ChapterList chapters={chapter.children} articleId={articleId} mode={mode} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
