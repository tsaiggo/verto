import { Clock3 } from "lucide-react";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import RecentDocumentsView from "@/components/library/RecentDocumentsView";
import { listAllFiles } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";

export const metadata = {
  title: "Recent",
  description: "Recently updated documents in your Verto library.",
};

export default async function RecentPage() {
  const recent = sortRecentDocuments(await listAllFiles());

  return (
    <ContentPage width="compact">
      <ContentHeader
        icon={<Clock3 />}
        title="Recent"
        description="Recently updated documents from your library."
      />
      <RecentDocumentsView initialRecent={recent} />
    </ContentPage>
  );
}
