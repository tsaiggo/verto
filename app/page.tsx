import HomeDashboard from "@/components/home/HomeDashboard";
import {
  buildLibraryIndex,
  pickStarters,
  recentlyUpdated,
  type HomeWorkspaceData,
} from "@/components/home/home-data";
import { getContentTree, listAllFiles } from "@/lib/content-source";

interface HomePageData {
  workspace: HomeWorkspaceData;
  documentCount: number;
  sectionCount: number;
  sourceError: boolean;
}

async function loadHomePageData(): Promise<HomePageData> {
  // Derive every library-facing surface from the real content source. An empty
  // vault gets an actionable empty state rather than representative documents
  // that could be mistaken for the reader's own work.
  try {
    const [tree, files] = await Promise.all([getContentTree(), listAllFiles()]);

    const groups = buildLibraryIndex(tree);
    const recentDocs = recentlyUpdated(files, tree, 6);
    const starters = pickStarters(groups, 3);
    const visibleFiles = files.filter((file) => !file.hidden);

    // Every readable document's href, so Continue Reading can surface any real
    // reading-history entry (not just the few starter docs).
    const readableHrefs = visibleFiles.filter((file) => !file.draft).map((file) => file.href);

    return {
      workspace: { groups, recentDocs, starters, readableHrefs },
      documentCount: visibleFiles.length,
      sectionCount: groups.length,
      sourceError: false,
    };
  } catch {
    return {
      workspace: { groups: [], recentDocs: [], starters: [], readableHrefs: [] },
      documentCount: 0,
      sectionCount: 0,
      sourceError: true,
    };
  }
}

export default async function HomePage() {
  const data = await loadHomePageData();
  return (
    <div className="home-shell surface-page">
      <HomeDashboard
        staticData={data.workspace}
        bundledDocumentCount={data.documentCount}
        bundledSectionCount={data.sectionCount}
        staticSourceError={data.sourceError}
      />
    </div>
  );
}
