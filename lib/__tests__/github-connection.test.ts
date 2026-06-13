import { describe, it, expect, afterEach, vi } from "vitest";

import { createGitHubSourceFromConnection } from "@/lib/content-source/github";

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

function installFakeFetch(files: FakeFile[]) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (/\/git\/trees\/[^?]+\?recursive=1$/.test(u)) {
      return new Response(
        JSON.stringify({
          sha: "head",
          url: u,
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
    const blob = u.match(/\/git\/blobs\/([^?]+)$/);
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
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGitHubSourceFromConnection", () => {
  it("lists only readable files under the connection path", async () => {
    installFakeFetch(fakeFiles());
    const source = createGitHubSourceFromConnection({
      repo: "octo/repo",
      branch: "main",
      path: "/docs",
      token: "tok",
    });

    const files = await source.listFiles();
    const slugs = files.map((f) => f.path.join("/")).sort();
    // cover.png is ignored; files outside /docs are excluded; prefix stripped.
    expect(slugs).toEqual(["guide/setup.mdx", "intro.md"]);
  });

  it("reads a file's raw contents by sha", async () => {
    installFakeFetch(fakeFiles());
    const source = createGitHubSourceFromConnection({
      repo: "octo/repo",
      branch: "main",
      path: "docs",
    });
    const files = await source.listFiles();
    const intro = files.find((f) => f.path.join("/") === "intro.md")!;
    const text = await source.readFile(intro);
    expect(text).toBe("# Intro");
  });

  it("uses an injected fetch implementation for desktop runtime requests", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            sha: "head",
            url: "https://api.github.com/repos/octo/repo/git/trees/main?recursive=1",
            tree: [],
            truncated: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("wrong fetch", { status: 500 }))
    );

    const source = createGitHubSourceFromConnection(
      {
        repo: "octo/repo",
        branch: "main",
        path: "",
        token: "tok",
      },
      { fetchImpl }
    );

    await expect(source.listFiles()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects an invalid repo string", () => {
    expect(() =>
      createGitHubSourceFromConnection({
        repo: "not-a-repo",
        branch: "main",
        path: "",
      })
    ).toThrow(/owner\/repo/);
  });
});
