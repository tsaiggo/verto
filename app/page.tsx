import { getContentTree, listAllFiles } from "@/lib/content-source";
import { getSourceInfo } from "@/lib/source-info";
import { getConnectionDetails } from "@/lib/connection-info";
import { buildConnectedSources, countConnected } from "@/lib/home";
import ContinueReading from "@/components/home/ContinueReading";
import {
  Aside,
  Masthead,
  RecentlyUpdated,
  SourceStrip,
  SOURCE_BADGE,
} from "@/components/home/HomeSections";
import {
  buildLibraryIndex,
  newestUpdated,
  pickStarters,
  recentlyUpdated,
} from "@/components/home/home-data";

export default async function HomePage() {
  const [files, tree] = await Promise.all([listAllFiles(), getContentTree()]);
  const source = getSourceInfo();
  const connection = getConnectionDetails();
  const sources = buildConnectedSources(connection);
  const connectedCount = countConnected(sources);

  const groups = buildLibraryIndex(tree);
  const lastUpdated = newestUpdated(files);
  const badge = SOURCE_BADGE[source.kind];
  const recent = recentlyUpdated(files, tree, 6);
  const starters = pickStarters(groups, 3);

  return (
    <div className="home-page">
      <div className="home-main">
        <Masthead
          documents={files.length}
          sections={groups.length}
          sourceLabel={badge.label}
          SourceIcon={badge.icon}
          lastUpdated={lastUpdated}
        />

        <ContinueReading hrefs={files.map((file) => file.href)} starters={starters} />

        <RecentlyUpdated docs={recent} />

        <SourceStrip
          sources={sources}
          connectedCount={connectedCount}
          sourceLabel={badge.label}
          SourceIcon={badge.icon}
        />
      </div>

      <Aside connectedCount={connectedCount} groups={groups} totalSections={groups.length} />
    </div>
  );
}
