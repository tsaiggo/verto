import { describe, expect, it } from "vitest";
import type { RuntimeLocalIndexedDocument } from "@/lib/runtime-local-index";
import { buildVaultSidebarTree } from "./VaultSidebarData";

function document(
  id: string,
  path: string[],
  title: string,
  order?: number
): RuntimeLocalIndexedDocument {
  const ext = path.at(-1)?.endsWith(".md") ? ".md" : ".mdx";
  return {
    entry: { id, path, mtime: 0 },
    node: {
      type: "file",
      slug: path.slice(0, -1),
      href: `/runtime/local?file=${encodeURIComponent(id)}`,
      title,
      mtime: 0,
      id,
      ext,
      order,
    },
    raw: "",
    libraryDoc: {
      title,
      ext,
      href: `/runtime/local?file=${encodeURIComponent(id)}`,
      section: "Local Library",
      tags: [],
      updatedLabel: "just now",
      updatedISO: "2026-07-24T00:00:00.000Z",
      kind: "doc",
    },
  };
}

describe("buildVaultSidebarTree", () => {
  it("keeps root files first and preserves nested local folder hierarchy", () => {
    const tree = buildVaultSidebarTree([
      document("ideas", ["Plans", "Ideas", "ideas.mdx"], "Ideas"),
      document("overview", ["overview.mdx"], "Overview"),
      document("weekly", ["Plans", "weekly.md"], "Weekly"),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: "__verto-root-files__", name: "" });
    expect(tree[0]?.documents.map((item) => item.entry.id)).toEqual(["overview"]);
    expect(tree[0]?.folders.map((folder) => folder.name)).toEqual(["Plans"]);
    expect(tree[0]?.folders[0]?.documents.map((item) => item.entry.id)).toEqual(["weekly"]);
    expect(tree[0]?.folders[0]?.folders[0]?.documents.map((item) => item.entry.id)).toEqual([
      "ideas",
    ]);
  });

  it("sorts folders and honors an explicit page order inside each folder", () => {
    const tree = buildVaultSidebarTree([
      document("zeta", ["Zeta", "zeta.mdx"], "Zeta"),
      document("beta", ["Alpha", "beta.mdx"], "Beta", 2),
      document("alpha", ["Alpha", "alpha.mdx"], "Alpha", 1),
    ]);

    expect(tree.map((folder) => folder.name)).toEqual(["Alpha", "Zeta"]);
    expect(tree[0]?.documents.map((item) => item.node.title)).toEqual(["Alpha", "Beta"]);
  });
});
