"use client";

import Link from "next/link";
import PageFrame from "@/components/layout/PageFrame";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import styles from "@/components/tags/Tags.module.css";

export interface TagCount {
  name: string;
  count: number;
}

interface TagsViewProps {
  initialTags: TagCount[];
}

export default function TagsView({ initialTags }: TagsViewProps) {
  const runtimeLocal = useRuntimeLocalIndex();

  if (runtimeLocal.status === "loading") {
    return (
      <PageFrame size="standard" className={styles.page}>
        <div className={styles.summary} role="status" aria-live="polite">
          Updating tags…
        </div>
      </PageFrame>
    );
  }

  if (runtimeLocal.status === "error") {
    return (
      <PageFrame size="standard" className={styles.page}>
        <p className={styles.notice} role="alert">
          Local tags could not be loaded. <Link href="/integrations">Manage sources</Link>
        </p>
      </PageFrame>
    );
  }

  const tags = runtimeLocal.status === "ready" ? runtimeLocal.index.tagCounts : initialTags;
  const isRuntime = runtimeLocal.status === "ready";

  return (
    <PageFrame size="standard" className={styles.page}>
      <div className={styles.summary} role="status" aria-live="polite">
        {tags.length} {tags.length === 1 ? "tag" : "tags"}
      </div>
      {tags.length > 0 ? (
        <ul className={styles.list} aria-label="All tags">
          {tags.map((tag) => (
            <li key={tag.name}>
              <Link href={`/library?tag=${encodeURIComponent(tag.name)}`} className={styles.row}>
                <span className={styles.name}>#{tag.name}</span>
                <span className={styles.count}>
                  {tag.count} {tag.count === 1 ? "document" : "documents"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <h2>No tags yet</h2>
          <p>
            {isRuntime
              ? "This local library has no tagged documents."
              : "Add tags to documents in your library to browse them here."}
          </p>
          <Link href="/library" className="v-btn v-btn--sm">
            Browse library
          </Link>
        </div>
      )}
    </PageFrame>
  );
}
