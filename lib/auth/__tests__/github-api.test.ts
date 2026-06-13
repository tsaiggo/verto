import { describe, it, expect, vi } from "vitest";

import { fetchUser, listBranches, listRepos, validateContentPath } from "@/lib/auth/github-api";
import type { FetchLike } from "@/lib/tauri";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fetch that dispatches by URL substring. */
function routedFetch(routes: Array<[RegExp, (url: string) => Response]>): {
  fetchImpl: FetchLike;
  calls: string[];
  headers: HeadersInit[];
} {
  const calls: string[] = [];
  const headers: HeadersInit[] = [];
  const fetchImpl: FetchLike = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (init?.headers) headers.push(init.headers);
    for (const [re, handler] of routes) {
      if (re.test(url)) return handler(url);
    }
    return new Response("unhandled", { status: 500 });
  });
  return { fetchImpl, calls, headers };
}

describe("fetchUser", () => {
  it("returns the user's login, name and avatar", async () => {
    const { fetchImpl, headers } = routedFetch([
      [
        /\/user$/,
        () =>
          jsonResponse({
            login: "octocat",
            name: "The Octocat",
            avatar_url: "https://example.com/a.png",
          }),
      ],
    ]);

    const user = await fetchUser("tok", fetchImpl);
    expect(user).toEqual({
      login: "octocat",
      name: "The Octocat",
      avatarUrl: "https://example.com/a.png",
    });
    // Token is sent as a ******
    expect((headers[0] as Record<string, string>).Authorization).toBe("Bearer " + "tok");
  });

  it("throws on a non-OK response", async () => {
    const { fetchImpl } = routedFetch([
      [/\/user$/, () => new Response("bad", { status: 401, statusText: "Unauthorized" })],
    ]);
    await expect(fetchUser("tok", fetchImpl)).rejects.toThrow(/401/);
  });
});

describe("listRepos", () => {
  it("flattens paginated results and stops on a short page", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      full_name: `octo/repo-${i}`,
      default_branch: "main",
      private: i % 2 === 0,
    }));
    const page2 = [{ full_name: "octo/last", default_branch: "dev", private: false }];
    const { fetchImpl, calls } = routedFetch([
      [/[&?]page=1[&]/, () => jsonResponse(page1)],
      [/[&?]page=2[&]/, () => jsonResponse(page2)],
    ]);

    const repos = await listRepos("tok", fetchImpl);
    expect(repos).toHaveLength(101);
    expect(repos[0]).toEqual({
      fullName: "octo/repo-0",
      defaultBranch: "main",
      private: true,
    });
    expect(repos[100].fullName).toBe("octo/last");
    // Stopped after page 2 returned < 100.
    expect(calls).toHaveLength(2);
  });
});

describe("listBranches", () => {
  it("returns branch names", async () => {
    const { fetchImpl } = routedFetch([
      [/\/branches/, () => jsonResponse([{ name: "main" }, { name: "dev" }])],
    ]);
    const branches = await listBranches("tok", "octo/repo", fetchImpl);
    expect(branches).toEqual(["main", "dev"]);
  });
});

describe("validateContentPath", () => {
  const tree = {
    tree: [
      { path: "content", type: "tree" },
      { path: "content/intro.md", type: "blob" },
      { path: "README.md", type: "blob" },
    ],
  };

  it("returns true for the repo root (empty path)", async () => {
    const { fetchImpl, calls } = routedFetch([[/git\/trees/, () => jsonResponse(tree)]]);
    expect(await validateContentPath("tok", "octo/repo", "main", "", fetchImpl)).toBe(true);
    // Root validation short-circuits without a network call.
    expect(calls).toHaveLength(0);
  });

  it("returns true when the path exists in the tree", async () => {
    const { fetchImpl } = routedFetch([[/git\/trees/, () => jsonResponse(tree)]]);
    expect(await validateContentPath("tok", "octo/repo", "main", "/content", fetchImpl)).toBe(true);
  });

  it("returns false when the path is absent", async () => {
    const { fetchImpl } = routedFetch([[/git\/trees/, () => jsonResponse(tree)]]);
    expect(await validateContentPath("tok", "octo/repo", "main", "docs", fetchImpl)).toBe(false);
  });
});
