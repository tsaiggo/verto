import { describe, it, expect } from "vitest";
import { buildConnectedSources, buildLibraryOverview, countConnected } from "@/lib/home";
import type { ConnectionDetails } from "@/lib/connection-info";
import type { ContentFileNode } from "@/lib/content-source/types";

const githubConnection: ConnectionDetails = {
  kind: "github",
  name: "GitHub Repo",
  repo: "verto/docs",
  branch: "main",
  path: "/docs",
  filter: "**/*.{mdx,md}",
  previewMode: "Remote preview",
  remote: true,
  connected: true,
  url: "https://github.com/verto/docs/tree/main/docs",
};

const onedriveConnection: ConnectionDetails = {
  kind: "onedrive",
  name: "OneDrive",
  path: "/Documentation",
  filter: "**/*.{mdx,md}",
  previewMode: "Remote preview",
  remote: true,
  connected: true,
};

const localConnection: ConnectionDetails = {
  kind: "local",
  name: "Local Files",
  path: "/content",
  filter: "**/*.{mdx,md}",
  previewMode: "Local preview",
  remote: false,
  connected: true,
};

describe("buildConnectedSources", () => {
  it("always returns the three provider cards in order", () => {
    const sources = buildConnectedSources(localConnection);
    expect(sources.map((s) => s.kind)).toEqual(["github", "onedrive", "googledrive"]);
  });

  it("marks the active GitHub source connected with real details", () => {
    const sources = buildConnectedSources(githubConnection);
    const github = sources.find((s) => s.kind === "github")!;
    expect(github.connected).toBe(true);
    expect(github.primary).toBe("verto/docs");
    expect(github.branch).toBe("main");
    expect(github.path).toBe("/docs");
    expect(github.url).toBe(githubConnection.url);
    // Other providers stay disconnected.
    expect(sources.find((s) => s.kind === "onedrive")!.connected).toBe(false);
    expect(sources.find((s) => s.kind === "googledrive")!.connected).toBe(false);
  });

  it("marks the active OneDrive source connected with its folder path", () => {
    const sources = buildConnectedSources(onedriveConnection);
    const onedrive = sources.find((s) => s.kind === "onedrive")!;
    expect(onedrive.connected).toBe(true);
    expect(onedrive.primary).toBe("OneDrive");
    expect(onedrive.path).toBe("/Documentation");
    expect(onedrive.branch).toBeUndefined();
  });

  it("connects no cloud provider when the active source is local", () => {
    const sources = buildConnectedSources(localConnection);
    expect(countConnected(sources)).toBe(0);
    expect(sources.every((s) => !s.connected)).toBe(true);
  });

  it("never connects Google Drive (presentational only)", () => {
    const googleAsActive = {
      ...githubConnection,
      kind: "googledrive" as unknown as ConnectionDetails["kind"],
    };
    const sources = buildConnectedSources(googleAsActive);
    expect(sources.find((s) => s.kind === "googledrive")!.connected).toBe(false);
  });

  it("flags only Google Drive as coming soon", () => {
    const sources = buildConnectedSources(githubConnection);
    expect(sources.find((s) => s.kind === "googledrive")!.comingSoon).toBe(true);
    expect(sources.find((s) => s.kind === "github")!.comingSoon).toBe(false);
    expect(sources.find((s) => s.kind === "onedrive")!.comingSoon).toBe(false);
  });

  it("falls back to placeholders for an unconfigured GitHub source", () => {
    const sources = buildConnectedSources({
      ...githubConnection,
      repo: undefined,
      branch: undefined,
      url: undefined,
    });
    const github = sources.find((s) => s.kind === "github")!;
    expect(github.primary).toBe("owner/repo");
    expect(github.branch).toBe("main");
  });
});

describe("countConnected", () => {
  it("counts only connected providers", () => {
    expect(countConnected(buildConnectedSources(githubConnection))).toBe(1);
    expect(countConnected(buildConnectedSources(localConnection))).toBe(0);
  });
});

function file(overrides: Partial<ContentFileNode>): ContentFileNode {
  const slug = overrides.slug ?? [overrides.title?.toLowerCase() ?? "doc"];
  return {
    type: "file",
    slug,
    href: `/read/${slug.join("/")}`,
    title: overrides.title ?? "Doc",
    mtime: 0,
    id: slug.join("/") + ".mdx",
    ext: ".mdx",
    ...overrides,
  };
}

describe("buildLibraryOverview", () => {
  it("summarizes documents, tags, statuses, and top collections", () => {
    const overview = buildLibraryOverview([
      file({ title: "One", tags: ["writing", "ideas"], status: "draft" }),
      file({ title: "Two", tags: ["writing"], status: "published" }),
      file({ title: "Three", status: "draft" }),
    ]);

    expect(overview.totalDocuments).toBe(3);
    expect(overview.taggedDocuments).toBe(2);
    expect(overview.tagCount).toBe(2);
    expect(overview.statusCount).toBe(2);
    expect(overview.collections).toEqual([
      { kind: "tag", label: "writing", count: 2, href: "/read/tags/writing" },
      { kind: "tag", label: "ideas", count: 1, href: "/read/tags/ideas" },
      { kind: "status", label: "draft", count: 2, href: undefined },
      { kind: "status", label: "published", count: 1, href: undefined },
    ]);
  });

  it("ignores blank labels and respects collection limits", () => {
    const overview = buildLibraryOverview(
      [
        file({ title: "One", tags: ["", " b "], status: " " }),
        file({ title: "Two", tags: ["a"], status: "todo" }),
      ],
      1
    );

    expect(overview.tagCount).toBe(2);
    expect(overview.statusCount).toBe(1);
    expect(overview.collections).toEqual([
      { kind: "tag", label: "a", count: 1, href: "/read/tags/a" },
    ]);
  });
});
