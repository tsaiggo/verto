import type { Metadata } from "next";
import {
  listAllFiles,
  getContentTree,
  readFileNodeSource,
} from "@/lib/content-source";
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
  description:
    "Search across your connected sources. Preview instantly from the source.",
};

/** Short badge label per source kind, matching the design's result badges. */
function badgeName(kind: SourceKind): string {
  switch (kind) {
    case "github":
      return "GitHub";
    case "onedrive":
      return "OneDrive";
    case "docs":
      return "Docs";
    case "local":
    default:
      return "Local";
  }
}

/**
 * Server entry for the "Search & Library" page. Builds the full search index
 * from the active content source at build time (Verto is statically
 * rendered) and hands the flat record list to the client view.
 */
export default async function SearchPage() {
  const [files, root] = await Promise.all([listAllFiles(), getContentTree()]);
  const info = getSourceInfo();
  const source = { kind: info.kind, name: badgeName(info.kind) };

  const fileRecords = await Promise.all(
    files.map(async (node) => {
      try {
        const raw = await readFileNodeSource(node);
        return buildFileRecords(node, raw, source);
      } catch {
        // A single unreadable file shouldn't break the whole index.
        return buildFileRecords(node, "", source);
      }
    }),
  );

  const records: SearchRecord[] = [
    ...fileRecords.flat(),
    ...buildFolderRecords(root, source),
  ];

  const counts = summarizeCounts(records);

  // Distinct tag list for the Tags filter, sorted alphabetically.
  const tags = Array.from(new Set(records.flatMap((r) => r.tags ?? []))).sort(
    (a, b) => a.localeCompare(b),
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
