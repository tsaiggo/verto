import TableOfContents from "@/components/layout/TableOfContents";
import type { TOCItem } from "@/lib/types";

interface ArticleTocCardProps {
  items: TOCItem[];
  title: string;
}

export default function ArticleTocCard({ items, title }: ArticleTocCardProps) {
  if (items.length === 0) return null;

  return (
    <div className="rail-panel toc-panel article-toc-card" data-article-toc data-reader-tools>
      <div className="reader-context-toc" data-reader-toc-surface>
        <TableOfContents items={items} title={title} />
        <div className="article-toc-companion-slot" data-reading-companion-launcher-host />
      </div>
      <div className="article-toc-companion-host" data-reading-companion-panel-host />
    </div>
  );
}
