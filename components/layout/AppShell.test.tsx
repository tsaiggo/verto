import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { ContentDirNode } from "@/lib/content-source";
import type { SourceInfo } from "@/lib/source-info";

const contentMocks = vi.hoisted(() => ({
  getContentTree: vi.fn(),
  listAllFiles: vi.fn(),
}));
const getSourceInfoMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content-source", () => contentMocks);
vi.mock("@/lib/source-info", () => ({
  getSourceInfo: getSourceInfoMock,
}));
vi.mock("@/components/layout/AppShellClient", () => ({
  default: "app-shell-client",
}));

import AppShell from "./AppShell";
import AppShellClient from "./AppShellClient";

interface ShellProps {
  root?: ContentDirNode;
  source: SourceInfo;
  fileCount: number;
  children: ReactNode;
}

const root: ContentDirNode = {
  type: "dir",
  slug: [],
  href: "/read/",
  title: "Home",
  children: [],
};

describe("AppShell content-source recovery", () => {
  beforeEach(() => {
    contentMocks.getContentTree.mockReset();
    contentMocks.listAllFiles.mockReset();
    getSourceInfoMock.mockReset();
    getSourceInfoMock.mockReturnValue({
      kind: "onedrive",
      name: "OneDrive",
      label: "OneDrive · /Knowledge",
    });
  });

  it("passes a ready tree and file count to the client shell", async () => {
    contentMocks.getContentTree.mockResolvedValue(root);
    contentMocks.listAllFiles.mockResolvedValue([{ id: "one" }, { id: "two" }]);

    const result = (await AppShell({ children: "Page" })) as ReactElement<ShellProps>;

    expect(result.type).toBe(AppShellClient);
    expect(result.props).toMatchObject({
      root,
      fileCount: 2,
      source: {
        readiness: { status: "ready" },
      },
    });
  });

  it("keeps the application shell renderable when the configured source fails", async () => {
    contentMocks.getContentTree.mockRejectedValue(new Error("Repository access denied"));
    contentMocks.listAllFiles.mockResolvedValue([]);

    const result = (await AppShell({ children: "Recovery page" })) as ReactElement<ShellProps>;

    expect(result.type).toBe(AppShellClient);
    expect(result.props.root).toBeUndefined();
    expect(result.props.fileCount).toBe(0);
    expect(result.props.children).toBe("Recovery page");
    expect(result.props.source.readiness).toEqual({
      status: "error",
      error: "Repository access denied",
    });
  });
});
