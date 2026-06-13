import type { BookmarkEmbedMeta } from "../types";

/**
 * Generic OpenGraph fallback resolver.
 *
 * Fetches the URL as HTML, extracts the `<meta property="og:*">` and
 * `<meta name="twitter:*">` tags, and falls back to `<title>` / `<meta
 * name="description">` when OG tags are absent. Tolerant of broken HTML
 * because we operate purely with regex over the head section.
 *
 * Returns a `BookmarkEmbedMeta` regardless of source so the renderer
 * always knows what to draw.
 */
export async function resolveOpenGraph(url: string, hostname: string): Promise<BookmarkEmbedMeta> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; verto-embed/1.0; +https://github.com/tsaiggo/verto)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`OpenGraph fetch → ${res.status}`);

  // Bound the body — we only need the <head>. Limit to 256 KB to avoid
  // pulling in megabytes of HTML over a slow network for a few meta tags.
  const reader = res.body?.getReader();
  if (!reader) throw new Error("OpenGraph: missing body");

  const decoder = new TextDecoder("utf-8", { fatal: false });
  let html = "";
  const MAX_BYTES = 256 * 1024;
  let received = 0;
  while (received < MAX_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (html.includes("</head>")) break;
  }
  try {
    await reader.cancel();
  } catch {
    // ignore cancel errors
  }

  // Operate on the <head> only to avoid spurious matches in body content.
  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  const head = headMatch ? headMatch[1] : html;

  const og = (key: string): string | undefined =>
    extractMeta(head, key, "property") ?? extractMeta(head, key, "name");

  const title = og("og:title") ?? og("twitter:title") ?? extractTitle(head) ?? undefined;

  const description =
    og("og:description") ??
    og("twitter:description") ??
    extractMeta(head, "description", "name") ??
    undefined;

  const image = og("og:image") ?? og("twitter:image") ?? undefined;
  const siteName = og("og:site_name") ?? undefined;

  return {
    kind: "bookmark",
    url,
    hostname,
    title,
    description,
    image: image ? resolveAbsolute(url, image) : undefined,
    siteName,
  };
}

function extractMeta(head: string, key: string, attr: "property" | "name"): string | undefined {
  // Match either order of attributes (`property` / `name` before or after
  // `content`) and tolerate single, double, or unquoted attribute values.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${escaped}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = p.exec(head);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return undefined;
}

function extractTitle(head: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  return m ? decodeHtmlEntities(m[1].trim()) : undefined;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e: string) => HTML_ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)));
}

/**
 * Resolve a (possibly protocol-relative or root-relative) URL against the
 * page's URL so the renderer always gets an absolute string.
 */
function resolveAbsolute(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}
