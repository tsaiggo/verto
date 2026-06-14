import { afterEach, describe, expect, it, vi } from "vitest";

import { createRuntimeSource } from "@/lib/content-source/runtime-source";
import type { FetchLike } from "@/lib/tauri";

interface FakeFile {
  path: string;
  sha: string;
  text: string;
}

function fakeFiles(): FakeFile[] {
  return [
    { path: "docs/intro.md", sha: "sha-intro", text: "# Intro" },
    { path: "docs/guide/setup.mdx", sha: "sha-setup", text: "# Setup" },
    { path: "docs/cover.png", sha: "sha-cover", text: "binary" },
    { path: "other/skip.md", sha: "sha-skip", text: "ignored" },
  ];
}

function fakeGitHubFetch(files: FakeFile[]): FetchLike {
  return async (url) => {
    if (/\/git\/trees\/[^?]+\?recursive=1$/.test(url)) {
      return new Response(
        JSON.stringify({
          sha: "head",
          url,
          tree: files.map((f) => ({
            path: f.path,
            mode: "100644",
            type: "blob",
            sha: f.sha,
            size: f.text.length,
          })),
          truncated: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const blob = url.match(/\/git\/blobs\/([^?]+)$/);
    if (blob) {
      const file = files.find((f) => f.sha === blob[1]);
      if (!file) return new Response("not found", { status: 404 });
      return new Response(
        JSON.stringify({
          content: Buffer.from(file.text, "utf-8").toString("base64"),
          encoding: "base64",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("unhandled", { status: 500 });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRuntimeSource (github)", () => {
  it("builds a github ContentSource from a saved connection", () => {
    const source = createRuntimeSource({
      kind: "github",
      connection: { repo: "octo/repo", branch: "main", path: "docs" },
      fetchImpl: fakeGitHubFetch(fakeFiles()),
    });
    expect(source.id).toBe("github");
  });

  it("lists only readable files under the connection path", async () => {
    const source = createRuntimeSource({
      kind: "github",
      connection: { repo: "octo/repo", branch: "main", path: "/docs", token: "tok" },
      fetchImpl: fakeGitHubFetch(fakeFiles()),
    });
    const files = await source.listFiles();
    const slugs = files.map((f) => f.path.join("/")).sort();
    expect(slugs).toEqual(["guide/setup.mdx", "intro.md"]);
  });

  it("reads a file's raw contents by sha", async () => {
    const source = createRuntimeSource({
      kind: "github",
      connection: { repo: "octo/repo", branch: "main", path: "docs" },
      fetchImpl: fakeGitHubFetch(fakeFiles()),
    });
    const files = await source.listFiles();
    const intro = files.find((f) => f.path.join("/") === "intro.md")!;
    expect(await source.readFile(intro)).toBe("# Intro");
  });

  it("routes through the injected fetch, never global fetch", async () => {
    const fetchImpl = vi.fn(fakeGitHubFetch(fakeFiles()));
    const globalFetch = vi.fn(
      async () => new Response("global fetch must not be used", { status: 500 })
    );
    vi.stubGlobal("fetch", globalFetch);

    const source = createRuntimeSource({
      kind: "github",
      connection: { repo: "octo/repo", branch: "main", path: "docs" },
      fetchImpl,
    });
    const files = await source.listFiles();

    expect(files.map((f) => f.path.join("/")).sort()).toEqual(["guide/setup.mdx", "intro.md"]);
    expect(fetchImpl).toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid repo connection", () => {
    expect(() =>
      createRuntimeSource({
        kind: "github",
        connection: { repo: "not-a-repo", branch: "main", path: "" },
      })
    ).toThrow(/owner\/repo/);
  });
});
