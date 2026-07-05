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
import {
  SAMPLE_GROUPS,
  SAMPLE_RECENT_DOCS,
  SAMPLE_STARTERS,
  SAMPLE_WEEK_STATS,
} from "@/components/home/home-sample";

export default async function HomePage() {
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
          <ContinueReadingCard
            hrefs={SAMPLE_STARTERS.map((doc) => doc.href)}
            starters={SAMPLE_STARTERS}
          />
          <RecentEditsCard docs={SAMPLE_RECENT_DOCS} />
          <AgentHighlightsCard />
        </div>

        <div className="home-row home-row-activity">
          <KnowledgeActivityCard seed={7} />
          <ThisWeekCard stats={SAMPLE_WEEK_STATS} />
          <InboxTriageCard />
        </div>

        <RecentCollectionsRow groups={SAMPLE_GROUPS} />
      </div>
    </div>
  );
}
