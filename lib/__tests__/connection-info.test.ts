import { describe, it, expect } from "vitest";
import { buildConnectionDetails, DEFAULT_FILE_FILTER } from "@/lib/connection-info";
import type { SourceInfo } from "@/lib/source-info";

const githubSource: SourceInfo = {
  kind: "github",
  name: "GitHub Repo",
  label: "tsaiggo/verto@main",
  repo: "tsaiggo/verto",
  branch: "main",
  url: "https://github.com/tsaiggo/verto/tree/main/docs",
};

describe("buildConnectionDetails", () => {
  it("derives GitHub connection details and normalises the content path", () => {
    const details = buildConnectionDetails(githubSource, {
      VERTO_GITHUB_PATH: "docs",
    });
    expect(details.kind).toBe("github");
    expect(details.repo).toBe("tsaiggo/verto");
    expect(details.branch).toBe("main");
    expect(details.path).toBe("/docs");
    expect(details.filter).toBe(DEFAULT_FILE_FILTER);
    expect(details.previewMode).toBe("Remote preview");
    expect(details.remote).toBe(true);
    expect(details.connected).toBe(true);
    expect(details.url).toBe(githubSource.url);
  });

  it('defaults the path to "/" when no sub-path is configured', () => {
    const details = buildConnectionDetails(githubSource, {});
    expect(details.path).toBe("/");
  });

  it("marks an unconfigured GitHub source as not connected", () => {
    const details = buildConnectionDetails({
      kind: "github",
      name: "GitHub Repo",
      label: "GitHub (not configured)",
    });
    expect(details.connected).toBe(false);
    expect(details.repo).toBeUndefined();
  });

  it("treats a OneDrive share URL as a connected remote source", () => {
    const details = buildConnectionDetails(
      { kind: "onedrive", name: "OneDrive", label: "OneDrive · content" },
      { VERTO_ONEDRIVE_SHARE_URL: "https://1drv.ms/u/s!abc", VERTO_ONEDRIVE_PATH: "content" }
    );
    expect(details.kind).toBe("onedrive");
    expect(details.path).toBe("/content");
    expect(details.remote).toBe(true);
    expect(details.connected).toBe(true);
  });

  it("describes a local source as a non-remote, connected preview", () => {
    const details = buildConnectionDetails(
      { kind: "local", name: "Local Files", label: "Local content" },
      {}
    );
    expect(details.kind).toBe("local");
    expect(details.remote).toBe(false);
    expect(details.connected).toBe(true);
    expect(details.previewMode).toBe("Local preview");
    expect(details.path).toBe("/content");
  });

  it("reflects a custom VERTO_LOCAL_DIR folder in the local source path", () => {
    const details = buildConnectionDetails(
      { kind: "local", name: "Local Files", label: "Local · vault" },
      { VERTO_LOCAL_DIR: "vault" }
    );
    expect(details.kind).toBe("local");
    expect(details.remote).toBe(false);
    expect(details.connected).toBe(true);
    expect(details.path).toBe("/vault");
  });
});
