import { listAllFiles } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import TagsView, { type TagCount } from "@/components/tags/TagsView";

export const metadata = { title: "Tags" };

export default async function TagsPage() {
  const files = await listAllFiles();

  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.hidden || file.draft || !file.tags) continue;
    for (const tag of file.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const tags: TagCount[] = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Tags" subtitle="Browse semantic labels." />
      <TagsView initialTags={tags} />
    </>
  );
}
