import { describe, it, expect } from "vitest";
import {
  extractCodeBlocks,
  buildFileRecords,
  buildFolderRecords,
  summarizeCounts,
  searchRecords,
  type SearchRecord,
} from "@/lib/search";
import type {
  ContentDirNode,
  ContentFileNode,
} from "@/lib/content-source";

const source = { kind: "github" as const, name: "GitHub" };

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
    expect(page.sourceName).toBe("GitHub");
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
