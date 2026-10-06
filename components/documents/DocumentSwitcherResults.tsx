"use client";

import type { MouseEvent, RefObject } from "react";
import Link from "next/link";
import { BookOpen, Check, FileText } from "lucide-react";
import type { DocumentSwitcherEntry, selectDocumentSwitcherResults } from "@/lib/document-switcher";
import styles from "./DocumentSwitcher.module.css";

export default function DocumentSwitcherResults({
  listRef,
  listId,
  loading,
  errors,
  results,
  activeKey,
  query,
  mode,
  onActivate,
  onPick,
  onRetry,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  listId: string;
  loading: boolean;
  errors: string[];
  results: ReturnType<typeof selectDocumentSwitcherResults>;
  activeKey: string | null;
  query: string;
  mode: "read" | "edit";
  onActivate: (key: string) => void;
  onPick: (entry: DocumentSwitcherEntry, event: MouseEvent<HTMLAnchorElement>) => void;
  onRetry: () => void;
}) {
  const indexed = results.map((result, index) => ({ ...result, index }));
  const groups = query.trim()
    ? [{ label: "Search results", items: indexed }]
    : [
        { label: "Recent", items: indexed.filter((item) => item.recent) },
        { label: "All documents", items: indexed.filter((item) => !item.recent) },
      ];
  return (
    <div className={styles.results} ref={listRef}>
      {loading ? (
        <p className={styles.notice} role="status">
          Loading documents…
        </p>
      ) : null}
      {errors.length ? (
        <div className={styles.error} role="alert">
          <p>{errors.join(" ")}</p>
          <button type="button" onClick={onRetry}>
            Retry documents
          </button>
        </div>
      ) : null}
      <div id={listId} role="listbox" aria-label="Documents" aria-busy={loading}>
        {groups
          .filter((group) => group.items.length)
          .map((group) => (
            <div key={group.label} role="group" aria-label={group.label}>
              {!query.trim() ? (
                <p className={styles.groupLabel} aria-hidden>
                  {group.label}
                </p>
              ) : null}
              {group.items.map(({ entry, index }) => (
                <Link
                  key={entry.key}
                  href={entry.href}
                  prefetch={false}
                  role="option"
                  tabIndex={-1}
                  id={`${listId}-${index}`}
                  className={styles.option}
                  aria-label={entry.title}
                  aria-selected={entry.current}
                  aria-current={entry.current ? "page" : undefined}
                  data-active={entry.key === activeKey}
                  data-document-kind={entry.kind}
                  onPointerMove={() => onActivate(entry.key)}
                  onClick={(event) => onPick(entry, event)}
                >
                  {entry.kind === "epub" ? <BookOpen aria-hidden /> : <FileText aria-hidden />}
                  <span className={styles.identity}>
                    <span className={styles.title}>{entry.title}</span>
                    <span className={styles.path} title={entry.path}>
                      {entry.path}
                    </span>
                    <span className={styles.metadata}>
                      <span>{entry.sourceLabel}</span>
                      {entry.kind === "pdf" || entry.kind === "epub" ? (
                        <span>{entry.kind.toUpperCase()}</span>
                      ) : null}
                      {entry.draft ? <span>Draft</span> : null}
                      {entry.current ? <span>Current</span> : null}
                    </span>
                  </span>
                  {entry.current ? <Check className={styles.check} aria-hidden /> : null}
                </Link>
              ))}
            </div>
          ))}
      </div>
      {!results.length && !loading ? (
        <p className={styles.notice} role="status">
          {query.trim()
            ? "No documents match this search."
            : mode === "edit"
              ? "Your saved articles and drafts will appear here."
              : "Your library documents will appear here."}
        </p>
      ) : null}
    </div>
  );
}
