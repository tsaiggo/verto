/**
 * adaptWorkspace — thin adapter from buildLabsTree() output to the ORIGINAL
 * WorkspaceSidebar visual structure.
 *
 * Original's mock: shortcuts + workspace + hard-coded projects.
 * Verto's truth: LabsSidebarTree (groups derived from ContentNode, no mocks).
 * This adapter re-projects verto groups onto the original's *visual* sections
 * (primary-navigation, Workspace, Projects) while preserving original's
 * layout/space/rhythm. No test fixtures, no mock projects
 * in prod path.
 *
 * Pattern follows VaultSidebarData: pure, no I/O, deterministic.
 */

import type { LabsSidebarItem, LabsSidebarTree } from "./buildLabsTree";

/**
 * Visual section after adaptation — one rendered <section> per LabsSidebarGroup
 * but styled with the original's `.navigation-section` / `.project-section`
 * rhythm. The adapter is identity-preserving: ordering from buildLabsTree
 * (order → dir-first → date → title) is already correct, so we just forward.
 */
export interface AdaptedWorkspaceGroup {
  id: string;
  label: string;
  href: string;
  items: LabsSidebarItem[];
  order?: number;
}

export interface AdaptedWorkspaceTree {
  groups: AdaptedWorkspaceGroup[];
  flattenedHrefs: string[];
  flattenedTitles: string[];
}

/**
 * Map LabsSidebarTree → adapted tree for the original shell.
 * Empty input → empty groups (honest empty state — caller renders placeholder).
 */
export function adaptLabsTreeToWorkspace(tree: LabsSidebarTree): AdaptedWorkspaceTree {
  const groups: AdaptedWorkspaceGroup[] = tree.map((g) => ({
    id: g.id,
    label: g.label,
    href: g.href,
    items: g.items,
    order: g.order,
  }));

  const flattenedHrefs: string[] = [];
  const flattenedTitles: string[] = [];
  for (const g of tree) {
    const walk = (items: LabsSidebarItem[]) => {
      for (const it of items) {
        flattenedHrefs.push(it.href);
        flattenedTitles.push(it.title);
        if (it.children && it.children.length > 0) walk(it.children);
      }
    };
    walk(g.items);
  }

  return { groups, flattenedHrefs, flattenedTitles };
}

/** Convenience: check duplicate name within a single group (case-insensitive trimmed). */
export function isDuplicateInGroup(name: string, group: AdaptedWorkspaceGroup | undefined, existingTitles: string[]): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle || !group) return existingTitles.some((t) => t.trim().toLowerCase() === needle);
  return group.items.some((it) => it.title.trim().toLowerCase() === needle) || existingTitles.some((t) => t.trim().toLowerCase() === needle);
}
