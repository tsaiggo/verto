import { afterEach, describe, expect, it, vi } from "vitest";

import { getSourceInfo } from "@/lib/source-info";

describe("getSourceInfo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("describes bundled content as Docs when no content source is configured", () => {
    vi.stubEnv("VERTO_CONTENT_SOURCE", undefined);
    vi.stubEnv("VERTO_LOCAL_DIR", undefined);

    expect(getSourceInfo()).toMatchObject({
      kind: "docs",
      name: "Docs",
      label: "Bundled documentation",
    });
  });

  it("keeps explicit local content under Local Files", () => {
    vi.stubEnv("VERTO_CONTENT_SOURCE", "local");
    vi.stubEnv("VERTO_LOCAL_DIR", "vault");

    expect(getSourceInfo()).toMatchObject({
      kind: "local",
      name: "Local Files",
      label: "Local · vault",
    });
  });

  it("treats a configured local directory as Local Files even without an explicit source kind", () => {
    vi.stubEnv("VERTO_CONTENT_SOURCE", undefined);
    vi.stubEnv("VERTO_LOCAL_DIR", "vault");

    expect(getSourceInfo()).toMatchObject({
      kind: "local",
      name: "Local Files",
      label: "Local · vault",
    });
  });
});
