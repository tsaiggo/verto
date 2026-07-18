"use client";

import Link from "next/link";
import { Tag } from "lucide-react";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import { Button } from "@/components/ui/button";
import {
  ContentEmptyState,
  ContentPanel,
  ContentRow,
  ContentSection,
  ContentStatus,
} from "@/components/ui/content-primitives";
import styles from "./TagsView.module.css";

export interface TagCount {
  name: string;
  count: number;
}

interface TagsViewProps {
  initialTags: TagCount[];
  initialLoadFailed?: boolean;
}

export default function TagsView({ initialTags, initialLoadFailed = false }: TagsViewProps) {
  const runtimeLocal = useRuntimeLocalIndex();

  if (runtimeLocal.status === "loading") {
    return (
      <ContentStatus
        status="loading"
        title="Loading local tags"
        description="Tags will appear after Verto finishes reading the selected folder."
      />
    );
  }

  if (runtimeLocal.status === "error") {
    return (
      <ContentStatus
        status="error"
        title="Could not read tags from this library"
        description="Reconnect the folder or choose another source. Static demo tags are not shown while a local source is active."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations">Manage sources</Link>
          </Button>
        }
      />
    );
  }

  if (runtimeLocal.status === "idle" && initialLoadFailed) {
    return (
      <ContentStatus
        status="error"
        title="Could not load tags"
        description="Verto could not read the configured content source. Reconnect it or choose another source, then return here."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations">Manage sources</Link>
          </Button>
        }
      />
    );
  }

  const tags = runtimeLocal.status === "ready" ? runtimeLocal.index.tagCounts : initialTags;

  return (
    <ContentSection
      title="All tags"
      description={`${tags.length} ${tags.length === 1 ? "label" : "labels"} in this library`}
    >
      {tags.length > 0 ? (
        <ContentPanel variant="plain">
          <ul className={styles.grid} aria-label="Tags">
            {tags.map((tag) => (
              <li key={tag.name} className={styles.item}>
                <Link
                  href={`/library?tag=${encodeURIComponent(tag.name)}`}
                  className={styles.link}
                  aria-label={`#${tag.name}, ${tag.count} ${tag.count === 1 ? "document" : "documents"}`}
                >
                  <ContentRow
                    className={styles.row}
                    leading={<Tag aria-hidden />}
                    title={`#${tag.name}`}
                    metadata={
                      <span className={styles.count}>
                        {tag.count} {tag.count === 1 ? "document" : "documents"}
                      </span>
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        </ContentPanel>
      ) : (
        <ContentEmptyState
          compact
          icon={<Tag aria-hidden />}
          title="No tags found"
          description={
            runtimeLocal.status === "ready"
              ? "This local library has no tagged documents yet."
              : "Add tags to document frontmatter and they will appear here."
          }
        />
      )}
    </ContentSection>
  );
}
