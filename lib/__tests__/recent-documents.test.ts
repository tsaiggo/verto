import { describe, expect, it } from "vitest";

import { recentDocumentDate, sortRecentDocuments } from "@/lib/recent-documents";
import type { ContentFileNode } from "@/lib/content-source";

function file(overrides: Partial<ContentFileNode> = {}): ContentFileNode {
  return {
    type: "file",
    slug: ["demo"],
    href: "/read/demo",
    title: "Demo",
    mtime: 0,
    id: "demo.md",
    ext: ".md",
    ...overrides,
  };
}

describe("recentDocumentDate", () => {
  it("uses the same Updated label for updated, date, and mtime metadata", () => {
    expect(recentDocumentDate(file({ updated: "2026-07-15" })).label).toBe("Updated July 15, 2026");
    expect(recentDocumentDate(file({ date: "2026-07-14" })).label).toBe("Updated July 14, 2026");
    expect(recentDocumentDate(file({ mtime: Date.UTC(2026, 6, 13) })).label).toBe(
      "Updated July 13, 2026"
    );
  });

  it("falls back from invalid frontmatter and never renders Invalid Date", () => {
    const fallback = recentDocumentDate(
      file({ updated: "not-a-date", date: "2026-02-31", mtime: Date.UTC(2026, 6, 12) })
    );
    expect(fallback.label).toBe("Updated July 12, 2026");
    expect(fallback.iso).toBe("2026-07-12T00:00:00.000Z");

    expect(recentDocumentDate(file({ updated: "bad", mtime: 0 }))).toEqual({
      iso: null,
      label: "Update date unavailable",
      timestamp: 0,
    });
    expect(recentDocumentDate(file({ mtime: Number.MAX_VALUE })).label).toBe(
      "Update date unavailable"
    );
  });
});

describe("sortRecentDocuments", () => {
  it("sorts valid updates first and leaves unknown dates last", () => {
    const result = sortRecentDocuments([
      file({ href: "/unknown", updated: "bad" }),
      file({ href: "/older", date: "2026-07-01" }),
      file({ href: "/newer", updated: "2026-07-15" }),
    ]);
    expect(result.map((item) => item.href)).toEqual(["/newer", "/older", "/unknown"]);
  });
});
