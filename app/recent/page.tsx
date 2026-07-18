import { Clock3 } from "lucide-react";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import RecentDocumentsView from "@/components/library/RecentDocumentsView";
import { listAllFiles, type ContentFileNode } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";

export const metadata = {
  title: "Recent",
  description: "Recently updated documents in your Verto library.",
};

export default async function RecentPage() {
  let recent: ContentFileNode[] = [];
  let initialLoadFailed = false;
  try {
    recent = sortRecentDocuments(await listAllFiles());
  } catch {
    initialLoadFailed = true;
  }

  return (
    <ContentPage width="compact">
      <ContentHeader
        icon={<Clock3 />}
        title="Recent"
        description="Recently updated documents from your library."
      />
      <RecentDocumentsView initialRecent={recent} initialLoadFailed={initialLoadFailed} />
    </ContentPage>
  );
}
