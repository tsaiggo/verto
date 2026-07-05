import { Clock3 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import DocumentList from "@/components/reader/DocumentList";
import { listAllFiles } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";

export const metadata = {
  title: "Recent",
  description: "Recently updated documents in your Verto library.",
};

export default async function RecentPage() {
  const recent = sortRecentDocuments(await listAllFiles());

  return (
    <>
      <PageHeader title="Recent" subtitle="Recently updated documents from your library." />
      <div className="v-page v-page--narrow">
        {recent.length > 0 ? (
          <DocumentList files={recent} />
        ) : (
          <div className="v-empty">
            <span className="v-empty-icon" aria-hidden>
              <Clock3 />
            </span>
            <strong className="v-empty-title">No recent documents yet</strong>
            <p className="v-empty-text">
              Open or update documents in your library and they will appear here for quick access.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
