import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ArticleTocCard from "@/components/reader/ArticleTocCard";

describe("Reader tools inspector contract", () => {
  it("provides ordered TOC, launcher, and companion panel surfaces", () => {
    const html = renderToStaticMarkup(
      createElement(ArticleTocCard, {
        items: [{ id: "intro", text: "Introduction", level: 2 }],
        title: "Reader guide",
      })
    );

    const tocIndex = html.indexOf("data-reader-toc-surface");
    const launcherIndex = html.indexOf("data-reading-companion-launcher-host");
    const panelIndex = html.indexOf("data-reading-companion-panel-host");

    expect(html).toContain("data-reader-tools");
    expect(tocIndex).toBeGreaterThan(-1);
    expect(launcherIndex).toBeGreaterThan(tocIndex);
    expect(panelIndex).toBeGreaterThan(launcherIndex);
  });

  it("does not leave Reader tools hosts behind when an article has no headings", () => {
    const html = renderToStaticMarkup(
      createElement(ArticleTocCard, { items: [], title: "Untitled" })
    );

    expect(html).toBe("");
  });
});
