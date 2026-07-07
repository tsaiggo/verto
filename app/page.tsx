import { MoreHorizontal, Plus, Sparkles } from "lucide-react";
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
import { buildLibraryIndex, pickStarters, recentlyUpdated } from "@/components/home/home-data";
import { getContentTree, listAllFiles } from "@/lib/content-source";
import {
  SAMPLE_GROUPS,
  SAMPLE_RECENT_DOCS,
  SAMPLE_STARTERS,
  SAMPLE_WEEK_STATS,
} from "@/components/home/home-sample";

export default async function HomePage() {
  // Derive the dashboard from the real content source; fall back to the sample
  // set per-section when an empty vault yields nothing, so the layout still
  // matches the design instead of collapsing into empty states.
  const [tree, files] = await Promise.all([getContentTree(), listAllFiles()]);

  const realGroups = buildLibraryIndex(tree);
  const groups = realGroups.length > 0 ? realGroups : SAMPLE_GROUPS;

  const realRecent = recentlyUpdated(files, tree, 6);
  const recentDocs = realRecent.length > 0 ? realRecent : SAMPLE_RECENT_DOCS;

  const realStarters = pickStarters(realGroups, 3);
  const starters = realStarters.length > 0 ? realStarters : SAMPLE_STARTERS;

  // Every readable document's href, so Continue Reading can surface any real
  // reading-history entry (not just the few starter docs).
  const readableHrefs = files.filter((f) => !f.hidden && !f.draft).map((f) => f.href);

  return (
    <div className="home-shell">
      <PageHeader
        left={<HomeGreeting sampleName="Alex" />}
        tools={
          <div className="home-header-tools">
            <button type="button" className="v-btn v-btn--primary v-btn--sm">
              <Plus aria-hidden /> New
            </button>
            <button type="button" className="v-btn v-btn--sm">
              <Sparkles aria-hidden /> Ask Agent
            </button>
            <button type="button" className="pgh-iconbtn" aria-label="More home actions">
              <MoreHorizontal className="pgh-iconbtn-icon" aria-hidden />
            </button>
          </div>
        }
      />

      <div className="v-page home-grid home-page">
        <div className="home-row home-row-3">
          <ContinueReadingCard hrefs={readableHrefs} starters={starters} />
          <RecentEditsCard docs={recentDocs} />
          <AgentHighlightsCard />
        </div>

        <div className="home-row home-row-activity">
          <KnowledgeActivityCard seed={7} />
          <ThisWeekCard stats={SAMPLE_WEEK_STATS} />
          <InboxTriageCard />
        </div>

        <RecentCollectionsRow groups={groups} />
      </div>
    </div>
  );
}
