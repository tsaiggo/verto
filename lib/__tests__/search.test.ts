import { describe, it, expect } from "vitest";
import {
  extractCodeBlocks,
  extractSearchableText,
  buildFileRecords,
  buildFolderRecords,
  summarizeCounts,
  searchRecords,
  type SearchRecord,
} from "@/lib/search";
import type { ContentDirNode, ContentFileNode } from "@/lib/content-source";

const source = { kind: "local" as const, name: "Local Library" };

function fileNode(over: Partial<ContentFileNode> = {}): ContentFileNode {
  return {
    type: "file",
    slug: ["docs", "mdx-authoring"],
    href: "/read/docs/mdx-authoring",
    title: "MDX Authoring",
    description: "How to write MDX with reusable components.",
    tags: ["mdx", "components"],
    mtime: 1000,
    id: "id-1",
    ext: ".mdx",
    ...over,
  };
}

const RAW = `# MDX Authoring

Intro paragraph about components.

## Reusable components

Some text.

\`\`\`tsx
export const Hello = () => <span>hi</span>;
\`\`\`

### Nested heading

More.
`;

describe("extractCodeBlocks", () => {
  it("captures language and trimmed body", () => {
    const blocks = extractCodeBlocks(RAW);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("tsx");
    expect(blocks[0].code).toContain("export const Hello");
  });

  it("ignores empty fences and indented code", () => {
    expect(extractCodeBlocks("```js\n```\n")).toHaveLength(0);
    expect(extractCodeBlocks("    not fenced\n")).toHaveLength(0);
  });
});

describe("extractSearchableText", () => {
  it("keeps reader-visible prose while dropping frontmatter, code, and markup", () => {
    const text = extractSearchableText(
      `---\ntitle: Hidden config\n---\n# Visible title\n\nA linked [reader phrase](https://example.com).\n\n\`\`\`ts\nconst secretCode = true\n\`\`\``
    );

    expect(text).toContain("Visible title");
    expect(text).toContain("reader phrase");
    expect(text).not.toContain("Hidden config");
    expect(text).not.toContain("secretCode");
  });
});

describe("buildFileRecords", () => {
  it("emits a page record plus headings and code", () => {
    const records = buildFileRecords(fileNode(), RAW, source);
    const kinds = records.map((r) => r.kind);
    expect(kinds.filter((k) => k === "page")).toHaveLength(1);
    // H2 + H3 are within the 2–4 depth window; H1 is excluded.
    expect(kinds.filter((k) => k === "heading")).toHaveLength(2);
    expect(kinds.filter((k) => k === "code")).toHaveLength(1);

    const page = records.find((r) => r.kind === "page")!;
    expect(page.title).toBe("MDX Authoring");
    expect(page.href).toBe("/read/docs/mdx-authoring");
    expect(page.sourceName).toBe("Local Library");
    expect(page.tags).toEqual(["mdx", "components"]);

    const heading = records.find((r) => r.kind === "heading")!;
    expect(heading.href).toContain("#");
  });
});

describe("buildFolderRecords", () => {
  it("emits a record for each visible directory, skipping root and hidden", () => {
    const root: ContentDirNode = {
      type: "dir",
      slug: [],
      href: "/read",
      title: "root",
      children: [
        {
          type: "dir",
          slug: ["docs"],
          href: "/read/docs",
          title: "Docs",
          children: [fileNode()],
        },
        {
          type: "dir",
          slug: ["secret"],
          href: "/read/secret",
          title: "Secret",
          hidden: true,
          children: [],
        },
      ],
    };
    const records = buildFolderRecords(root, source);
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe("Docs");
    expect(records[0].snippet).toBe("1 entry");
  });
});

describe("searchRecords", () => {
  const records: SearchRecord[] = buildFileRecords(fileNode(), RAW, source);

  it("returns nothing for an empty query", () => {
    expect(searchRecords(records, "   ")).toEqual([]);
  });

  it("matches on title, tags and description", () => {
    expect(searchRecords(records, "authoring").length).toBeGreaterThan(0);
    expect(searchRecords(records, "components").length).toBeGreaterThan(0);
  });

  it("matches ordinary document prose that is not present in metadata", () => {
    const results = searchRecords(records, "intro paragraph", "page");

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("MDX Authoring");
  });

  it("requires every term to match (AND semantics)", () => {
    // Both terms appear (title/tags), so the page matches.
    expect(searchRecords(records, "mdx components").length).toBeGreaterThan(0);
    // One term is absent → no match.
    expect(searchRecords(records, "mdx nonexistentword")).toEqual([]);
  });

  it("respects the scope filter", () => {
    const headings = searchRecords(records, "components", "heading");
    expect(headings.every((r) => r.kind === "heading")).toBe(true);
    const pages = searchRecords(records, "components", "page");
    expect(pages.every((r) => r.kind === "page")).toBe(true);
  });

  it("ranks the whole page above sub-results for the same query", () => {
    const results = searchRecords(records, "components");
    expect(results[0].kind).toBe("page");
  });

  it("can sort matching results by recency", () => {
    const stale = buildFileRecords(
      fileNode({
        title: "Components",
        description: "Short note",
        mtime: 1000,
      }),
      "# Components",
      source
    )[0];
    const fresh = buildFileRecords(
      fileNode({
        slug: ["docs", "recent-note"],
        href: "/read/docs/recent-note",
        title: "Recent note",
        description: "Mentions components only in passing",
        mtime: 9000,
      }),
      "# Recent note",
      source
    )[0];

    expect(searchRecords([stale, fresh], "components", "all", "recent")).toEqual([fresh, stale]);
  });

  it("keeps relevance as the default sort order", () => {
    const precise = buildFileRecords(
      fileNode({
        title: "Components",
        description: "Short note",
        mtime: 1000,
      }),
      "# Components",
      source
    )[0];
    const recentButLessRelevant = buildFileRecords(
      fileNode({
        slug: ["docs", "recent-note"],
        href: "/read/docs/recent-note",
        title: "Recent note",
        description: "Mentions components only in passing",
        mtime: 9000,
      }),
      "# Recent note",
      source
    )[0];

    expect(searchRecords([recentButLessRelevant, precise], "components")).toEqual([
      precise,
      recentButLessRelevant,
    ]);
  });
});

describe("summarizeCounts", () => {
  it("tallies records by kind", () => {
    const records = buildFileRecords(fileNode(), RAW, source);
    const counts = summarizeCounts(records);
    expect(counts.all).toBe(records.length);
    expect(counts.page).toBe(1);
    expect(counts.heading).toBe(2);
    expect(counts.code).toBe(1);
  });
});
