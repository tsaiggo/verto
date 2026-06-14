import { describe, expect, it } from "vitest";

import { buildRuntimeContentTree } from "@/lib/content-source/runtime-tree";
import type { RawFileEntry } from "@/lib/content-source";

describe("runtime content tree", () => {
  it("builds a lightweight rail tree from GitHub file entries", () => {
    const entries: RawFileEntry[] = [
      { id: "sha-intro", path: ["intro.md"], sha: "sha-intro" },
      { id: "sha-guide", path: ["docs", "quick-start.mdx"], sha: "sha-guide" },
      { id: "sha-index", path: ["docs", "_index.md"], sha: "sha-index" },
    ];

    const root = buildRuntimeContentTree(entries, { source: "github" });

    expect(root.children.map((child) => child.slug.join("/"))).toEqual(["docs", "intro"]);
    const docs = root.children[0];
    expect(docs?.type).toBe("dir");
    if (docs?.type !== "dir") throw new Error("expected docs directory");
    expect(docs.index?.href).toBe("/read/docs");
    expect(docs.index?.runtime).toBe(true);
    expect(docs.children.map((child) => child.slug.join("/"))).toEqual(["docs/quick-start"]);
    expect(docs.children[0]?.title).toBe("Quick Start");
    expect(docs.children[0]?.type).toBe("file");
    if (docs.children[0]?.type !== "file") throw new Error("expected file");
    expect(docs.children[0].runtime).toBe(true);
    expect(docs.children[0].runtimeSource).toBe("github");
  });

  it("builds a lightweight rail tree from local runtime file entries", () => {
    const entries: RawFileEntry[] = [
      {
        id: "/Users/me/Notes/inbox.md",
        path: ["inbox.md"],
        mtime: 1_717_000_000_000,
      },
      {
        id: "/Users/me/Notes/projects/README.md",
        path: ["projects", "README.md"],
      },
      {
        id: "/Users/me/Notes/projects/roadmap.mdx",
        path: ["projects", "roadmap.mdx"],
      },
    ];

    const root = buildRuntimeContentTree(entries, { source: "local" });

    expect(root.children.map((child) => child.slug.join("/"))).toEqual(["projects", "inbox"]);
    const projects = root.children[0];
    expect(projects?.type).toBe("dir");
    if (projects?.type !== "dir") throw new Error("expected projects dir");
    expect(projects.index?.href).toBe("/read/projects");
    expect(projects.index?.runtime).toBe(true);
    expect(projects.children[0]?.title).toBe("Roadmap");
    expect(projects.children[0]?.type).toBe("file");
    if (projects.children[0]?.type !== "file") throw new Error("expected file");
    expect(projects.children[0].runtime).toBe(true);
    expect(projects.children[0].runtimeSource).toBe("local");
  });

  it("orders directories first, then sibling files alphabetically by title", () => {
    // Runtime entries have no frontmatter → title is the only sort signal.
    const entries: RawFileEntry[] = [
      { id: "z", path: ["zebra.md"], sha: "z" },
      { id: "a", path: ["apple.md"], sha: "a" },
      { id: "m", path: ["mango.mdx"], sha: "m" },
      { id: "d", path: ["folder", "note.md"], sha: "d" },
    ];

    const root = buildRuntimeContentTree(entries, { source: "github" });

    expect(root.children.map((child) => child.slug.join("/"))).toEqual([
      "folder",
      "apple",
      "mango",
      "zebra",
    ]);
  });
});
