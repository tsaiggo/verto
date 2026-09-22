import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import type { ContentDirNode, ContentFileNode } from "@/lib/content-source/types";
import {
  buildLabsTree,
  flattenToList,
  getOrderedSlugs,
  getOrderedHrefs,
  collectTagFacets,
  collectSourceFacets,
  createExpandState,
  isExpanded,
  toggleExpanded,
  getAllTags,
} from "./buildLabsTree";

// ---------------------------------------------------------------------------
// Helpers: in-memory ContentNode fixtures (no file I/O)
// ---------------------------------------------------------------------------

function fileNode(
  overrides: Partial<ContentFileNode> & { slug: string[]; title: string }
): ContentFileNode {
  const slug = overrides.slug;
  return {
    type: "file",
    slug,
    href: overrides.href ?? "/read/" + slug.join("/"),
    title: overrides.title,
    order: overrides.order,
    hidden: overrides.hidden,
    mtime: overrides.mtime ?? 0,
    id: overrides.id ?? slug.join("/") + ".md",
    ext: overrides.ext ?? ".md",
    description: overrides.description,
    tags: overrides.tags,
    date: overrides.date,
    draft: overrides.draft,
  };
}

function dirNode(
  overrides: Partial<ContentDirNode> & {
    slug: string[];
    title: string;
    children?: ContentDirNode["children"];
  }
): ContentDirNode {
  const slug = overrides.slug;
  return {
    type: "dir",
    slug,
    href: overrides.href ?? (slug.length === 0 ? "/read" : "/read/" + slug.join("/")),
    title: overrides.title,
    order: overrides.order,
    hidden: overrides.hidden,
    children: overrides.children ?? [],
    index: overrides.index,
  };
}

function rootFixture(children: ContentDirNode["children"]): ContentDirNode {
  return dirNode({ slug: [], title: "Home", children });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildLabsTree", () => {
  it("hidden:true pruned — hidden file and hidden dir are removed", () => {
    const root = rootFixture([
      fileNode({ slug: ["visible"], title: "Visible" }),
      fileNode({ slug: ["secret"], title: "Secret", hidden: true }),
      dirNode({
        slug: ["hidden-dir"],
        title: "Hidden Dir",
        hidden: true,
        children: [fileNode({ slug: ["hidden-dir", "inside"], title: "Inside" })],
      }),
      dirNode({
        slug: ["docs"],
        title: "Docs",
        children: [
          fileNode({ slug: ["docs", "intro"], title: "Intro" }),
          fileNode({ slug: ["docs", "hidden-file"], title: "Hidden File", hidden: true }),
        ],
      }),
    ]);

    const tree = buildLabsTree(root);

    // Hidden file at root should not appear in workspace group
    const flat = flattenToList(tree);
    const slugs = flat.map((i) => i.slug.join("/"));
    expect(slugs).not.toContain("secret");
    expect(slugs).not.toContain("hidden-dir/inside");
    expect(slugs).not.toContain("docs/hidden-file");
    expect(slugs).toContain("visible");
    expect(slugs).toContain("docs/intro");

    // Hidden dir group should not exist
    expect(tree.find((g) => g.id === "hidden-dir")).toBeUndefined();

    // Docs group should have only 1 item after prune
    const docsGroup = tree.find((g) => g.id === "docs");
    expect(docsGroup).toBeDefined();
    expect(docsGroup!.items).toHaveLength(1);
    expect(docsGroup!.items[0].slug).toEqual(["docs", "intro"]);
  });

  it("order 1 before order 2 — explicit order wins", () => {
    const root = rootFixture([
      dirNode({
        slug: ["ordered"],
        title: "Ordered",
        children: [
          fileNode({ slug: ["ordered", "second"], title: "Second", order: 2 }),
          fileNode({ slug: ["ordered", "first"], title: "First", order: 1 }),
          fileNode({ slug: ["ordered", "third"], title: "Third", order: 3 }),
        ],
      }),
    ]);

    const tree = buildLabsTree(root);
    const orderedGroup = tree.find((g) => g.id === "ordered")!;
    expect(orderedGroup).toBeDefined();
    expect(orderedGroup.items.map((i) => i.title)).toEqual(["First", "Second", "Third"]);
    expect(orderedGroup.items.map((i) => i.slug.join("/"))).toEqual([
      "ordered/first",
      "ordered/second",
      "ordered/third",
    ]);
  });

  it("dir-first — directories sort before files when order equal", () => {
    const root = rootFixture([
      dirNode({
        slug: ["mixed"],
        title: "Mixed",
        children: [
          fileNode({ slug: ["mixed", "alpha-file"], title: "Alpha File" }),
          dirNode({
            slug: ["mixed", "beta-dir"],
            title: "Beta Dir",
            children: [fileNode({ slug: ["mixed", "beta-dir", "nested"], title: "Nested" })],
          }),
        ],
      }),
    ]);

    const tree = buildLabsTree(root);
    const mixed = tree.find((g) => g.id === "mixed")!;
    expect(mixed).toBeDefined();
    // Dir (beta-dir) should come before file (alpha-file) because dirs first
    expect(mixed.items[0].slug).toEqual(["mixed", "beta-dir"]);
    expect(mixed.items[0].children).toBeDefined();
    expect(mixed.items[1].slug).toEqual(["mixed", "alpha-file"]);
  });

  it("empty tree returns empty state — honest empty, no fake groups", () => {
    const emptyRoot = rootFixture([]);
    const tree = buildLabsTree(emptyRoot);
    expect(tree).toEqual([]);
    expect(flattenToList(tree)).toEqual([]);
    expect(getOrderedSlugs(tree)).toEqual([]);
  });

  it("files directly under root become Workspace group", () => {
    const root = rootFixture([
      fileNode({ slug: ["loose-one"], title: "Loose One" }),
      fileNode({ slug: ["loose-two"], title: "Loose Two" }),
      dirNode({
        slug: ["section"],
        title: "Section",
        children: [fileNode({ slug: ["section", "page"], title: "Page" })],
      }),
    ]);

    const tree = buildLabsTree(root);
    expect(tree[0].id).toBe("workspace");
    expect(tree[0].label).toBe("Workspace");
    expect(tree[0].href).toBe("/read");
    expect(tree[0].items.map((i) => i.title).sort()).toEqual(["Loose One", "Loose Two"]);
    expect(tree.find((g) => g.id === "section")).toBeDefined();
  });

  it("respects navigation.json overrides already applied — hidden/order/title", () => {
    // Simulate tree.ts already applied navigation.json: titles/orders/hidden mutated
    const root = rootFixture([
      dirNode({
        slug: ["blog"],
        title: "Blog Archive", // overridden from "Blog"
        order: 1,
        children: [fileNode({ slug: ["blog", "post"], title: "Post" })],
      }),
      dirNode({
        slug: ["showcase"],
        title: "Showcase",
        order: 2,
        children: [fileNode({ slug: ["showcase", "demo"], title: "Demo" })],
      }),
      dirNode({
        slug: ["drafts"],
        title: "Drafts",
        hidden: true,
        children: [fileNode({ slug: ["drafts", "secret"], title: "Secret" })],
      }),
    ]);

    const tree = buildLabsTree(root);
    // drafts pruned
    expect(tree.find((g) => g.id === "drafts")).toBeUndefined();
    // blog before showcase because order 1 < 2
    expect(tree.map((g) => g.id)).toEqual(["blog", "showcase"]);
    expect(tree[0].label).toBe("Blog Archive");
  });

  it("nested hidden subtree pruned entirely", () => {
    const root = rootFixture([
      dirNode({
        slug: ["a"],
        title: "A",
        children: [
          dirNode({
            slug: ["a", "hidden-child"],
            title: "Hidden Child",
            hidden: true,
            children: [fileNode({ slug: ["a", "hidden-child", "deep"], title: "Deep" })],
          }),
          fileNode({ slug: ["a", "visible"], title: "Visible" }),
        ],
      }),
    ]);
    const tree = buildLabsTree(root);
    const aGroup = tree.find((g) => g.id === "a")!;
    expect(aGroup.items).toHaveLength(1);
    expect(aGroup.items[0].slug).toEqual(["a", "visible"]);
    const flat = flattenToList(tree);
    expect(flat.map((i) => i.slug.join("/"))).not.toContain("a/hidden-child/deep");
  });

  it("date desc tie-breaker when order equal and both files", () => {
    const root = rootFixture([
      dirNode({
        slug: ["dated"],
        title: "Dated",
        children: [
          fileNode({ slug: ["dated", "older"], title: "Older", date: "2024-01-01" }),
          fileNode({ slug: ["dated", "newer"], title: "Newer", date: "2026-01-01" }),
        ],
      }),
    ]);
    const tree = buildLabsTree(root);
    const dated = tree.find((g) => g.id === "dated")!;
    expect(dated.items[0].slug).toEqual(["dated", "newer"]);
    expect(dated.items[1].slug).toEqual(["dated", "older"]);
  });
});

describe("flattenToList / getOrderedSlugs / getOrderedHrefs", () => {
  it("flattens depth-first preserving order", () => {
    const root = rootFixture([
      dirNode({
        slug: ["grp"],
        title: "Grp",
        children: [
          dirNode({
            slug: ["grp", "sub"],
            title: "Sub",
            children: [fileNode({ slug: ["grp", "sub", "leaf"], title: "Leaf" })],
          }),
          fileNode({ slug: ["grp", "file"], title: "File" }),
        ],
      }),
    ]);
    const tree = buildLabsTree(root);
    // grp group: sub dir first (dir-first), then file
    const flat = flattenToList(tree);
    expect(flat.map((i) => i.slug.join("/"))).toEqual(["grp/sub", "grp/sub/leaf", "grp/file"]);
    expect(getOrderedSlugs(tree)).toEqual([
      ["grp", "sub"],
      ["grp", "sub", "leaf"],
      ["grp", "file"],
    ]);
    expect(getOrderedHrefs(tree)).toEqual([
      "/read/grp/sub",
      "/read/grp/sub/leaf",
      "/read/grp/file",
    ]);
  });
});

describe("facets", () => {
  it("collectTagFacets counts tags across tree sorted by count desc then alpha", () => {
    const root = rootFixture([
      dirNode({
        slug: ["a"],
        title: "A",
        children: [
          fileNode({ slug: ["a", "one"], title: "One", tags: ["alpha", "beta"] }),
          fileNode({ slug: ["a", "two"], title: "Two", tags: ["alpha"] }),
          fileNode({ slug: ["a", "three"], title: "Three", tags: ["beta", "gamma"] }),
        ],
      }),
    ]);
    const tree = buildLabsTree(root);
    const facets = collectTagFacets(tree);
    expect(facets).toEqual([
      { tag: "alpha", count: 2 },
      { tag: "beta", count: 2 },
      { tag: "gamma", count: 1 },
    ]);
  });

  it("collectSourceFacets counts files per group", () => {
    const root = rootFixture([
      dirNode({
        slug: ["a"],
        title: "A",
        children: [fileNode({ slug: ["a", "one"], title: "One" })],
      }),
      dirNode({
        slug: ["b"],
        title: "B",
        children: [
          fileNode({ slug: ["b", "one"], title: "One" }),
          fileNode({ slug: ["b", "two"], title: "Two" }),
        ],
      }),
    ]);
    const tree = buildLabsTree(root);
    const facets = collectSourceFacets(tree);
    expect(facets).toEqual([
      { id: "a", label: "A", href: "/read/a", count: 1 },
      { id: "b", label: "B", href: "/read/b", count: 2 },
    ]);
  });

  it("getAllTags returns unique sorted tags", () => {
    const root = rootFixture([
      dirNode({
        slug: ["a"],
        title: "A",
        children: [
          fileNode({ slug: ["a", "one"], title: "One", tags: ["zeta", "alpha"] }),
          fileNode({ slug: ["a", "two"], title: "Two", tags: ["alpha"] }),
        ],
      }),
    ]);
    const tree = buildLabsTree(root);
    expect(getAllTags(tree)).toEqual(["alpha", "zeta"]);
  });
});

describe("expand/collapse helpers", () => {
  it("create / isExpanded / toggleExpanded are pure", () => {
    const s = createExpandState(["a"]);
    expect(isExpanded(s, "a")).toBe(true);
    expect(isExpanded(s, "b")).toBe(false);
    const s2 = toggleExpanded(s, "b");
    expect(isExpanded(s2, "b")).toBe(true);
    expect(isExpanded(s, "b")).toBe(false); // original not mutated
    const s3 = toggleExpanded(s2, "a");
    expect(isExpanded(s3, "a")).toBe(false);
  });
});

describe("no banned imports in prod", () => {
  it("prod file does not import test fixtures or design data", () => {
    const prodPath = path.join(process.cwd(), "lib/sidebar/buildLabsTree.ts");
    const txt = fs.readFileSync(prodPath, "utf-8");
    expect(txt).not.toMatch(/from\s+["']\.\/fixtures["']/);
    expect(txt).not.toMatch(/from\s+["'].*fixtures["']/);
    const banned = ["hero" + "Books", "initial" + "Projects", "design-reference"];
    for (const token of banned) expect(txt).not.toContain(token);
    // also ensure no import that looks like test fixture data
    expect(txt).not.toMatch(/mock.*project/i);
  });
});
