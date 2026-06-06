import { describe, it, expect } from "vitest";

import { buildSummaryMessages } from "@/lib/ai/context";

describe("buildSummaryMessages", () => {
  it("returns exactly a system message followed by a user message", () => {
    const messages = buildSummaryMessages({});

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("includes the fixed Markdown section headings in the system prompt", () => {
    const [system] = buildSummaryMessages({});

    expect(system.content).toContain("## TL;DR");
    expect(system.content).toContain("## Key points");
    expect(system.content).toContain("## Notable details");
  });

  it("embeds the document title and body when provided", () => {
    const [system] = buildSummaryMessages({
      title: "Getting Started",
      body: "Verto turns a folder of MDX into a navigable site.",
    });

    expect(system.content).toContain("--- CURRENT DOCUMENT ---");
    expect(system.content).toContain("Title: Getting Started");
    expect(system.content).toContain(
      "Verto turns a folder of MDX into a navigable site.",
    );
  });

  it("omits the document block when no context is available", () => {
    const [system] = buildSummaryMessages({});

    expect(system.content).not.toContain("--- CURRENT DOCUMENT ---");
  });

  it("asks the model to summarize the current document", () => {
    const messages = buildSummaryMessages({});

    expect(messages[1].content).toBe(
      "Summarize the current document as instructed.",
    );
  });
});
