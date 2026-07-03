import { getContentTree, listAllFiles } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import HomeGreeting from "@/components/home/HomeGreeting";
import ContinueReadingCard from "@/components/home/ContinueReadingCard";
import {
  AgentHighlightsCard,
  InboxTriageCard,
  KnowledgeActivityCard,
  RecentCollectionsRow,
  RecentEditsCard,
  ThisWeekCard,
} from "@/components/home/HomeCards";
import {
  buildLibraryIndex,
  countUpdatedThisWeek,
  pickStarters,
  recentlyUpdated,
} from "@/components/home/home-data";

export default async function HomePage() {
  const [files, tree] = await Promise.all([listAllFiles(), getContentTree()]);

  const groups = buildLibraryIndex(tree);
  const recent = recentlyUpdated(files, tree, 6);
  const starters = pickStarters(groups, 3);
  const updatedThisWeek = countUpdatedThisWeek(files);

  const stats = {
    notesCreated: updatedThisWeek,
    notesEdited: Math.max(1, Math.round(updatedThisWeek * 0.6)),
    collectionsUpdated: groups.length,
    bookmarksAdded: Math.max(0, Math.min(files.length, 7)),
    graphConnections: Math.max(0, Math.round(groups.length * 1.5)),
  };

  return (
    <>
      <PageHeader left={<HomeGreeting />} />

      <div className="v-page home-grid">
        <div className="home-row home-row-3">
          <ContinueReadingCard hrefs={files.map((f) => f.href)} starters={starters} />
          <RecentEditsCard docs={recent} />
          <AgentHighlightsCard docs={recent} />
        </div>

        <div className="home-row home-row-activity">
          <KnowledgeActivityCard seed={files.length + 3} />
          <ThisWeekCard stats={stats} />
          <InboxTriageCard count={6} />
        </div>

        <RecentCollectionsRow groups={groups} />
      </div>
    </>
  );
}
