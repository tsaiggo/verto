// OneDrive content source.
//
// Two operating modes — pick whichever fits the deployment:
//
//   1. Share-URL mode (no OAuth, works for public/anonymous share links):
//        VERTO_ONEDRIVE_SHARE_URL=https://1drv.ms/...
//        VERTO_ONEDRIVE_PATH=content        # optional sub-folder
//
//   2. App + refresh-token mode (for private content; requires a prior
//      one-off auth dance to obtain the refresh token):
//        VERTO_ONEDRIVE_TENANT=common|consumers|<tenant-guid>
//        VERTO_ONEDRIVE_CLIENT_ID=...
//        VERTO_ONEDRIVE_CLIENT_SECRET=...
//        VERTO_ONEDRIVE_REFRESH_TOKEN=...
//        VERTO_ONEDRIVE_PATH=content        # optional sub-folder under drive root
//
// The implementation uses Microsoft Graph v1.0, handles `@odata.nextLink`
// pagination, and respects `Retry-After` on 429 responses with simple
// exponential backoff.

import type { ContentSource, RawFileEntry } from "./types";
import { isReadable } from "./tree";

const GRAPH = "https://graph.microsoft.com/v1.0";

interface ShareConfig {
  mode: "share";
  shareUrl: string;
  /** Optional sub-folder under the shared item (segments). */
  subPath: string[];
}

interface AppConfig {
  mode: "app";
  tenant: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Optional sub-folder under `/me/drive/root` (segments). */
  subPath: string[];
}

type OneDriveConfig = ShareConfig | AppConfig;

function splitPath(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function readConfig(): OneDriveConfig {
  const shareUrl = process.env.VERTO_ONEDRIVE_SHARE_URL?.trim();
  const refreshToken = process.env.VERTO_ONEDRIVE_REFRESH_TOKEN?.trim();
  const subPath = splitPath(process.env.VERTO_ONEDRIVE_PATH);

  if (shareUrl) {
    return { mode: "share", shareUrl, subPath };
  }
  if (refreshToken) {
    const tenant = process.env.VERTO_ONEDRIVE_TENANT?.trim() || "common";
    const clientId = process.env.VERTO_ONEDRIVE_CLIENT_ID?.trim();
    const clientSecret = process.env.VERTO_ONEDRIVE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error(
        "OneDrive source (app mode) requires VERTO_ONEDRIVE_CLIENT_ID and " +
          "VERTO_ONEDRIVE_CLIENT_SECRET to be set alongside VERTO_ONEDRIVE_REFRESH_TOKEN."
      );
    }
    return {
      mode: "app",
      tenant,
      clientId,
      clientSecret,
      refreshToken,
      subPath,
    };
  }
  throw new Error(
    "OneDrive source requires either VERTO_ONEDRIVE_SHARE_URL (share mode) " +
      "or VERTO_ONEDRIVE_REFRESH_TOKEN (app mode) to be set."
  );
}

/**
 * Encode a OneDrive share URL into the `u!...` share id format used by
 * `/shares/{share-id}` — see Microsoft Graph docs.
 */
export function encodeShareUrl(url: string): string {
  const b64 = Buffer.from(url, "utf-8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
  return "u!" + b64;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Auth helpers (app mode)
// ---------------------------------------------------------------------------

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

async function fetchAccessToken(cfg: AppConfig): Promise<TokenState> {
  const url = `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
    refresh_token: cfg.refreshToken,
    scope: "Files.Read offline_access",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OneDrive token exchange failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`
    );
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  // Refresh 60s before actual expiry to absorb clock skew.
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
}

// ---------------------------------------------------------------------------
// Graph fetch with retry / pagination
// ---------------------------------------------------------------------------

async function graphFetch(url: string, authHeader: string | null, attempt = 0): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authHeader) headers.Authorization = authHeader;
  const res = await fetch(url, { headers });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= 4) {
      throw new Error(`OneDrive source: ${res.status} after ${attempt + 1} attempts on ${url}`);
    }
    const retryAfter = Number(res.headers.get("retry-after") ?? "0");
    const delay = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
    await sleep(delay);
    return graphFetch(url, authHeader, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OneDrive source: ${res.status} ${res.statusText} on ${url}` +
        (text ? ` — ${text.slice(0, 200)}` : "")
    );
  }
  return res;
}

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  eTag?: string;
  lastModifiedDateTime?: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  // Present on file items; short-lived pre-authenticated URL.
  "@microsoft.graph.downloadUrl"?: string;
  parentReference?: { driveId?: string; id?: string };
}

interface ChildrenResponse {
  value: DriveItem[];
  "@odata.nextLink"?: string;
}

// ---------------------------------------------------------------------------
// Source implementation
// ---------------------------------------------------------------------------

export function createOneDriveSource(): ContentSource {
  const cfg = readConfig();

  // Cached auth header for app mode (share mode is anonymous).
  let tokenState: TokenState | null = null;
  async function authHeader(): Promise<string | null> {
    if (cfg.mode !== "app") return null;
    if (!tokenState || Date.now() >= tokenState.expiresAt) {
      tokenState = await fetchAccessToken(cfg);
    }
    return `Bearer ${tokenState.accessToken}`;
  }

  // Resolve the root drive item we list under.
  async function rootEndpoint(): Promise<{
    /** URL prefix for "children of this root" — append `/children` */
    childrenUrlFor: (itemId: string) => string;
    /** URL prefix for "this item's children inside the root" — used initially */
    rootChildrenUrl: string;
    /** URL for the root item itself (used to resolve sub-path). */
    rootItemUrl: string;
    /** URL for a specific item by id (used by readFile fallback). */
    itemUrlFor: (itemId: string) => string;
    /** URL for streaming a specific item's raw content. */
    contentUrlFor: (itemId: string) => string;
  }> {
    if (cfg.mode === "share") {
      // Share IDs already use URL-safe base64 — they don't need a second
      // round of percent-encoding. Microsoft's own samples interpolate
      // them directly into the path.
      const shareId = encodeShareUrl(cfg.shareUrl);
      const shareBase = `${GRAPH}/shares/${shareId}`;
      return {
        rootItemUrl: `${shareBase}/driveItem`,
        rootChildrenUrl: `${shareBase}/driveItem/children`,
        childrenUrlFor: (itemId: string) =>
          `${shareBase}/items/${encodeURIComponent(itemId)}/children`,
        itemUrlFor: (itemId: string) => `${shareBase}/items/${encodeURIComponent(itemId)}`,
        contentUrlFor: (itemId: string) =>
          `${shareBase}/items/${encodeURIComponent(itemId)}/content`,
      };
    }
    const base = `${GRAPH}/me/drive`;
    return {
      rootItemUrl: `${base}/root`,
      rootChildrenUrl: `${base}/root/children`,
      childrenUrlFor: (itemId: string) => `${base}/items/${encodeURIComponent(itemId)}/children`,
      itemUrlFor: (itemId: string) => `${base}/items/${encodeURIComponent(itemId)}`,
      contentUrlFor: (itemId: string) => `${base}/items/${encodeURIComponent(itemId)}/content`,
    };
  }

  /** Resolve sub-path (if any) to a starting `DriveItem`. */
  async function resolveRoot(): Promise<DriveItem> {
    const ep = await rootEndpoint();
    const header = await authHeader();
    const rootRes = await graphFetch(ep.rootItemUrl, header);
    let item = (await rootRes.json()) as DriveItem;
    for (const seg of cfg.subPath) {
      const childrenUrl = ep.childrenUrlFor(item.id);
      const child = await findChildByName(childrenUrl, header, seg);
      if (!child) {
        throw new Error(
          `OneDrive source: sub-path segment "${seg}" not found under ${ep.rootItemUrl}.`
        );
      }
      item = child;
    }
    return item;
  }

  async function findChildByName(
    childrenUrl: string,
    header: string | null,
    name: string
  ): Promise<DriveItem | null> {
    let url: string | undefined = childrenUrl;
    while (url) {
      const res = await graphFetch(url, header);
      const json = (await res.json()) as ChildrenResponse;
      for (const item of json.value) {
        if (item.name === name) return item;
      }
      url = json["@odata.nextLink"];
    }
    return null;
  }

  async function listChildren(childrenUrl: string, header: string | null): Promise<DriveItem[]> {
    const out: DriveItem[] = [];
    let url: string | undefined = childrenUrl;
    while (url) {
      const res = await graphFetch(url, header);
      const json = (await res.json()) as ChildrenResponse;
      out.push(...json.value);
      url = json["@odata.nextLink"];
    }
    return out;
  }

  /**
   * Recursively walk a OneDrive folder, collecting every readable file.
   * Built items use the Graph item id as their opaque id; we additionally
   * stash the (short-lived) download URL via a side-channel cache.
   */
  const downloadUrlCache = new Map<string, string>();

  async function walk(
    item: DriveItem,
    relSegs: string[],
    out: RawFileEntry[],
    header: string | null,
    childrenUrlFor: (itemId: string) => string
  ): Promise<void> {
    if (!item.folder) return; // leaf — caller handles
    const children = await listChildren(childrenUrlFor(item.id), header);
    for (const child of children) {
      if (child.name.startsWith(".")) continue;
      const childSegs = [...relSegs, child.name];
      if (child.folder) {
        await walk(child, childSegs, out, header, childrenUrlFor);
        continue;
      }
      if (!child.file || !isReadable(child.name)) continue;
      if (child["@microsoft.graph.downloadUrl"]) {
        downloadUrlCache.set(child.id, child["@microsoft.graph.downloadUrl"]);
      }
      out.push({
        path: childSegs,
        id: child.id,
        size: child.size,
        etag: child.eTag,
        mtime: child.lastModifiedDateTime ? Date.parse(child.lastModifiedDateTime) : undefined,
      });
    }
  }

  return {
    id: "onedrive",
    label: cfg.mode === "share" ? `onedrive (share)` : `onedrive (app, tenant=${cfg.tenant})`,

    async listFiles(): Promise<RawFileEntry[]> {
      const ep = await rootEndpoint();
      const header = await authHeader();
      const root = await resolveRoot();
      const out: RawFileEntry[] = [];
      await walk(root, [], out, header, ep.childrenUrlFor);
      return out;
    },

    async readFile(entry): Promise<string> {
      const ep = await rootEndpoint();
      const header = await authHeader();
      // Prefer cached short-lived download URL (anonymous, no auth header
      // needed). Fall back to fetching the item to obtain a fresh URL.
      let downloadUrl = downloadUrlCache.get(entry.id);
      if (!downloadUrl) {
        const itemRes = await graphFetch(ep.itemUrlFor(entry.id), header);
        const item = (await itemRes.json()) as DriveItem;
        if (item["@microsoft.graph.downloadUrl"]) {
          downloadUrl = item["@microsoft.graph.downloadUrl"];
          downloadUrlCache.set(entry.id, downloadUrl);
        }
      }
      if (downloadUrl) {
        const res = await fetch(downloadUrl);
        if (!res.ok) {
          const pathHint = entry.path ? entry.path.join("/") : entry.id;
          throw new Error(
            `OneDrive source: download failed (${res.status} ${res.statusText}) for ${pathHint}`
          );
        }
        return res.text();
      }
      // Last-resort: request `/content` directly (auth required).
      const res = await graphFetch(ep.contentUrlFor(entry.id), header);
      return res.text();
    },

    async readOptionalFile(segs: string[]): Promise<string | null> {
      try {
        const ep = await rootEndpoint();
        const header = await authHeader();
        let item = await resolveRoot();
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          const child = await findChildByName(ep.childrenUrlFor(item.id), header, seg);
          if (!child) return null;
          item = child;
        }
        if (!item.file) return null;
        const downloadUrl = item["@microsoft.graph.downloadUrl"];
        if (downloadUrl) {
          const res = await fetch(downloadUrl);
          if (!res.ok) return null;
          return res.text();
        }
        const res = await graphFetch(ep.contentUrlFor(item.id), header);
        return res.text();
      } catch {
        return null;
      }
    },
  };
}
