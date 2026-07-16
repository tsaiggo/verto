import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";

describe("ContentPage", () => {
  it("renders the shared scroll, width, and heading contract", () => {
    const html = renderToStaticMarkup(
      <ContentPage width="compact">
        <ContentHeader title="Library" description="Browse your documents." />
      </ContentPage>
    );

    expect(html).toContain('data-content-page="true"');
    expect(html).toContain("content-page__inner--compact");
    expect(html).toContain('data-content-header="true"');
    expect(html).toContain("<h1");
    expect(html).toContain("Browse your documents.");
  });
});
