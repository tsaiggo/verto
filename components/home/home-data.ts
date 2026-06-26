import type {
  ContentDirNode,
  ContentFileNode,
  ContentNode,
} from "@/lib/content-source";

const MAX_ITEMS_PER_GROUP = 8;

export interface LibraryGroup {
  title: string;
  href: string;
  total: number;
  items: ContentFileNode[];
}

export interface RecentDoc {
  href: string;
  title: string;
  description?: string;
  section: string;
  iso: string | null;
  relative: string;
}

export interface StarterDoc {
  href: string;
  title: string;
  section: string;
}

function collectFiles(node: ContentNode): ContentFileNode[] {
  if (node.type === "file") {
    return node.hidden || node.draft ? [] : [node];
  }
  return node.children.flatMap(collectFiles);
}

export function buildLibraryIndex(tree: ContentDirNode): LibraryGroup[] {
  const groups: LibraryGroup[] = [];
  const loose: ContentFileNode[] = [];

  for (const child of tree.children) {
    if (child.hidden) continue;
    if (child.type === "file") {
      if (!child.draft) loose.push(child);
      continue;
    }
    const files = collectFiles(child);
    if (files.length === 0) continue;
    groups.push({
      title: child.title,
      href: child.href,
      total: files.length,
      items: files.slice(0, MAX_ITEMS_PER_GROUP),
    });
  }

  if (loose.length > 0) {
    groups.unshift({
      title: "Overview",
      href: "/read",
      total: loose.length,
      items: loose.slice(0, MAX_ITEMS_PER_GROUP),
    });
  }

  return groups;
}

function fileIso(file: ContentFileNode): string | null {
  const raw =
    file.updated ??
    file.date ??
    (file.mtime > 0 ? new Date(file.mtime).toISOString() : null);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function relativeDay(iso: string | null): string {
  if (!iso) return "";
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  const diff = Date.now() - timestamp;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  const days = Math.floor(diff / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function newestUpdated(files: ContentFileNode[]): string {
  const newest = [...files].sort((a, b) => b.mtime - a.mtime)[0];
  if (!newest) return "Not yet";
  const iso = fileIso(newest);
  if (!iso) return "Not yet";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function topSectionMap(tree: ContentDirNode): Map<string, string> {
  const map = new Map<string, string>();
  for (const child of tree.children) {
    if (child.hidden || child.type !== "dir") continue;
    const key = child.slug[0];
    if (key) map.set(key, child.title);
  }
  return map;
}

export function recentlyUpdated(
  files: ContentFileNode[],
  tree: ContentDirNode,
  limit = 6,
): RecentDoc[] {
  const sections = topSectionMap(tree);
  return files
    .filter((file) => !file.hidden && !file.draft)
    .map((file) => ({ file, iso: fileIso(file) }))
    .sort((a, b) => {
      const ta = a.iso ? Date.parse(a.iso) : 0;
      const tb = b.iso ? Date.parse(b.iso) : 0;
      return tb - ta;
    })
    .slice(0, limit)
    .map(({ file, iso }) => ({
      href: file.href,
      title: file.title,
      description: file.description,
      section:
        file.slug.length > 1 ? (sections.get(file.slug[0]) ?? file.slug[0]) : "Overview",
      iso,
      relative: relativeDay(iso),
    }));
}

export function pickStarters(groups: LibraryGroup[], count = 3): StarterDoc[] {
  const starters: StarterDoc[] = [];
  for (const group of groups) {
    const first = group.items[0];
    if (first) starters.push({ href: first.href, title: first.title, section: group.title });
    if (starters.length >= count) break;
  }
  return starters;
}
