import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const contentSourceMocks = vi.hoisted(() => ({
  listAllFiles: vi.fn(),
  readFileNodeSource: vi.fn(),
}));

vi.mock("@/lib/content-source", () => contentSourceMocks);
vi.mock("@/lib/ai/index", () => ({
  getAssistantConfig: () => ({ kind: "mock", model: "mock" }),
}));

import AgentPage from "./page";
import AgentWorkspace from "@/components/agent/AgentWorkspace";

describe("AgentPage source recovery", () => {
  beforeEach(() => {
    contentSourceMocks.listAllFiles.mockReset();
    contentSourceMocks.readFileNodeSource.mockReset();
  });

  it("keeps the Agent workspace renderable when the build source cannot be listed", async () => {
    contentSourceMocks.listAllFiles.mockRejectedValue(new Error("Repository access denied"));

    const result = (await AgentPage()) as ReactElement<{
      sources: unknown[];
      availableSourceCount: number;
      sourceError: string | null;
    }>;

    expect(result.type).toBe(AgentWorkspace);
    expect(result.props).toMatchObject({
      sources: [],
      availableSourceCount: 0,
      sourceError: "Repository access denied",
    });
  });
});
