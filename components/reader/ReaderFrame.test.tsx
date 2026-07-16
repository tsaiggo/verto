import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReaderFrame from "@/components/reader/ReaderFrame";

describe("ReaderFrame", () => {
  it("renders a single-column reader with no optional chrome", () => {
    const html = renderToStaticMarkup(
      <ReaderFrame mainLabel="Document content">
        <article>Body</article>
      </ReaderFrame>
    );

    expect(html).toContain('class="reader-scroll"');
    expect(html).toContain('data-reader-tabs="absent"');
    expect(html).toContain('class="reader-workbench is-single-column"');
    expect(html).toContain('class="main" aria-label="Document content"');
    expect(html).not.toContain('class="toc-rail"');
  });

  it("keeps tabs, context, and chat around the shared scroll workbench", () => {
    const html = renderToStaticMarkup(
      <ReaderFrame
        mainLabel="Document content"
        mainProps={{ "aria-busy": true }}
        tabs={<div className="tabs-test">Tabs</div>}
        context={<div className="context-test">Outline</div>}
        contextProps={{ "aria-label": "Document outline" }}
        chat={<div className="chat-test">Chat</div>}
      >
        <article>Body</article>
      </ReaderFrame>
    );

    expect(html).toContain('data-reader-tabs="present"');
    expect(html).toContain('class="reader-workbench"');
    expect(html).not.toContain("reader-workbench is-single-column");
    expect(html).toContain('class="main"');
    expect(html).toContain('aria-label="Document content"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('class="toc-rail"');
    expect(html).toContain('data-context-panel="true"');
    expect(html).toContain('aria-label="Document outline"');
    expect(html.indexOf("tabs-test")).toBeLessThan(html.indexOf("reader-scroll"));
    expect(html.indexOf("reader-scroll")).toBeLessThan(html.indexOf("chat-test"));
  });
});
