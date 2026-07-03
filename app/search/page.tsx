import type { Metadata } from "next";
import {
  listAllFiles,
  getContentTree,
  readFileNodeSource,
  type ContentFileNode,
} from "@/lib/content-source";
import { listAllHelpFiles, getHelpContentTree, readHelpFileNodeSource } from "@/lib/help-source";
import { getSourceInfo, type SourceKind } from "@/lib/source-info";
import {
  buildFileRecords,
  buildFolderRecords,
  summarizeCounts,
  type SearchRecord,
} from "@/lib/search";
import SearchView from "@/components/search/SearchView";
import { SAMPLE_DOCS } from "@/components/pages/sample";

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
    case "local":
    default:
      return "Local";
  }
}

function sampleSearchRecords(source: {
  kind: SearchRecord["sourceKind"];
  name: string;
}): SearchRecord[] {
  const now = Date.now();
  const offsets = [10 * 60_000, 3 * 60 * 60_000, 3 * 24 * 60 * 60_000, 30 * 24 * 60 * 60_000];
  const rows = [
    {
      title: "Agent-native Workflows: Building the Future of Knowledge Work",
      file: "agent-native-workflows.mdx",
      snippet:
        "Agent-native workflows combine LLMs, tools, and your knowledge base to assemble complete tasks.",
      tags: ["agent", "workflows", "principles"],
    },
    {
      title: "Designing AI Products",
      file: "designing-ai-products.md",
      snippet:
        "Design with agent-native workflow principles for systems, UI, trust, and oversight.",
      tags: ["ai", "design", "principles"],
    },
    {
      title: "Verto Architecture Overview",
      file: "verto-architecture-overview.md",
      snippet:
        "How Verto routes agent-native workflow context through sources, search, and citations.",
      tags: ["engineering", "architecture", "agent"],
    },
    {
      title: "Prompt Patterns for Knowledge Work",
      file: "prompt-patterns-for-knowledge-work.md",
      snippet: "Reusable patterns for agent-native workflow prompts, grounding, and review loops.",
      tags: ["prompts", "templates", "agent"],
    },
    {
      title: "Knowledge Graphs in Practice",
      file: "knowledge-graphs-in-practice.md",
      snippet: "Graph techniques for connecting agent-native workflow context across documents.",
      tags: ["graph", "research", "workflows"],
    },
  ];

  return rows.map((row, index) => ({
    id: `sample:page:${row.file}`,
    kind: "page",
    title: row.title,
    snippet: row.snippet,
    href: SAMPLE_DOCS[index]?.href ?? "/read",
    path: `docs / ${row.file}`,
    tags: row.tags,
    updated: now - offsets[Math.min(index, offsets.length - 1)],
    sourceKind: source.kind,
    sourceName: source.name,
  }));
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

  const realRecords: SearchRecord[] = [
    ...libraryRecords,
    ...helpRecords,
    ...buildFolderRecords(root, source),
    ...buildFolderRecords(helpRoot, helpSource),
  ];
  const records = files.length > 0 ? realRecords : sampleSearchRecords(source);

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
      initialQuery={files.length > 0 ? undefined : "agent-native workflow"}
    />
  );
}
