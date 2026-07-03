import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { listAllFiles } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import { SAMPLE_TAGS, type SampleTag } from "@/components/pages/sample";

export const metadata = { title: "Tags" };

export default async function TagsPage() {
  const files = await listAllFiles();

  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.hidden || file.draft || !file.tags) continue;
    for (const tag of file.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const real: SampleTag[] = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const tags = real.length > 0 ? real : SAMPLE_TAGS;
  const max = Math.max(...tags.map((t) => t.count), 1);

  return (
    <>
      <PageHeader
        title="Tags"
        tools={
          <button type="button" className="v-btn v-btn--sm">
            <Plus aria-hidden /> New Tag
          </button>
        }
      />

      <div className="v-page">
        <div className="tag-filters">
          <button type="button" className="v-btn v-btn--sm">
            All tags <ChevronDown aria-hidden />
          </button>
          <span className="tag-sort-label">Sort by</span>
          <button type="button" className="v-btn v-btn--sm">
            Usage <ChevronDown aria-hidden />
          </button>
        </div>

        <div className="tag-grid">
          {tags.map((tag) => {
            const strength = Math.round((tag.count / max) * 100);
            const cls = tag.tint ? ` is-${tag.tint}` : "";
            return (
              <Link
                key={tag.name}
                href={`/read/tags/${encodeURIComponent(tag.name)}`}
                className={`tag-pill${cls}`}
                style={{ ["--strength" as string]: `${strength}%` }}
              >
                <span className="tag-pill-name">#{tag.name}</span>
                <span className="tag-pill-count">{tag.count}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
