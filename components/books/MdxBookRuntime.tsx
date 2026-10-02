"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MdxBookSnapshot } from "@/lib/mdx-books/types";
import { findMdxBookForArticle, readMdxBookSnapshot } from "@/lib/mdx-books/storage";
import {
  bookIdInSource,
  bookPageLinks,
  portableBookPath,
  resolveBookHref,
} from "@/lib/mdx-books/paths";
import { BookRuntimeContext } from "./BookRuntimeContext";
import styles from "./BookActions.module.css";

export function MdxBookRuntimeProvider({
  snapshot,
  children,
  preview = false,
}: {
  snapshot: MdxBookSnapshot;
  children: ReactNode;
  preview?: boolean;
}) {
  const [resources, setResources] = useState<{
    owner: MdxBookSnapshot;
    urls: Map<string, string>;
  }>();
  useEffect(() => {
    let active = true;
    const urls = new Map<string, string>();
    queueMicrotask(() => {
      if (!active) return;
      for (const asset of snapshot.assets)
        urls.set(
          `assets/${asset.filename}`,
          URL.createObjectURL(new Blob([asset.bytes], { type: asset.mime }))
        );
      setResources({ owner: snapshot, urls });
    });
    return () => {
      active = false;
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [snapshot]);
  const pages = useMemo(() => bookPageLinks(snapshot), [snapshot]);
  const value = useMemo(
    () => ({
      preview,
      image(source: string) {
        const target = portableBookPath(source);
        if (target?.path.startsWith("assets/"))
          return resources?.owner === snapshot ? resources.urls.get(target.path) : undefined;
        // Converted books contain only packaged images. Editing must not silently
        // start fetching remote tracking resources from an imported publication.
        return undefined;
      },
      link(href: string) {
        const resolved = resolveBookHref(href, pages);
        if (preview && resolved?.startsWith("/read/local?")) return undefined;
        return resolved;
      },
    }),
    [pages, preview, resources, snapshot]
  );
  return (
    <BookRuntimeContext.Provider value={value}>
      {resources?.owner === snapshot ? (
        children
      ) : (
        <p className={styles.message} role="status">
          Preparing book images…
        </p>
      )}
    </BookRuntimeContext.Provider>
  );
}

/** Articles without book metadata retain their ordinary render path. */
export function ManagedBookRuntime({
  articleId,
  parentId,
  source,
  children,
}: {
  articleId?: string;
  parentId?: string | null;
  source: string;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ articleId: string; snapshot: MdxBookSnapshot | null }>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const isBook = !!bookIdInSource(source);
  useEffect(() => {
    let active = true;
    if (!articleId) return;
    void findMdxBookForArticle(articleId)
      .then(async (book) => {
        if (!book && isBook)
          throw new Error(
            "The associated book is missing. Restore or convert its original EPUB again."
          );
        const next = book ? await readMdxBookSnapshot(book.id) : null;
        if (active) {
          setLoaded({ articleId, snapshot: next });
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, [articleId, parentId, retry, isBook]);
  if (loaded && loaded.articleId === articleId && loaded.snapshot)
    return <MdxBookRuntimeProvider snapshot={loaded.snapshot}>{children}</MdxBookRuntimeProvider>;
  if (!articleId || !isBook) return children;
  if (error)
    return (
      <div className={styles.message} role="alert">
        <p>Book resources could not be opened. {error}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Retry book resources
        </button>
      </div>
    );
  return (
    <p className={styles.message} role="status">
      Opening book resources…
    </p>
  );
}
