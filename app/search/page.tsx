import type { Metadata } from "next";
import {
  listAllFiles,
  getContentTree,
  readFileNodeSource,
  type ContentFileNode,
} from "@/lib/content-source";
import {
  listAllHelpFiles,
  getHelpContentTree,
  readHelpFileNodeSource,
} from "@/lib/help-source";
import { getSourceInfo, type SourceKind } from "@/lib/source-info";
import {
  buildFileRecords,
  buildFolderRecords,
  summarizeCounts,
  type SearchRecord,
} from "@/lib/search";
import SearchView from "@/components/search/SearchView";

export const metadata: Metadata = {
  title: "Search & Library",
  description: "Search across your connected sources. Preview instantly from the source.",
};

/** Short badge label per source kind, matching the design's result badges. */
function badgeName(kind: SourceKind): string {
  switch (kind) {
    case "github":
      return "GitHub";
    case "onedrive":
      return "OneDrive";
    case "docs":
      return "Showcase";
    case "local":
    default:
      return "Local";
  }
}

/** Compile page/heading/code records for one source's files, tolerating
 *  individual read failures so a single bad file can't break the index. */
async function indexFiles(
  files: ContentFileNode[],
  read: (node: ContentFileNode) => Promise<string>,
  source: { kind: SearchRecord["sourceKind"]; name: string }
): Promise<SearchRecord[]> {
  const grouped = await Promise.all(
    files.map(async (node) => {
      try {
        return buildFileRecords(node, await read(node), source);
      } catch {
        return buildFileRecords(node, "", source);
      }
    })
  );
  return grouped.flat();
}

/**
 * Server entry for the "Search & Library" page. Builds the full search index
 * at build time (Verto is statically rendered): the user's active content
 * source plus the always-bundled Help docs, each carrying its own source
 * badge. Hands the flat record list to the client view.
 */
export default async function SearchPage() {
  const [files, root, helpFiles, helpRoot] = await Promise.all([
    listAllFiles(),
    getContentTree(),
    listAllHelpFiles(),
    getHelpContentTree(),
  ]);

  const info = getSourceInfo();
  const source = { kind: info.kind, name: badgeName(info.kind) };
  const helpSource = { kind: "help" as const, name: "Help" };

  const [libraryRecords, helpRecords] = await Promise.all([
    indexFiles(files, readFileNodeSource, source),
    indexFiles(helpFiles, readHelpFileNodeSource, helpSource),
  ]);

  const records: SearchRecord[] = [
    ...libraryRecords,
    ...helpRecords,
    ...buildFolderRecords(root, source),
    ...buildFolderRecords(helpRoot, helpSource),
  ];

  const counts = summarizeCounts(records);

  // Distinct tag list for the Tags filter, sorted alphabetically.
  const tags = Array.from(new Set(records.flatMap((r) => r.tags ?? []))).sort((a, b) =>
    a.localeCompare(b)
  );

  return (
    <SearchView
      records={records}
      counts={counts}
      tags={tags}
      sourceKind={info.kind}
      sourceName={info.name}
      sourceLabel={info.label}
    />
  );
}
