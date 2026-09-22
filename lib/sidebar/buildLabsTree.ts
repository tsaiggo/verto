import type { ContentDirNode, ContentNode } from "@/lib/content-source/types";

/**
 * Sidebar view model derived from a ContentNode tree.
 *
 * The tree is already sorted + overridden by `lib/content-source/tree.ts`
 * (`getContentTree`). This adapter only:
 *  - prunes hidden nodes,
 *  - re-applies `order → dir-first → date desc → title` to stay deterministic,
 *  - flattens top-level dirs into groups (root files → "Workspace").
 *
 * No I/O, no mock seeding. Empty input → empty output (honest empty state).
 */

export interface LabsSidebarItem {
  slug: string[];
  href: string;
  title: string;
  order?: number;
  hidden?: boolean;
  description?: string;
  tags?: string[];
  date?: string;
  draft?: boolean;
  children?: LabsSidebarItem[];
}

export interface LabsSidebarGroup {
  id: string;
  label: string;
  href: string;
  items: LabsSidebarItem[];
  order?: number;
  hidden?: boolean;
}

export type LabsSidebarTree = LabsSidebarGroup[];

// ---------------------------------------------------------------------------
// Expand / collapse helper types (state only, no UI)
// ---------------------------------------------------------------------------

export type LabsSidebarExpandState = Set<string>;

export function createExpandState(initiallyExpanded: string[] = []): LabsSidebarExpandState {
  return new Set(initiallyExpanded);
}

export function isExpanded(state: LabsSidebarExpandState, id: string): boolean {
  return state.has(id);
}

export function toggleExpanded(state: LabsSidebarExpandState, id: string): LabsSidebarExpandState {
  const next = new Set(state);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// ---------------------------------------------------------------------------
// Facets derived from the view model (no fake activity)
// ---------------------------------------------------------------------------

export interface LabsTagFacet {
  tag: string;
  count: number;
}

export interface LabsSourceFacet {
  id: string;
  label: string;
  href: string;
  count: number;
}

export function collectTagFacets(tree: LabsSidebarTree): LabsTagFacet[] {
  const counts = new Map<string, number>();
  for (const item of flattenToList(tree)) {
    for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function countFiles(items: LabsSidebarItem[]): number {
  let c = 0;
  const stack = [...items];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.children && cur.children.length > 0) stack.push(...cur.children);
    else c += 1;
  }
  return c;
}

export function collectSourceFacets(tree: LabsSidebarTree): LabsSourceFacet[] {
  return tree.map((g) => ({
    id: g.id,
    label: g.label,
    href: g.href,
    count: countFiles(g.items),
  }));
}

// ---------------------------------------------------------------------------
// Sort — mirrors `lib/content-source/tree.ts#compareNodes`
// ---------------------------------------------------------------------------

function compareLabsItems(a: LabsSidebarItem, b: LabsSidebarItem): number {
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  const aIsDir = (a.children?.length ?? 0) > 0 || isDirLike(a);
  const bIsDir = (b.children?.length ?? 0) > 0 || isDirLike(b);
  if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
  const ad = a.date ? Date.parse(a.date) : NaN;
  const bd = b.date ? Date.parse(b.date) : NaN;
  if (!Number.isNaN(ad) && !Number.isNaN(bd) && ad !== bd) return bd - ad;
  return a.title.localeCompare(b.title);
}

function isDirLike(_item: LabsSidebarItem): boolean {
  // Heuristic: items that originated from a dir have children (even if empty after prune)
  // After mapping, only dir-origin items have `children` defined (array). File items have undefined.
  return _item.children !== undefined;
}

function compareNodes(a: ContentNode, b: ContentNode): number {
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
  if (a.type === "file" && b.type === "file") {
    const ad = a.date ? Date.parse(a.date) : NaN;
    const bd = b.date ? Date.parse(b.date) : NaN;
    if (!Number.isNaN(ad) && !Number.isNaN(bd) && ad !== bd) return bd - ad;
  }
  return a.title.localeCompare(b.title);
}

// ---------------------------------------------------------------------------
// Mapping ContentNode → LabsSidebarItem
// ---------------------------------------------------------------------------

function toLabsItem(node: ContentNode): LabsSidebarItem | null {
  if (node.hidden) return null;
  if (node.type === "file") {
    return {
      slug: node.slug,
      href: node.href,
      title: node.title,
      order: node.order,
      hidden: node.hidden,
      description: node.description,
      tags: node.tags,
      date: node.date,
      draft: node.draft,
    };
  }
  // dir
  const children = node.children
    .filter((c) => !c.hidden)
    .sort(compareNodes)
    .map(toLabsItem)
    .filter((x): x is LabsSidebarItem => x !== null);

  // If dir has no visible children and no index file, it would have been pruned upstream;
  // but keep an empty dir as leaf for completeness (caller may filter it).
  const item: LabsSidebarItem = {
    slug: node.slug,
    href: node.href,
    title: node.title,
    order: node.order,
    hidden: node.hidden,
    children,
  };
  // Carry index meta if present (not rendered as separate item; dir already represents it)
  return item;
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Map a fully-resolved `ContentDirNode` (from `getContentTree()`) to the
 * sidebar view model.
 *
 * - Top-level dirs become groups.
 * - Files directly under root become the "Workspace" group (id: "workspace").
 * - Hidden nodes are pruned (subtree removed).
 * - Items inside each group are already sorted.
 * - Empty root → [] (honest empty state).
 */
export function buildLabsTree(root: ContentDirNode): LabsSidebarTree {
  if (!root || root.type !== "dir") return [];
  if (root.hidden) return [];

  const groups: LabsSidebarGroup[] = [];
  const looseFiles: LabsSidebarItem[] = [];

  // Root children already sorted by tree.ts, but re-sort after pruning for safety
  const visibleChildren = root.children.filter((c) => !c.hidden).sort(compareNodes);

  for (const child of visibleChildren) {
    if (child.type === "file") {
      const item = toLabsItem(child);
      if (item) looseFiles.push(item);
      continue;
    }
    // child is dir → group
    if (child.hidden) continue;
    const mapped = toLabsItem(child);
    if (!mapped) continue;
    // A dir with no visible descendants and no index is effectively empty — skip
    if ((mapped.children?.length ?? 0) === 0) {
      // Keep if it has an index? toLabsItem would have produced children=[] but
      // dir itself is still a navigable page. Check original node's index?
      // For now, skip empty container dirs to keep sidebar honest.
      continue;
    }
    // Sort group's direct children with labs comparator (preserves order/dir-first/date/title)
    if (mapped.children) mapped.children.sort(compareLabsItems);
    groups.push({
      id: child.slug.join("/"),
      label: child.title,
      href: child.href,
      items: mapped.children ?? [],
      order: child.order,
      hidden: child.hidden,
    });
  }

  if (looseFiles.length > 0) {
    looseFiles.sort(compareLabsItems);
    groups.unshift({
      id: "workspace",
      label: "Workspace",
      href: "/read",
      items: looseFiles,
    });
  }

  // Groups themselves should be in source order (already sorted via compareNodes,
  // but workspace group is pinned first)
  // Non-workspace groups are already ordered; ensure stable.
  // If workspace exists, keep it first; otherwise keep natural order.
  return groups;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten the tree into a depth-first list (groups → items → nested children)
 * suitable for a command palette.
 */
export function flattenToList(tree: LabsSidebarTree): LabsSidebarItem[] {
  const out: LabsSidebarItem[] = [];
  function walk(items: LabsSidebarItem[]) {
    for (const it of items) {
      out.push(it);
      if (it.children && it.children.length > 0) walk(it.children);
    }
  }
  for (const g of tree) walk(g.items);
  return out;
}

export function getOrderedSlugs(tree: LabsSidebarTree): string[][] {
  return flattenToList(tree).map((it) => it.slug);
}

export function getOrderedHrefs(tree: LabsSidebarTree): string[] {
  return flattenToList(tree).map((it) => it.href);
}

export function getAllTags(tree: LabsSidebarTree): string[] {
  const set = new Set<string>();
  for (const it of flattenToList(tree)) for (const t of it.tags ?? []) set.add(t);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
