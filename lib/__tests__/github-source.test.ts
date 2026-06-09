import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  createGitHubSource,
  createGitHubSourceFromConnection,
} from "@/lib/content-source/github";
import { createTreeAPI } from "@/lib/content-source/tree";

// ---------------------------------------------------------------------------
// Helpers — a tiny in-memory fixture mirroring the shape of the GitHub API.
// ---------------------------------------------------------------------------

interface FakeFile {
  path: string;
  sha: string;
  text: string;
}

function fakeFiles(): FakeFile[] {
  return [
    {
      path: "content/intro.md",
      sha: "sha-intro",
      text: "---\ntitle: Intro\norder: 1\n---\n# Intro\n\nWelcome.",
    },
    {
      path: "content/docs/_index.md",
      sha: "sha-docs-index",
      text: "---\ntitle: Docs\n---\nDocs landing.",
    },
    {
      path: "content/docs/quickstart.mdx",
      sha: "sha-quickstart",
      text: "---\ntitle: Quick Start\norder: 1\n---\n\nGo fast.",
    },
    {
      path: "content/docs/advanced/tricks.md",
      sha: "sha-tricks",
      text: "# Tricks\n\nDeep magic.",
    },
    // Should be ignored (not a readable extension)
    {
      path: "content/assets/cover.png",
      sha: "sha-cover",
      text: "binary-noise",
    },
    // navigation.json — read via readOptionalFile
    {
      path: "content/navigation.json",
      sha: "sha-nav",
      text: JSON.stringify({
        overrides: { docs: { title: "Documentation" } },
      }),
    },
    // Outside the configured prefix — must be ignored entirely.
    {
      path: "other/readme.md",
      sha: "sha-other",
      text: "ignored",
    },
  ];
}

function installFakeFetch(files: FakeFile[]) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    calls.push(u);

    // Git Trees endpoint
    const treeMatch = u.match(
      /\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^?]+)\?recursive=1$/,
    );
    if (treeMatch) {
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
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Blob endpoint
    const blobMatch = u.match(
      /\/repos\/([^/]+)\/([^/]+)\/git\/blobs\/([^?]+)$/,
    );
    if (blobMatch) {
      const sha = blobMatch[3];
      const file = files.find((f) => f.sha === sha);
      if (!file) {
        return new Response("not found", { status: 404 });
      }
      return new Response(
        JSON.stringify({
          content: Buffer.from(file.text, "utf-8").toString("base64"),
          encoding: "base64",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("unhandled", { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

// ---------------------------------------------------------------------------
// Environment helpers — each test sets the GitHub env then constructs the
// source fresh so module state doesn't leak across tests.
// ---------------------------------------------------------------------------

const ENV_KEYS = [
  "VERTO_GITHUB_REPO",
  "VERTO_GITHUB_BRANCH",
  "VERTO_GITHUB_PATH",
  "VERTO_GITHUB_TOKEN",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("github content source", () => {
  it("requires VERTO_GITHUB_REPO", () => {
    expect(() => createGitHubSource()).toThrow(/VERTO_GITHUB_REPO/);
  });

  it("rejects invalid repo format", () => {
    process.env.VERTO_GITHUB_REPO = "not-a-repo";
    expect(() => createGitHubSource()).toThrow(/owner\/repo/);
  });

  it("lists readable files under the configured prefix only", async () => {
    process.env.VERTO_GITHUB_REPO = "octocat/demo";
    process.env.VERTO_GITHUB_PATH = "content";
    const { calls } = installFakeFetch(fakeFiles());

    const source = createGitHubSource();
    const files = await source.listFiles();

    const paths = files.map((f) => f.path.join("/")).sort();
    expect(paths).toEqual([
      "docs/_index.md",
      "docs/advanced/tricks.md",
      "docs/quickstart.mdx",
      "intro.md",
    ]);
    // Each entry carries the blob sha as its opaque id.
    expect(files.every((f) => typeof f.id === "string" && f.id.length > 0))
      .toBe(true);
    // Only one trees request should have been made.
    expect(calls.filter((u) => u.includes("/git/trees/")).length).toBe(1);
  });

  it("decodes base64 blobs on readFile", async () => {
    process.env.VERTO_GITHUB_REPO = "octocat/demo";
    process.env.VERTO_GITHUB_PATH = "content";
    installFakeFetch(fakeFiles());

    const source = createGitHubSource();
    const text = await source.readFile({ id: "sha-quickstart", path: [] });
    expect(text).toContain("Quick Start");
    expect(text).toContain("Go fast.");
  });

  it("reads navigation.json via readOptionalFile and integrates with the tree builder", async () => {
    process.env.VERTO_GITHUB_REPO = "octocat/demo";
    process.env.VERTO_GITHUB_PATH = "content";
    installFakeFetch(fakeFiles());

    const source = createGitHubSource();
    const api = createTreeAPI(() => source);
    const root = await api.getContentTree();

    const docs = root.children.find(
      (c) => c.slug.join("/") === "docs",
    );
    expect(docs).toBeDefined();
    // navigation.json override renames "docs" → "Documentation"
    expect(docs!.title).toBe("Documentation");

    // Intro file is at the root, with explicit order 1
    const intro = root.children.find((c) => c.slug.join("/") === "intro");
    expect(intro?.type).toBe("file");
    expect(intro?.title).toBe("Intro");

    // Nested directory is discovered even without an index file
    const advanced = (docs as { children: { slug: string[] }[] }).children.find(
      (c) => c.slug.join("/") === "docs/advanced",
    );
    expect(advanced).toBeDefined();
  });

  it("returns null from readOptionalFile when the file is absent", async () => {
    process.env.VERTO_GITHUB_REPO = "octocat/demo";
    process.env.VERTO_GITHUB_PATH = "content";
    installFakeFetch(fakeFiles());

    const source = createGitHubSource();
    const result = await source.readOptionalFile!(["missing.json"]);
    expect(result).toBeNull();
  });

  it("surfaces a helpful error for 404 responses (bad repo/branch/path)", async () => {
    process.env.VERTO_GITHUB_REPO = "octocat/nope";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );

    const source = createGitHubSource();
    await expect(source.listFiles()).rejects.toThrow(/404/);
    await expect(source.listFiles()).rejects.toThrow(/VERTO_GITHUB_REPO/);
  });

  it("surfaces a helpful error for rate-limit responses", async () => {
    process.env.VERTO_GITHUB_REPO = "octocat/demo";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("rate limited", {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 60),
            },
          }),
      ),
    );

    const source = createGitHubSource();
    await expect(source.listFiles()).rejects.toThrow(/rate limit/);
    await expect(source.listFiles()).rejects.toThrow(/VERTO_GITHUB_TOKEN/);
  });

  it("sends Authorization header when VERTO_GITHUB_TOKEN is set", async () => {
    process.env.VERTO_GITHUB_REPO = "octocat/demo";
    process.env.VERTO_GITHUB_TOKEN = "ghp_secret";
    const captured: HeadersInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured.push(init?.headers ?? {});
        return new Response(
          JSON.stringify({ sha: "x", url: "", tree: [], truncated: false }),
          { status: 200 },
        );
      }),
    );

    const source = createGitHubSource();
    await source.listFiles();
    const headers = captured[0] as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_secret");
  });

  it("reads blobs from a saved desktop connection", async () => {
    const { calls } = installFakeFetch(fakeFiles());

    const source = createGitHubSourceFromConnection(
      {
        repo: "octocat/demo",
        branch: "main",
        path: "content",
        token: "ghp_desktop",
      },
      { fetchImpl: fetch as typeof globalThis.fetch },
    );

    const text = await source.readFile({ id: "sha-intro", path: [] });

    expect(text).toContain("# Intro");
    expect(calls.some((url) => url.includes("/git/blobs/sha-intro"))).toBe(true);
  });

  it("escapes blob ids before building GitHub blob URLs", async () => {
    const { calls } = installFakeFetch([]);
    const source = createGitHubSourceFromConnection(
      {
        repo: "octocat/demo",
        branch: "main",
        path: "content",
        token: "ghp_desktop",
      },
      { fetchImpl: fetch as typeof globalThis.fetch },
    );

    await expect(
      source.readFile({ id: "sha/../trees/main", path: [] }),
    ).rejects.toThrow(/404/);

    expect(calls[0]).toContain("/git/blobs/sha%2F..%2Ftrees%2Fmain");
  });
});
