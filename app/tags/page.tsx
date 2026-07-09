import { listAllFiles } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import { SAMPLE_TAGS, type SampleTag } from "@/components/pages/sample";
import TagsView from "@/components/tags/TagsView";

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
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const tags = real.length > 0 ? real : SAMPLE_TAGS;

  return (
    <>
      <PageHeader title="Tags" subtitle="Browse semantic labels." />
      <TagsView initialTags={tags} />
    </>
  );
}
