import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantWelcome } from "@/components/assistant/AssistantWelcome";

describe("AssistantWelcome", () => {
  it("starts from Verto's document tools instead of a generic chat prompt", () => {
    const html = renderToStaticMarkup(
      <AssistantWelcome onPick={() => undefined} busy={false} contextNote="Full document" />
    );

    expect(html).toContain("Work from this document");
    expect(html).toContain("Outline this document");
    expect(html).toContain("Review my notes");
    expect(html).toContain("Prepare a saved summary");
    expect(html).not.toContain("What can I help you with?");
  });
});
