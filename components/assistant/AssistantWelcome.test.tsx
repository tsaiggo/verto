import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantWelcome } from "@/components/assistant/AssistantWelcome";

describe("AssistantWelcome", () => {
  it("starts from Verto's document tools instead of a generic chat prompt", () => {
    const html = renderToStaticMarkup(
      <AssistantWelcome
        onPick={() => undefined}
        busy={false}
        contextNote="Full document"
        documentOpen
      />
    );

    expect(html).toContain("Work from this document");
    expect(html).toContain("Outline this document");
    expect(html).toContain("Review my notes");
    expect(html).toContain("Prepare a saved summary");
    expect(html).not.toContain("What can I help you with?");
  });

  it("replaces document-only actions with honest workspace navigation when no document is open", () => {
    const html = renderToStaticMarkup(
      <AssistantWelcome onPick={() => undefined} busy={false} documentOpen={false} />
    );

    expect(html).toContain("Open a document to use Companion");
    expect(html).toContain('href="/library"');
    expect(html).toContain("Choose a document");
    expect(html).toContain('href="/agent"');
    expect(html).toContain("Ask across the library");
    expect(html).not.toContain("Outline this document");
    expect(html).not.toContain("Review my notes");
    expect(html).not.toContain("Prepare a saved summary");
  });
});
