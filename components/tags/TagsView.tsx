"use client";

import Link from "next/link";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import type { SampleTag } from "@/components/pages/sample";

interface TagsViewProps {
  initialTags: SampleTag[];
}

export default function TagsView({ initialTags }: TagsViewProps) {
  const runtimeLocal = useRuntimeLocalIndex();
  const tags = runtimeLocal.status === "ready" ? runtimeLocal.index.tagCounts : initialTags;
  const isRuntime = runtimeLocal.status === "ready";

  return (
    <div className="v-page">
      <div className="v-card tag-card">
        <div className="v-cardhead">
          <span className="v-cardhead-title">All tags</span>
        </div>
        <div className="v-card-divider" />
        {tags.length > 0 ? (
          <div className="tag-grid">
            {tags.map((tag) => (
              <Link
                key={tag.name}
                href={`/read/tags/${encodeURIComponent(tag.name)}`}
                className="tag-pill"
              >
                <span className="tag-pill-name">#{tag.name}</span>
                <span className="tag-pill-count">{tag.count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="lib-empty">
            <p>{isRuntime ? "No tags found in this local folder." : "No tags found."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
