import matter from "gray-matter";
import { listAllFiles, readFileNodeSource } from "@/lib/content-source";

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly tags: string[];
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly kind: "tag" | "link";
}

export interface GraphData {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
}

type DocRecord = {
  readonly node: GraphNode;
  readonly raw: string;
};

const JSX_READ_HREF = /href=["'](\/read\/[^"'#?\s)]+)["']/g;
const MARKDOWN_READ_LINK = /\[[^\]]+\]\((\/read\/[^\s)#?]+)(?:#[^\s)]*)?\)/g;

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function tagsFromRaw(raw: string, fallback: readonly string[] = []): string[] {
  const parsed = matter(raw).data;
  const rawTags = Array.isArray(parsed.tags) ? parsed.tags : fallback;
  return Array.from(
    new Set(rawTags.filter((tag): tag is string => typeof tag === "string").map(normalizeTag))
  ).filter(Boolean);
}

function edgeKey(edge: GraphEdge): string {
  return `${edge.kind}:${edge.source}->${edge.target}`;
}

function addEdge(edges: Map<string, GraphEdge>, edge: GraphEdge): void {
  if (edge.source === edge.target) return;
  edges.set(edgeKey(edge), edge);
}

function readLinks(raw: string): string[] {
  const links = new Set<string>();
  for (const match of raw.matchAll(JSX_READ_HREF)) {
    const href = match[1];
    if (href) links.add(href);
  }
  for (const match of raw.matchAll(MARKDOWN_READ_LINK)) {
    const href = match[1];
    if (href) links.add(href);
  }
  return [...links];
}

function addTagEdges(records: readonly DocRecord[], edges: Map<string, GraphEdge>): void {
  for (let left = 0; left < records.length; left += 1) {
    const leftRecord = records[left];
    if (!leftRecord) continue;
    const leftTags = new Set(leftRecord.node.tags);
    for (let right = left + 1; right < records.length; right += 1) {
      const rightRecord = records[right];
      if (!rightRecord) continue;
      if (!rightRecord.node.tags.some((tag) => leftTags.has(tag))) continue;
      addEdge(edges, {
        source: leftRecord.node.id,
        target: rightRecord.node.id,
        kind: "tag",
      });
    }
  }
}

function addLinkEdges(records: readonly DocRecord[], edges: Map<string, GraphEdge>): void {
  const ids = new Set(records.map((record) => record.node.id));
  for (const record of records) {
    for (const href of readLinks(record.raw)) {
      if (!ids.has(href)) continue;
      addEdge(edges, { source: record.node.id, target: href, kind: "link" });
    }
  }
}

export async function buildGraph(): Promise<GraphData> {
  const files = (await listAllFiles()).filter((file) => !file.hidden && !file.draft);
  const records = await Promise.all(
    files.map(async (file): Promise<DocRecord> => {
      const raw = await readFileNodeSource(file);
      const tags = tagsFromRaw(raw, file.tags ?? []);
      return {
        raw,
        node: {
          id: file.href,
          label: file.title || file.slug.join("/"),
          href: file.href,
          tags,
        },
      };
    })
  );

  const edges = new Map<string, GraphEdge>();
  addTagEdges(records, edges);
  addLinkEdges(records, edges);

  return { nodes: records.map((record) => record.node), edges: [...edges.values()] };
}
