"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import {
  articleDisplayTitle,
  browserArticleEditorHref,
  browserArticleHref,
  type BrowserArticle,
} from "@/lib/browser-articles";
import { articleAncestors, buildArticlePageTree, type ArticlePageNode } from "./page-hierarchy";
import styles from "./PageHierarchy.module.css";

export function PageTree({
  articles,
  selectedId,
  mode = "read",
}: {
  articles: BrowserArticle[];
  selectedId?: string;
  mode?: "read" | "edit";
}) {
  const roots = useMemo(() => buildArticlePageTree(articles), [articles]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedId) return;
    const ancestors = articleAncestors(articles, selectedId).map((article) => article.id);
    const frame = requestAnimationFrame(() =>
      setCollapsed((previous) => {
        if (!ancestors.some((id) => previous.has(id))) return previous;
        const next = new Set(previous);
        ancestors.forEach((id) => next.delete(id));
        return next;
      })
    );
    return () => cancelAnimationFrame(frame);
  }, [articles, selectedId]);
  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (!roots.length)
    return <p className={styles.empty}>Save an article to start your page tree.</p>;
  return (
    <ul className={styles.tree} aria-label="Saved pages">
      {roots.map((node) => (
        <PageRow
          key={node.article.id}
          node={node}
          selectedId={selectedId}
          mode={mode}
          collapsed={collapsed}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}

function PageRow({
  node,
  selectedId,
  mode,
  collapsed,
  onToggle,
}: {
  node: ArticlePageNode;
  selectedId?: string;
  mode: "read" | "edit";
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const article = node.article;
  const title = articleDisplayTitle(article);
  const open = !collapsed.has(article.id);
  return (
    <li className={styles.item}>
      <div className={styles.row} data-selected={article.id === selectedId || undefined}>
        {node.children.length ? (
          <button
            type="button"
            className={styles.disclosure}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
            aria-expanded={open}
            onClick={() => onToggle(article.id)}
          >
            <ChevronRight className={open ? styles.expanded : undefined} aria-hidden />
          </button>
        ) : (
          <span className={styles.spacer} />
        )}
        <Link
          href={
            mode === "edit" ? browserArticleEditorHref(article.id) : browserArticleHref(article.id)
          }
          className={styles.pageLink}
          aria-current={article.id === selectedId ? "page" : undefined}
          title={title}
        >
          <FileText aria-hidden />
          <span>{title}</span>
        </Link>
      </div>
      {open && node.children.length > 0 && (
        <ul className={styles.branch}>
          {node.children.map((child) => (
            <PageRow
              key={child.article.id}
              node={child}
              selectedId={selectedId}
              mode={mode}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
