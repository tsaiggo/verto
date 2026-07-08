import SearchView from "@/components/search/SearchView";
import { getContentTree, listAllFiles, readFileNodeSource } from "@/lib/content-source";
import {
  buildFileRecords,
  buildFolderRecords,
  summarizeCounts,
  type SearchRecord,
} from "@/lib/search";
import { getSourceInfo } from "@/lib/source-info";

export const metadata = {
  title: "Search",
  description: "Search across your library — pages, headings, code and folders.",
};

/**
 * Build the flat search index from the active content source, then hand it to
 * the interactive client `SearchView`. Verto is statically rendered, so this
 * builds a real index over the connected library rather than issuing a live
 * query — the client filters and ranks it via `searchRecords`.
 */
export default async function SearchPage() {
  const info = getSourceInfo();
  const source = { kind: info.kind, name: info.name };

  const [tree, files] = await Promise.all([getContentTree(), listAllFiles()]);
  const visible = files.filter((file) => !file.hidden && !file.draft);

  const records: SearchRecord[] = [];
  for (const file of visible) {
    let raw = "";
    try {
      raw = await readFileNodeSource(file);
    } catch {
      // A single unreadable file must not sink the whole index — index it by
      // its metadata (title/tags) with an empty body instead.
      raw = "";
    }
    records.push(...buildFileRecords(file, raw, source));
  }
  records.push(...buildFolderRecords(tree, source));

  const counts = summarizeCounts(records);
  const tags = Array.from(new Set(records.flatMap((record) => record.tags ?? []))).sort((a, b) =>
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
