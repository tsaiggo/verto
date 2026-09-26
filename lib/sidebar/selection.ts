import type { LabsSidebarItem, LabsSidebarTree } from "./buildLabsTree";

/** Folder ids to open so the active document remains visible in the sidebar. */
export function selectedAncestorIds(tree: LabsSidebarTree, pathname: string): string[] {
  function find(items: LabsSidebarItem[], ancestors: string[]): string[] | null {
    for (const item of items) {
      const id = item.slug.join("/");
      if (item.href === pathname) return item.children ? [...ancestors, id] : ancestors;
      if (item.children) {
        const found = find(item.children, [...ancestors, id]);
        if (found) return found;
      }
    }
    return null;
  }

  for (const group of tree) {
    const found = find(group.items, []);
    if (found) return found;
  }
  return [];
}
