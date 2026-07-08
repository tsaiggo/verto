import Link from "next/link";
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

  return (
    <>
      <PageHeader title="Tags" subtitle="Browse semantic labels." />

      <div className="v-page">
        <div className="v-card tag-card">
          <div className="v-cardhead">
            <span className="v-cardhead-title">All tags</span>
          </div>
          <div className="v-card-divider" />
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
        </div>
      </div>
    </>
  );
}
