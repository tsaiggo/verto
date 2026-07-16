import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContentHeader } from "@/components/layout/ContentPage";
import { ContentEmptyState } from "@/components/ui/content-primitives";
import DocumentList from "@/components/reader/DocumentList";
import type { ContentFileNode } from "@/lib/content-source";

interface DocumentIndexPageProps {
  title: ReactNode;
  files: ContentFileNode[];
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}

/** Shared product-language shell for Reader tag and status result pages. */
export default function DocumentIndexPage({
  title,
  files,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: DocumentIndexPageProps) {
  const count = `${files.length} ${files.length === 1 ? "document" : "documents"}`;

  return (
    <div className="content-wrap reader-index-surface">
      <Link href="/read" className="doc-kicker-link">
        <ArrowLeft aria-hidden />
        All documents
      </Link>
      <ContentHeader title={title} description={count} />
      {files.length > 0 ? (
        <DocumentList files={files} />
      ) : (
        <ContentEmptyState
          compact
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Link href="/library" className="v-btn v-btn--sm">
              Browse library
            </Link>
          }
        />
      )}
    </div>
  );
}
