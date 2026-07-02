import { getContentTree, listAllFiles } from "@/lib/content-source";
import { getSourceInfo } from "@/lib/source-info";
import { getConnectionDetails } from "@/lib/connection-info";
import { buildConnectedSources } from "@/lib/home";
import ContinueReading from "@/components/home/ContinueReading";
import {
  BrowseSections,
  Masthead,
  RecentlyUpdated,
  SourceStrip,
  SOURCE_BADGE,
} from "@/components/home/HomeSections";
import {
  buildLibraryIndex,
  countUpdatedThisWeek,
  pickStarters,
  recentlyUpdated,
} from "@/components/home/home-data";

export default async function HomePage() {
  const [files, tree] = await Promise.all([listAllFiles(), getContentTree()]);
  const source = getSourceInfo();
  const connection = getConnectionDetails();
  const sources = buildConnectedSources(connection);

  const groups = buildLibraryIndex(tree);
  const badge = SOURCE_BADGE[source.kind];
  const recent = recentlyUpdated(files, tree, 6);
  const starters = pickStarters(groups, 3);
  const updatedThisWeek = countUpdatedThisWeek(files);

  return (
    <div className="home-page">
      <Masthead
        documents={files.length}
        sections={groups.length}
        updatedThisWeek={updatedThisWeek}
      />

      <ContinueReading hrefs={files.map((file) => file.href)} starters={starters} />

      <RecentlyUpdated docs={recent} />

      <BrowseSections groups={groups} />

      <SourceStrip sources={sources} sourceLabel={badge.label} SourceIcon={badge.icon} />
    </div>
  );
}
