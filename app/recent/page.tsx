import PageHeader from "@/components/layout/PageHeader";
import RecentDocumentsView from "@/components/reader/RecentDocumentsView";
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
        <RecentDocumentsView initialRecent={recent} />
      </div>
    </>
  );
}
