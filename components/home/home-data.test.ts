import { describe, expect, it } from "vitest";
import { runtimeHomeWorkspace } from "@/components/home/home-data";
import type { ContentFileNode } from "@/lib/content-source";

function file(overrides: Partial<ContentFileNode>): ContentFileNode {
  const slug = overrides.slug ?? ["note"];
  return {
    type: "file",
    slug,
    href: `/runtime/local?file=${slug.join("/")}`,
    title: "Note",
    mtime: 0,
    id: slug.join("/") + ".mdx",
    ext: ".mdx",
    ...overrides,
  };
}

describe("runtimeHomeWorkspace", () => {
  it("derives cards and source-filter links only from readable runtime files", () => {
    const data = runtimeHomeWorkspace([
      file({ title: "Root note", slug: ["root-note"], mtime: 1_720_000_000_000 }),
      file({
        title: "Project plan",
        slug: ["product-planning", "plan"],
        mtime: 1_721_000_000_000,
      }),
      file({
        title: "Hidden note",
        slug: ["private", "hidden"],
        hidden: true,
        mtime: 1_722_000_000_000,
      }),
      file({ title: "Draft note", slug: ["drafts", "draft"], draft: true }),
    ]);

    expect(data.readableHrefs).toHaveLength(2);
    expect(data.groups).toEqual([
      expect.objectContaining({
        title: "Local Library",
        total: 1,
        href: "/library?source=Local%20Library",
      }),
      expect.objectContaining({
        title: "Product Planning",
        total: 1,
        href: "/library?source=Product%20Planning",
      }),
    ]);
    expect(data.recentDocs.map((doc) => doc.title)).toEqual(["Project plan", "Root note"]);
    expect(data.starters.map((doc) => doc.title)).toEqual(["Root note", "Project plan"]);
  });
});
