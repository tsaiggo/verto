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
});
