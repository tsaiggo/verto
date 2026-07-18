import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const getConnectionDetailsMock = vi.hoisted(() => vi.fn());
const listAllFilesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/connection-info", () => ({
  getConnectionDetails: getConnectionDetailsMock,
}));

vi.mock("@/lib/content-source", () => ({
  listAllFiles: listAllFilesMock,
}));

import IntegrationsPage from "./page";
import SourcesOverview, { type SourceRow } from "@/components/integrations/SourcesOverview";

async function renderedSources(): Promise<SourceRow[]> {
  const result = (await IntegrationsPage()) as ReactElement<{ sources: SourceRow[] }>;
  expect(result.type).toBe(SourcesOverview);
  return result.props.sources;
}

describe("IntegrationsPage source status", () => {
  beforeEach(() => {
    getConnectionDetailsMock.mockReset();
    listAllFilesMock.mockReset();
    getConnectionDetailsMock.mockReturnValue({
      connected: true,
      kind: "local",
      name: "Included demo",
      path: "/content",
    });
  });

  it("reports a configured local source as synced only after it can be read", async () => {
    listAllFilesMock.mockResolvedValue([{ hidden: false }, { hidden: true }, { hidden: false }]);

    const local = (await renderedSources()).find((source) => source.kind === "local");

    expect(local).toMatchObject({
      status: "synced",
      lastSync: "Just now",
      items: 2,
      error: null,
    });
  });

  it("fails closed when the configured source cannot be listed", async () => {
    listAllFilesMock.mockRejectedValue(new Error("Repository access denied"));

    const local = (await renderedSources()).find((source) => source.kind === "local");

    expect(local).toMatchObject({
      status: "disconnected",
      lastSync: "Check failed",
      items: 0,
      error: "Repository access denied",
    });
  });
});
