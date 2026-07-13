import { describe, expect, it } from "vitest";
import { resolveDocumentTab } from "@/lib/document-tabs";

describe("resolveDocumentTab", () => {
  it("resolves readable content and help routes", () => {
    expect(resolveDocumentTab("/read/guides/getting-started")).toEqual({
      path: "/read/guides/getting-started",
      title: "Getting started",
    });
    expect(resolveDocumentTab("/help/keyboard-shortcuts")).toEqual({
      path: "/help/keyboard-shortcuts",
      title: "Keyboard shortcuts",
    });
  });

  it("rejects reader roots and collection views", () => {
    expect(resolveDocumentTab("/read")).toBeNull();
    expect(resolveDocumentTab("/read/tags/design")).toBeNull();
    expect(resolveDocumentTab("/read/status/draft")).toBeNull();
  });

  it("keeps the full query-addressed runtime location", () => {
    const search = "file=notes%2Fguide.md&title=Product+Guide&ext=.md";
    expect(resolveDocumentTab("/runtime/local", search)).toEqual({
      path: `/runtime/local?${search}`,
      title: "Product Guide",
    });
  });

  it("derives a runtime title from the selected file", () => {
    expect(resolveDocumentTab("/runtime/local", "file=notes%2Fdaily-log.mdx")).toEqual({
      path: "/runtime/local?file=notes%2Fdaily-log.mdx",
      title: "Daily log",
    });
  });

  it("does not create a runtime tab without a selected file", () => {
    expect(resolveDocumentTab("/runtime/local", "")).toBeNull();
  });
});
