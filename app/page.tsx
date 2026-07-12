import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import HomeGreeting from "@/components/home/HomeGreeting";
import ContinueReadingCard from "@/components/home/ContinueReadingCard";
import {
  AgentHighlightsCard,
  InboxTriageCard,
  RecentCollectionsRow,
  RecentEditsCard,
} from "@/components/home/HomeCards";
import { buildLibraryIndex, pickStarters, recentlyUpdated } from "@/components/home/home-data";
import { getContentTree, listAllFiles } from "@/lib/content-source";

export default async function HomePage() {
  // Derive every library-facing surface from the real content source. An empty
  // vault gets an actionable empty state rather than representative documents
  // that could be mistaken for the reader's own work.
  const [tree, files] = await Promise.all([getContentTree(), listAllFiles()]);

  const groups = buildLibraryIndex(tree);
  const recentDocs = recentlyUpdated(files, tree, 6);
  const starters = pickStarters(groups, 3);

  // Every readable document's href, so Continue Reading can surface any real
  // reading-history entry (not just the few starter docs).
  const readableHrefs = files.filter((f) => !f.hidden && !f.draft).map((f) => f.href);

  return (
    <div className="home-shell">
      <PageHeader
        left={<HomeGreeting />}
        tools={
          <div className="home-header-tools">
            <Link href="/editor" className="v-btn v-btn--primary v-btn--sm">
              <Plus aria-hidden /> New
            </Link>
            <Link href="/agent" className="v-btn v-btn--sm">
              <Sparkles aria-hidden /> Ask Agent
            </Link>
          </div>
        }
      />

      <div className="v-page home-grid home-page">
        <div className="home-row home-row-3">
          <ContinueReadingCard hrefs={readableHrefs} starters={starters} />
          <RecentEditsCard docs={recentDocs} />
          <AgentHighlightsCard />
        </div>

        <div className="home-row home-row-inbox">
          <InboxTriageCard />
        </div>

        <RecentCollectionsRow groups={groups} />
      </div>
    </div>
  );
}
