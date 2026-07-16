import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ArticleTocCard from "@/components/reader/ArticleTocCard";

describe("ArticleTocCard", () => {
  it("wraps real article headings in the shared Codex outline card", () => {
    const html = renderToStaticMarkup(
      createElement(ArticleTocCard, {
        items: [{ id: "intro", text: "Introduction", level: 2 }],
        title: "Reader guide",
      })
    );

    expect(html).toContain("article-toc-card");
    expect(html).toContain("data-article-toc");
    expect(html).toContain("Reader guide");
    expect(html).toContain('href="#intro"');
  });

  it("does not leave an empty card for documents without headings", () => {
    const html = renderToStaticMarkup(
      createElement(ArticleTocCard, { items: [], title: "Untitled" })
    );
    expect(html).toBe("");
  });
});
