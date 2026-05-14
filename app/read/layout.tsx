import { getContentTree } from "@/lib/content-source";
import FileTreeClient from "@/components/reader/FileTreeClient";
import ReadingProgress from "@/components/reader/ReadingProgress";

/**
 * Layout shared by every reader page. Renders the file-tree sidebar (left),
 * a thin reading-progress bar, and gives the main content room on the right.
 */
export default async function ReadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const root = await getContentTree();

  return (
    <div className="docs-layout">
      <FileTreeClient root={root} />
      <ReadingProgress />
      {children}
    </div>
  );
}
