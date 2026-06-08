import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import { listLocalFolder, readLocalFile } from "@/lib/tauri";

describe("local folder runtime loader", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists markdown files through the desktop shell", async () => {
    invokeMock.mockResolvedValue([
      {
        path: ["docs", "intro.md"],
        id: "/Users/me/Notes/docs/intro.md",
        size: 42,
        mtime: 1_717_000_000_000,
      },
    ]);

    await expect(listLocalFolder("/Users/me/Notes")).resolves.toEqual([
      {
        path: ["docs", "intro.md"],
        id: "/Users/me/Notes/docs/intro.md",
        size: 42,
        mtime: 1_717_000_000_000,
      },
    ]);
    expect(invokeMock).toHaveBeenCalledWith("list_local_dir", {
      folder: "/Users/me/Notes",
    });
  });

  it("reads markdown file text through the desktop shell", async () => {
    invokeMock.mockResolvedValue("# Runtime README");

    await expect(readLocalFile("/Users/me/Notes/README.md")).resolves.toBe(
      "# Runtime README",
    );
    expect(invokeMock).toHaveBeenCalledWith("read_local_file", {
      id: "/Users/me/Notes/README.md",
    });
  });
});
