import { listAllFiles } from "@/lib/content-source";
import { Tag } from "lucide-react";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
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
    <ContentPage width="standard">
      <ContentHeader icon={<Tag />} title="Tags" description="Browse semantic labels." />
      <TagsView initialTags={tags} />
    </ContentPage>
  );
}
