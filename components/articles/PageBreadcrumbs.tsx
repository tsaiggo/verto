"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  articleDisplayTitle,
  browserArticleEditorHref,
  browserArticleHref,
  type BrowserArticle,
} from "@/lib/browser-articles";
import { articleAncestors } from "./page-hierarchy";
import styles from "./PageHierarchy.module.css";

export function PageBreadcrumbs({
  articles,
  article,
  mode = "read",
}: {
  articles: BrowserArticle[];
  article: BrowserArticle;
  mode?: "read" | "edit";
}) {
  const ancestors = articleAncestors(articles, article.id);
  return (
    <nav className={styles.breadcrumbs} aria-label="Page hierarchy">
      <Link href="/library?view=notes">Notes</Link>
      {ancestors.map((parent) => (
        <span key={parent.id}>
          <ChevronRight aria-hidden />
          <Link
            href={
              mode === "edit" ? browserArticleEditorHref(parent.id) : browserArticleHref(parent.id)
            }
            title={articleDisplayTitle(parent)}
          >
            {articleDisplayTitle(parent)}
          </Link>
        </span>
      ))}
      <span>
        <ChevronRight aria-hidden />
        <strong aria-current="page" title={articleDisplayTitle(article)}>
          {articleDisplayTitle(article)}
        </strong>
      </span>
    </nav>
  );
}
