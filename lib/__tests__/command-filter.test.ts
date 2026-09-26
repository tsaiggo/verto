import { describe, it, expect } from "vitest";
import {
  filterCommandItems,
  DEFAULT_SHORTCUTS,
  labsItemToCommandItem,
  type CommandItem,
} from "@/lib/command/filterCommandItems";
import { buildLabsTree, flattenToList } from "@/lib/sidebar/buildLabsTree";
import type { ContentDirNode } from "@/lib/content-source/types";

function makeItems(): CommandItem[] {
  return [
    { id: "a", label: "Library", href: "/library", keywords: ["read"] },
    { id: "b", label: "Search", href: "/search" },
    { id: "c", label: "Hidden Item", href: "/hidden", hidden: true },
    { id: "d", label: "Getting Started", href: "/read/getting-started", keywords: ["guide"] },
    { id: "e", label: "Agent", href: "/agent", keywords: ["ai"] },
  ];
}

describe("filterCommandItems", () => {
  it("case-insensitive substring on label/href/keywords", () => {
    const items = makeItems();
    expect(filterCommandItems(items, "library").map((i) => i.id)).toEqual(["a"]);
    expect(filterCommandItems(items, "LIBRARY").map((i) => i.id)).toEqual(["a"]);
    expect(filterCommandItems(items, "Lib").map((i) => i.id)).toEqual(["a"]);
    expect(filterCommandItems(items, "/SEARCH").map((i) => i.id)).toEqual(["b"]);
    expect(filterCommandItems(items, "guide").map((i) => i.id)).toEqual(["d"]);
    expect(filterCommandItems(items, "AI").map((i) => i.id)).toEqual(["e"]);
  });

  it("hidden:true pruned — never returned even when query matches", () => {
    const items = makeItems();
    expect(filterCommandItems(items, "hidden")).toEqual([]);
    expect(filterCommandItems(items, "").find((i) => i.id === "c")).toBeUndefined();
    expect(filterCommandItems(items, "Hidden Item")).toEqual([]);
  });

  it("empty query returns recents (recentRank sorted, then original order) up to recentLimit", () => {
    const items: CommandItem[] = [
      { id: "x", label: "X", href: "/x", recentRank: 2 },
      { id: "y", label: "Y", href: "/y", recentRank: 0 },
      { id: "z", label: "Z", href: "/z", recentRank: 1 },
      { id: "w", label: "W", href: "/w" },
    ];
    const recents = filterCommandItems(items, "", { recentLimit: 2 });
    expect(recents.map((i) => i.id)).toEqual(["y", "z"]);
    const all = filterCommandItems(items, "", { recentLimit: 10 });
    expect(all.map((i) => i.id)).toEqual(["y", "z", "x", "w"]);
  });

  it("non-empty query respects limit", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      label: `Item ${i}`,
      href: `/item/${i}`,
    }));
    const filtered = filterCommandItems(items, "item", { limit: 5 });
    expect(filtered).toHaveLength(5);
  });

  it("empty query default recents mirrors DEFAULT_SHORTCUTS first 5 when wired via CommandDialog", () => {
    expect(DEFAULT_SHORTCUTS.slice(0, 5).map((s) => s.id)).toEqual([
      "home",
      "library",
      "search",
      "collections",
      "tags",
    ]);
  });

  it("wired to LabsSidebar flat list — hidden subtree pruned via buildLabsTree", () => {
    const root: ContentDirNode = {
      type: "dir",
      slug: [],
      href: "/read",
      title: "Home",
      children: [
        {
          type: "dir" as const,
          slug: ["docs"],
          href: "/read/docs",
          title: "Docs",
          children: [
            {
              type: "file" as const,
              slug: ["docs", "visible"],
              href: "/read/docs/visible",
              title: "Visible",
              mtime: 0,
              id: "docs/visible.md",
              ext: ".md",
            },
            {
              type: "file" as const,
              slug: ["docs", "hidden"],
              href: "/read/docs/hidden",
              title: "Hidden",
              hidden: true,
              mtime: 0,
              id: "docs/hidden.md",
              ext: ".md",
            },
          ],
        },
      ],
    };
    const tree = buildLabsTree(root);
    const flat = flattenToList(tree).map(labsItemToCommandItem);
    expect(flat.map((i) => i.id)).toContain("docs/visible");
    expect(flat.map((i) => i.id)).not.toContain("docs/hidden");
    const filtered: CommandItem[] = filterCommandItems([...DEFAULT_SHORTCUTS, ...flat], "visible");
    expect(filtered.map((i: CommandItem) => i.label)).toContain("Visible");
    const hiddenFiltered: CommandItem[] = filterCommandItems(
      [...DEFAULT_SHORTCUTS, ...flat],
      "hidden"
    );
    expect(hiddenFiltered).toEqual([]);
  });

  it("case-insensitive href match for /read prefix", () => {
    const items: CommandItem[] = [{ id: "r", label: "Page", href: "/read/My-Page" }];
    expect(filterCommandItems(items, "/READ/my-page")).toHaveLength(1);
    expect(filterCommandItems(items, "my-page")).toHaveLength(1);
  });
});
