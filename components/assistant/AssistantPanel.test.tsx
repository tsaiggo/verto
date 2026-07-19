import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AssistantPanel from "@/components/assistant/AssistantPanel";

vi.mock("@/lib/ai", () => ({
  AssistantError: class AssistantError extends Error {},
  createAssistantProvider: vi.fn(),
  getAssistantConfig: () => ({ enabled: true, kind: "mock", model: "mock" }),
}));

describe("AssistantPanel collapse control", () => {
  it("shows a visible Contents label for the integrated reader inspector", () => {
    const html = renderToStaticMarkup(
      <AssistantPanel collapseMode="contents" onCollapse={() => undefined} />
    );

    expect(html).toContain('aria-label="Back to contents"');
    expect(html).toContain('class="assistant-panel-collapse is-contents"');
    expect(html).toContain('<span class="assistant-panel-collapse-label">Contents</span>');
  });

  it("keeps the regular companion close action icon-only", () => {
    const html = renderToStaticMarkup(<AssistantPanel onCollapse={() => undefined} />);

    expect(html).toContain('aria-label="Collapse chat"');
    expect(html).not.toContain("assistant-panel-collapse-label");
  });

  it("labels the mock provider as a demo preview", () => {
    const html = renderToStaticMarkup(<AssistantPanel />);

    expect(html).toContain('aria-label="Demo provider, Preview"');
    expect(html).toContain('class="assistant-panel-provider"');
    expect(html).toContain(">Demo provider · Preview</span>");
  });

  it("does not expose document tools or the composer on a directory page", () => {
    const html = renderToStaticMarkup(<AssistantPanel />);

    expect(html).toContain("Open a document to use Companion");
    expect(html).toContain("Choose a document");
    expect(html).toContain("Ask across the library");
    expect(html).not.toContain("Outline this document");
    expect(html).not.toContain('aria-label="Your question"');
  });

  it("keeps all document actions and the composer when a document is open", () => {
    const html = renderToStaticMarkup(
      <AssistantPanel doc={{ href: "/read/demo", slug: ["demo"], title: "Verto Feature Demo" }} />
    );

    expect(html).toContain("Work from this document");
    expect(html).toContain("Outline this document");
    expect(html).toContain("Review my notes");
    expect(html).toContain("Prepare a saved summary");
    expect(html).toContain('aria-label="Your question"');
    expect(html).not.toContain("Choose a document");
  });
});
