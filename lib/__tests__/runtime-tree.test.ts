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

    const root = buildRuntimeContentTree(entries);

    expect(root.children.map((child) => child.slug.join("/"))).toEqual([
      "docs",
      "intro",
    ]);
    const docs = root.children[0];
    expect(docs?.type).toBe("dir");
    if (docs?.type !== "dir") throw new Error("expected docs directory");
    expect(docs.index?.href).toBe("/read/docs");
    expect(docs.children.map((child) => child.slug.join("/"))).toEqual([
      "docs/quick-start",
    ]);
    expect(docs.children[0]?.title).toBe("Quick Start");
  });
});
