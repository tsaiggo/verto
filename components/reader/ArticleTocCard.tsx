import TableOfContents from "@/components/layout/TableOfContents";
import type { TOCItem } from "@/lib/types";

interface ArticleTocCardProps {
  items: TOCItem[];
  title: string;
}

export default function ArticleTocCard({ items, title }: ArticleTocCardProps) {
  if (items.length === 0) return null;

  return (
    <div className="rail-panel toc-panel article-toc-card" data-article-toc>
      <TableOfContents items={items} title={title} />
    </div>
  );
}
