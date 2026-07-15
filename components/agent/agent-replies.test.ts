import { describe, expect, it } from "vitest";

import { workspaceInstructions } from "@/components/agent/agent-replies";
import type { AgentSource } from "@/components/agent/agent-types";

function source(index: number): AgentSource {
  return {
    title: `Document ${index}`,
    subtitle: "Workspace",
    href: `/read/${index}`,
    body: `Body ${index}`,
  };
}

describe("workspaceInstructions", () => {
  it("discloses sources that are known but not attached", () => {
    const prompt = workspaceInstructions([source(1), source(2)], 7);

    expect(prompt).toContain("2 attached readable sources");
    expect(prompt).toContain("5 additional workspace documents are not attached");
    expect(prompt).toContain("cannot be searched or cited");
  });

  it("discloses when the inline catalog omits attached sources", () => {
    const sources = Array.from({ length: 52 }, (_, index) => source(index + 1));
    const prompt = workspaceInstructions(sources, sources.length);

    expect(prompt).toContain("first 48; use the workspace tools to discover the rest");
    expect(prompt).toContain("Document 48");
    expect(prompt).not.toContain("Document 49:");
  });
});
