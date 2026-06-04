import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  createOneDriveSource,
  encodeShareUrl,
} from "@/lib/content-source/onedrive";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

const ENV_KEYS = [
  "VERTO_ONEDRIVE_SHARE_URL",
  "VERTO_ONEDRIVE_PATH",
  "VERTO_ONEDRIVE_TENANT",
  "VERTO_ONEDRIVE_CLIENT_ID",
  "VERTO_ONEDRIVE_CLIENT_SECRET",
  "VERTO_ONEDRIVE_REFRESH_TOKEN",
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
// Fake OneDrive in-memory tree for share-mode
// ---------------------------------------------------------------------------

interface FakeItem {
  id: string;
  name: string;
  /** Children by name; absent for files. */
  children?: Record<string, FakeItem>;
  /** Raw file text — set for files only. */
  text?: string;
  size?: number;
  lastModifiedDateTime?: string;
}

function makeFakeTree(): FakeItem {
  return {
    id: "root",
    name: "root",
    children: {
      "intro.md": {
        id: "id-intro",
        name: "intro.md",
        text: "---\ntitle: Intro\n---\nHi.",
        size: 30,
        lastModifiedDateTime: "2026-05-01T00:00:00Z",
      },
      docs: {
        id: "id-docs",
        name: "docs",
        children: {
          "quickstart.mdx": {
            id: "id-qs",
            name: "quickstart.mdx",
            text: "---\ntitle: Quick Start\n---\nGo.",
            size: 28,
            lastModifiedDateTime: "2026-05-02T00:00:00Z",
          },
          "ignored.png": {
            id: "id-png",
            name: "ignored.png",
            text: "binary",
            size: 6,
          },
        },
      },
      ".hidden": {
        id: "id-hidden",
        name: ".hidden",
        children: {
          "x.md": { id: "id-x", name: "x.md", text: "nope" },
        },
      },
    },
  };
}

/**
 * Install a fake fetch matching the share-mode endpoints we hit:
 *   - GET /shares/{id}/driveItem
 *   - GET /shares/{id}/items/{itemId}/children   (with pagination)
 * Pagination is forced for the children of the root to make sure the
 * pagination loop is exercised.
 */
function installShareFetch(
  shareUrl: string,
  root: FakeItem,
  pageSize = 1,
): { calls: string[] } {
  const shareId = encodeShareUrl(shareUrl);
  const calls: string[] = [];

  function flatten(item: FakeItem): FakeItem[] {
    const out: FakeItem[] = [item];
    if (item.children) {
      for (const child of Object.values(item.children)) out.push(...flatten(child));
    }
    return out;
  }
  const all = flatten(root);
  function findById(id: string): FakeItem | undefined {
    return all.find((i) => i.id === id);
  }

  function serialize(item: FakeItem): Record<string, unknown> {
    const out: Record<string, unknown> = {
      id: item.id,
      name: item.name,
      size: item.size,
      lastModifiedDateTime: item.lastModifiedDateTime,
    };
    if (item.children) {
      out.folder = { childCount: Object.keys(item.children).length };
    } else {
      out.file = { mimeType: "text/plain" };
      out["@microsoft.graph.downloadUrl"] = `https://dl.example/${item.id}`;
    }
    return out;
  }

  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    calls.push(u);

    // Download URL (anonymous, no auth)
    const dl = u.match(/^https:\/\/dl\.example\/(.+)$/);
    if (dl) {
      const item = findById(dl[1]);
      if (!item || item.text === undefined) {
        return new Response("not found", { status: 404 });
      }
      return new Response(item.text, { status: 200 });
    }

    // Match /shares/{shareId}/driveItem
    if (
      u.endsWith(`/shares/${encodeURIComponent(shareId)}/driveItem`) ||
      u.endsWith(`/shares/${shareId}/driveItem`)
    ) {
      return new Response(JSON.stringify(serialize(root)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Match /shares/{shareId}/items/{itemId}/children?... (with pagination)
    const childMatch = u.match(
      /\/shares\/[^/]+\/items\/([^/?]+)\/children(?:\?\$skiptoken=(\d+))?/,
    );
    if (childMatch) {
      const item = findById(decodeURIComponent(childMatch[1]));
      const skip = childMatch[2] ? Number(childMatch[2]) : 0;
      const kids = item?.children ? Object.values(item.children) : [];
      const slice = kids.slice(skip, skip + pageSize);
      const hasMore = skip + pageSize < kids.length;
      const body: Record<string, unknown> = {
        value: slice.map(serialize),
      };
      if (hasMore) {
        // Build a synthetic next link — always use `?` since we stripped it.
        body["@odata.nextLink"] = `${u.split("?")[0]}?$skiptoken=${
          skip + pageSize
        }`;
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Match /shares/{shareId}/items/{itemId} (for readFile fallback path)
    const itemMatch = u.match(/\/shares\/[^/]+\/items\/([^/?]+)$/);
    if (itemMatch) {
      const item = findById(decodeURIComponent(itemMatch[1]));
      if (!item) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(serialize(item)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("unhandled " + u, { status: 500 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("onedrive share-URL encoding", () => {
  it("matches the Microsoft Graph `u!` scheme", () => {
    // Reference: docs say base64-url, strip padding, prefix with "u!"
    const url = "https://1drv.ms/u/s!abc";
    const encoded = encodeShareUrl(url);
    expect(encoded.startsWith("u!")).toBe(true);
    expect(encoded).not.toContain("=");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");

    const body = encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/");
    const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
    expect(Buffer.from(padded, "base64").toString("utf-8")).toBe(url);
  });
});

describe("onedrive content source (share mode)", () => {
  it("requires either VERTO_ONEDRIVE_SHARE_URL or VERTO_ONEDRIVE_REFRESH_TOKEN", () => {
    expect(() => createOneDriveSource()).toThrow(
      /VERTO_ONEDRIVE_SHARE_URL|VERTO_ONEDRIVE_REFRESH_TOKEN/,
    );
  });

  it("lists readable files recursively, skipping dotfiles and non-md", async () => {
    const shareUrl = "https://1drv.ms/u/s!demo";
    process.env.VERTO_ONEDRIVE_SHARE_URL = shareUrl;
    installShareFetch(shareUrl, makeFakeTree());

    const source = createOneDriveSource();
    const files = await source.listFiles();
    const paths = files.map((f) => f.path.join("/")).sort();

    expect(paths).toEqual(["docs/quickstart.mdx", "intro.md"]);
    // mtime came from `lastModifiedDateTime`
    const intro = files.find((f) => f.path.join("/") === "intro.md")!;
    expect(intro.mtime).toBe(Date.parse("2026-05-01T00:00:00Z"));
  });

  it("paginates through @odata.nextLink", async () => {
    const shareUrl = "https://1drv.ms/u/s!demo";
    process.env.VERTO_ONEDRIVE_SHARE_URL = shareUrl;
    const { calls } = installShareFetch(shareUrl, makeFakeTree(), 1);

    const source = createOneDriveSource();
    await source.listFiles();
    const paginated = calls.filter((c) => c.includes("$skiptoken="));
    expect(paginated.length).toBeGreaterThan(0);
  });

  it("readFile uses the cached short-lived download URL", async () => {
    const shareUrl = "https://1drv.ms/u/s!demo";
    process.env.VERTO_ONEDRIVE_SHARE_URL = shareUrl;
    installShareFetch(shareUrl, makeFakeTree());

    const source = createOneDriveSource();
    const files = await source.listFiles();
    const intro = files.find((f) => f.path.join("/") === "intro.md")!;
    const text = await source.readFile({ id: intro.id, path: intro.path });
    expect(text).toContain("title: Intro");
  });

  it("readOptionalFile returns null for absent files", async () => {
    const shareUrl = "https://1drv.ms/u/s!demo";
    process.env.VERTO_ONEDRIVE_SHARE_URL = shareUrl;
    installShareFetch(shareUrl, makeFakeTree());

    const source = createOneDriveSource();
    const got = await source.readOptionalFile!(["does-not-exist.json"]);
    expect(got).toBeNull();
  });

  it("respects VERTO_ONEDRIVE_PATH sub-folder", async () => {
    const shareUrl = "https://1drv.ms/u/s!demo";
    process.env.VERTO_ONEDRIVE_SHARE_URL = shareUrl;
    process.env.VERTO_ONEDRIVE_PATH = "docs";
    installShareFetch(shareUrl, makeFakeTree());

    const source = createOneDriveSource();
    const files = await source.listFiles();
    const paths = files.map((f) => f.path.join("/")).sort();
    expect(paths).toEqual(["quickstart.mdx"]);
  });

  it("retries on 429 honoring Retry-After", async () => {
    const shareUrl = "https://1drv.ms/u/s!demo";
    process.env.VERTO_ONEDRIVE_SHARE_URL = shareUrl;
    const root = makeFakeTree();
    const shareId = encodeShareUrl(shareUrl);
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const u = typeof url === "string" ? url : url.toString();
        calls++;
        if (calls === 1) {
          return new Response("slow down", {
            status: 429,
            headers: { "Retry-After": "0" },
          });
        }
        // Subsequent: pretend root has no children — we only assert retry happened.
        if (u.includes(`/shares/${encodeURIComponent(shareId)}/driveItem`)) {
          return new Response(
            JSON.stringify({
              id: root.id,
              name: root.name,
              folder: { childCount: 0 },
            }),
            { status: 200 },
          );
        }
        if (u.includes("/children")) {
          return new Response(JSON.stringify({ value: [] }), { status: 200 });
        }
        return new Response("ok", { status: 200 });
      }),
    );

    const source = createOneDriveSource();
    const files = await source.listFiles();
    expect(files).toEqual([]);
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

describe("onedrive content source (app mode validation)", () => {
  it("requires client id/secret when only refresh token is given", () => {
    process.env.VERTO_ONEDRIVE_REFRESH_TOKEN = "rt";
    expect(() => createOneDriveSource()).toThrow(
      /VERTO_ONEDRIVE_CLIENT_ID|VERTO_ONEDRIVE_CLIENT_SECRET/,
    );
  });

  it("accepts a full app-mode config (token exchange happens lazily)", () => {
    process.env.VERTO_ONEDRIVE_REFRESH_TOKEN = "rt";
    process.env.VERTO_ONEDRIVE_CLIENT_ID = "id";
    process.env.VERTO_ONEDRIVE_CLIENT_SECRET = "sec";
    expect(() => createOneDriveSource()).not.toThrow();
  });

  it("uses OAuth bearer auth and falls back to /content for optional files without download URLs", async () => {
    process.env.VERTO_ONEDRIVE_TENANT = "consumers";
    process.env.VERTO_ONEDRIVE_REFRESH_TOKEN = "refresh-token";
    process.env.VERTO_ONEDRIVE_CLIENT_ID = "client-id";
    process.env.VERTO_ONEDRIVE_CLIENT_SECRET = "client-secret";

    const graphAuthHeaders: Array<string | null> = [];
    const tokenBodies: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = typeof url === "string" ? url : url.toString();

        if (u === "https://login.microsoftonline.com/consumers/oauth2/v2.0/token") {
          const body = init?.body;
          tokenBodies.push(body instanceof URLSearchParams ? body.toString() : String(body));
          return Response.json({ access_token: "access-token", expires_in: 3600 });
        }

        if (u.startsWith("https://graph.microsoft.com/v1.0/")) {
          const headers = new Headers(init?.headers);
          graphAuthHeaders.push(headers.get("Authorization"));
        }

        if (u === "https://graph.microsoft.com/v1.0/me/drive/root") {
          return Response.json({ id: "root", name: "root", folder: { childCount: 1 } });
        }

        if (u === "https://graph.microsoft.com/v1.0/me/drive/items/root/children") {
          return Response.json({
            value: [
              {
                id: "nav-file",
                name: "navigation.json",
                file: { mimeType: "application/json" },
              },
            ],
          });
        }

        if (u === "https://graph.microsoft.com/v1.0/me/drive/items/nav-file/content") {
          return new Response('{"overrides":{}}', { status: 200 });
        }

        return new Response("unhandled " + u, { status: 500 });
      }),
    );

    const source = createOneDriveSource();
    await expect(source.readOptionalFile?.(["navigation.json"])).resolves.toBe(
      '{"overrides":{}}',
    );

    expect(tokenBodies).toHaveLength(1);
    expect(tokenBodies[0]).toContain("grant_type=refresh_token");
    expect(tokenBodies[0]).toContain("refresh_token=refresh-token");
    expect(graphAuthHeaders).toContain("Bearer access-token");
    expect(graphAuthHeaders.every((header) => header === "Bearer access-token")).toBe(
      true,
    );
  });
});
