import { afterEach, describe, expect, it, vi } from "vitest";

import { getSourceInfo } from "@/lib/source-info";

describe("getSourceInfo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to Local Library when no content source is configured", () => {
    vi.stubEnv("VERTO_CONTENT_SOURCE", undefined);
    vi.stubEnv("VERTO_LOCAL_DIR", undefined);

    expect(getSourceInfo()).toMatchObject({
      kind: "local",
      name: "Local Library",
      label: "Local library",
    });
  });

  it("keeps explicit local content under Local Library", () => {
    vi.stubEnv("VERTO_CONTENT_SOURCE", "local");
    vi.stubEnv("VERTO_LOCAL_DIR", "vault");

    expect(getSourceInfo()).toMatchObject({
      kind: "local",
      name: "Local Library",
      label: "Folder · vault",
    });
  });

  it("treats a configured local directory as Local Library even without an explicit source kind", () => {
    vi.stubEnv("VERTO_CONTENT_SOURCE", undefined);
    vi.stubEnv("VERTO_LOCAL_DIR", "vault");

    expect(getSourceInfo()).toMatchObject({
      kind: "local",
      name: "Local Library",
      label: "Folder · vault",
    });
  });
});
