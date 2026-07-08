import { describe, expect, it, vi } from "vitest";
import { buildGraph } from "@/lib/graph";
import type { ContentFileNode } from "@/lib/content-source";

const fixtures = vi.hoisted(() => {
  const files = [
    {
      type: "file",
      slug: ["alpha"],
      href: "/read/alpha",
      title: "Alpha",
      tags: ["systems"],
      mtime: 1,
      id: "alpha",
      ext: ".mdx",
    },
    {
      type: "file",
      slug: ["beta"],
      href: "/read/beta",
      title: "Beta",
      tags: ["systems"],
      mtime: 2,
      id: "beta",
      ext: ".mdx",
    },
    {
      type: "file",
      slug: ["gamma"],
      href: "/read/gamma",
      title: "Gamma",
      tags: ["solo"],
      mtime: 3,
      id: "gamma",
      ext: ".md",
    },
  ] satisfies ContentFileNode[];

  return {
    files,
    rawById: new Map([
      ["alpha", "---\ntags: [systems]\n---\n# Alpha\n"],
      ["beta", "---\ntags: [systems]\n---\n# Beta\nSee [Gamma](/read/gamma)."],
      ["gamma", "---\ntags: [solo]\n---\n# Gamma\n"],
    ]),
  };
});

vi.mock("@/lib/content-source", () => ({
  listAllFiles: vi.fn(async () => fixtures.files),
  readFileNodeSource: vi.fn(
    async (file: { readonly id: string }) => fixtures.rawById.get(file.id) ?? ""
  ),
}));

describe("buildGraph", () => {
  it("connects two docs when they share a frontmatter tag", async () => {
    // Given: two fixture documents share the `systems` tag.
    // When: the knowledge graph is built from the mocked content source.
    const graph = await buildGraph();

    // Then: those documents are connected by a tag edge.
    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      "/read/alpha",
      "/read/beta",
      "/read/gamma",
    ]);
    expect(graph.edges).toContainEqual({
      source: "/read/alpha",
      target: "/read/beta",
      kind: "tag",
    });
  });

  it("connects two docs when one links to the other with a /read href", async () => {
    // Given: Beta links to Gamma using Markdown's inline link syntax.
    // When: the knowledge graph is built from the mocked content source.
    const graph = await buildGraph();

    // Then: the graph includes a directed link relationship.
    expect(graph.edges).toContainEqual({
      source: "/read/beta",
      target: "/read/gamma",
      kind: "link",
    });
  });
});
