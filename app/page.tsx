import HomeDashboard from "@/components/home/HomeDashboard";
import { buildLibraryIndex, pickStarters, recentlyUpdated } from "@/components/home/home-data";
import { getContentTree, listAllFiles } from "@/lib/content-source";
import { getSourceInfo } from "@/lib/source-info";

export default async function HomePage() {
  // Derive every library-facing surface from the real content source. An empty
  // vault gets an actionable empty state rather than representative documents
  // that could be mistaken for the reader's own work.
  const [tree, files] = await Promise.all([getContentTree(), listAllFiles()]);

  const groups = buildLibraryIndex(tree);
  const recentDocs = recentlyUpdated(files, tree, 6);
  const starters = pickStarters(groups, 3);
  const visibleFiles = files.filter((file) => !file.hidden);

  // Every readable document's href, so Continue Reading can surface any real
  // reading-history entry (not just the few starter docs).
  const readableHrefs = visibleFiles.filter((file) => !file.draft).map((file) => file.href);

  return (
    <div className="home-shell surface-page">
      <HomeDashboard
        staticData={{ groups, recentDocs, starters, readableHrefs }}
        sourceLabel={getSourceInfo().label}
      />
    </div>
  );
}
