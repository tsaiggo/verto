import { getContentTree, listAllFiles } from "@/lib/content-source";
import { getSourceInfo } from "@/lib/source-info";
import { getConnectionDetails } from "@/lib/connection-info";
import { buildConnectedSources, countConnected } from "@/lib/home";
import ContinueReading from "@/components/home/ContinueReading";
import {
  Aside,
  HowItWorks,
  LibraryIndex,
  Masthead,
  SourcePanel,
  SOURCE_BADGE,
  buildLibraryIndex,
  newestUpdated,
} from "@/components/home/HomeSections";

export default async function HomePage() {
  const [files, tree] = await Promise.all([listAllFiles(), getContentTree()]);
  const source = getSourceInfo();
  const connection = getConnectionDetails();
  const sources = buildConnectedSources(connection);
  const connectedCount = countConnected(sources);

  const groups = buildLibraryIndex(tree);
  const lastUpdated = newestUpdated(files);
  const badge = SOURCE_BADGE[source.kind];

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

        <LibraryIndex groups={groups} total={files.length} />

        <ContinueReading hrefs={files.map((file) => file.href)} />

        <SourcePanel
          sources={sources}
          connectedCount={connectedCount}
          sourceLabel={badge.label}
          SourceIcon={badge.icon}
        />

        <HowItWorks />
      </div>

      <Aside connectedCount={connectedCount} />
    </div>
  );
}
