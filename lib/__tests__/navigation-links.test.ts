import { describe, expect, it } from "vitest";
import type { ContentFileNode } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";

function file(title: string, overrides: Partial<ContentFileNode> = {}): ContentFileNode {
  const slug = title.toLowerCase().split(/\s+/);
  return {
    type: "file",
    slug,
    href: `/read/${slug.join("/")}`,
    title,
    mtime: 0,
    id: `${slug.join("/")}.mdx`,
    ext: ".mdx",
    ...overrides,
  };
}

describe("sortRecentDocuments", () => {
  it("sorts visible documents by updated/date/mtime and applies a limit", () => {
    const docs = sortRecentDocuments(
      [
        file("Old", { date: "2024-01-01" }),
        file("Hidden", { updated: "2026-01-01", hidden: true }),
        file("Draft", { updated: "2026-01-02", draft: true }),
        file("Newest", { updated: "2025-05-01" }),
        file("Mtime", { mtime: Date.parse("2025-03-01") }),
      ],
      2
    );

    expect(docs.map((doc) => doc.title)).toEqual(["Newest", "Mtime"]);
  });
});
