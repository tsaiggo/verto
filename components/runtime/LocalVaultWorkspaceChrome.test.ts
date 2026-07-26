import { describe, expect, it } from "vitest";

import { formatInspectorDate } from "./LocalVaultWorkspaceChrome";

describe("formatInspectorDate", () => {
  it("formats metadata identically across server and browser locales", () => {
    expect(formatInspectorDate("2026-07-24T23:30:00.000Z")).toBe("Jul 24");
  });

  it("does not invent a recent save date for invalid metadata", () => {
    expect(formatInspectorDate("not-a-date")).toBe("Unknown date");
  });
});
