import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawFileEntry } from "@/lib/content-source";
import { buildRuntimeLocalIndex, runtimeEntryToContentFileNode } from "@/lib/runtime-local-index";

const listRuntimeLocalFolderMock = vi.hoisted(() => vi.fn());
const readRuntimeLocalFileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runtime-local-folder", () => ({
  listRuntimeLocalFolder: listRuntimeLocalFolderMock,
  readRuntimeLocalFile: readRuntimeLocalFileMock,
}));

const entries: RawFileEntry[] = [
  {
    id: "browser-local:Vault/projects/guide.mdx",
    path: ["projects", "guide.mdx"],
    mtime: Date.parse("2026-07-08T10:00:00Z"),
    size: 120,
  },
  {
    id: "browser-local:Vault/drafts/draft.md",
    path: ["drafts", "draft.md"],
    mtime: Date.parse("2026-07-07T12:00:00Z"),
    size: 90,
  },
  {
    id: "browser-local:Vault/archive/hidden.md",
    path: ["archive", "hidden.md"],
    mtime: Date.parse("2026-07-07T10:00:00Z"),
    size: 80,
  },
];

const rawById = new Map<string, string>([
  [
    "browser-local:Vault/projects/guide.mdx",
    `---
title: Runtime Guide
tags: [runtime, local]
updated: "2026-07-08"
---
# Ignored H1

Intro paragraph about browser vaults.

## Searchable Heading

\`\`\`ts
const runtimeLocal = true;
\`\`\`
`,
  ],
  [
    "browser-local:Vault/drafts/draft.md",
    "---\ntitle: Runtime Draft\ndraft: true\ntags: [draft]\n---\n# Runtime Draft",
  ],
  ["browser-local:Vault/archive/hidden.md", "---\nhidden: true\ntags: [secret]\n---\n# Hidden"],
]);

describe("runtime local index", () => {
  beforeEach(() => {
    listRuntimeLocalFolderMock.mockReset();
    readRuntimeLocalFileMock.mockReset();
    listRuntimeLocalFolderMock.mockResolvedValue(entries);
    readRuntimeLocalFileMock.mockImplementation(async (id: string) => rawById.get(id) ?? "");
  });

  it("parses runtime local frontmatter into library docs, search records, and tags", async () => {
    const index = await buildRuntimeLocalIndex("Vault");

    expect(index.libraryDocs).toHaveLength(2);
    expect(
      index.libraryDocs.some((doc) => doc.title === "Runtime Draft" && doc.kind === "draft")
    ).toBe(true);
    const guide = index.libraryDocs.find((doc) => doc.title === "Runtime Guide");
    expect(guide).toMatchObject({
      title: "Runtime Guide",
      section: "Projects",
      tags: ["runtime", "local"],
      kind: "doc",
    });
    expect(guide?.href).toContain("/runtime/local?");
    expect(guide?.href).toContain("file=browser-local%3AVault%2Fprojects%2Fguide.mdx");

    expect(index.tagCounts).toEqual([
      { name: "local", count: 1 },
      { name: "runtime", count: 1 },
    ]);
    expect(index.counts.page).toBe(1);
    expect(index.counts.heading).toBe(1);
    expect(index.counts.code).toBe(1);
    expect(index.counts.folder).toBe(1);
    const searchTitles = index.searchRecords.map((record) => record.title);
    expect(searchTitles).not.toContain("Runtime Draft");
    expect(searchTitles).toEqual(
      expect.arrayContaining([
        "Runtime Guide",
        "Searchable Heading",
        "const runtimeLocal = true;",
        "Projects",
      ])
    );
  });

  it("falls back from frontmatter title to the first H1", () => {
    const node = runtimeEntryToContentFileNode(
      { id: "browser-local:Vault/notes/plain.md", path: ["notes", "plain.md"] },
      "# Plain Note\n\nBody text."
    );

    expect(node.title).toBe("Plain Note");
    expect(node.description).toBe("Body text.");
    expect(node.href).toContain("title=Plain+Note");
  });
});
