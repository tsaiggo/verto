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
import {
  SAMPLE_CONTINUE_PROGRESS,
  SAMPLE_GROUPS,
  SAMPLE_RECENT_DOCS,
  SAMPLE_STARTERS,
  SAMPLE_WEEK_STATS,
} from "@/components/home/home-sample";

export default async function HomePage() {
  const [files, tree] = await Promise.all([listAllFiles(), getContentTree()]);

  const hasContent = files.length > 0;
  const realGroups = buildLibraryIndex(tree);

  const groups = hasContent && realGroups.length > 0 ? realGroups : SAMPLE_GROUPS;
  const recent = hasContent ? recentlyUpdated(files, tree, 6) : SAMPLE_RECENT_DOCS;
  const starters = hasContent ? pickStarters(realGroups, 3) : SAMPLE_STARTERS;
  const updatedThisWeek = countUpdatedThisWeek(files);

  const stats = hasContent
    ? {
        notesCreated: updatedThisWeek,
        notesEdited: Math.max(1, Math.round(updatedThisWeek * 0.6)),
        collectionsUpdated: realGroups.length,
        bookmarksAdded: Math.max(0, Math.min(files.length, 7)),
        graphConnections: Math.max(0, Math.round(realGroups.length * 1.5)),
      }
    : SAMPLE_WEEK_STATS;

  return (
    <>
      <PageHeader left={<HomeGreeting />} />

      <div className="v-page home-grid">
        <div className="home-row home-row-3">
          <ContinueReadingCard
            hrefs={files.map((f) => f.href)}
            starters={starters}
            sampleProgress={hasContent ? undefined : SAMPLE_CONTINUE_PROGRESS}
          />
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
