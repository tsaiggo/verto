/* Cache the public Mail shell and build assets only. Mail bodies are stored separately in IndexedDB. */
const MAIL_CACHE = "verto-mail-shell-v1";

function publicAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

async function saveResponse(cache, key, response) {
  if (response.ok && response.type !== "opaque") await cache.put(key, response.clone());
  return response;
}

function documentAssets(html) {
  return [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1].replace(/&amp;/g, "&"), self.location.origin).href)
    .filter((value) => publicAsset(new URL(value)));
}

async function warmShell(resources = []) {
  const cache = await caches.open(MAIL_CACHE);
  try {
    const document = await fetch("/mail", { cache: "reload" });
    if (!document.ok) return false;
    const required = [...new Set([...documentAssets(await document.clone().text()), ...resources])];
    const assets = required.filter((value) => {
      try {
        return publicAsset(new URL(value));
      } catch {
        return false;
      }
    });
    await Promise.all(
      assets.map(async (value) => {
        if (await cache.match(value)) return;
        const response = await fetch(value);
        if (!response.ok) throw new Error("Mail shell asset is unavailable.");
        await saveResponse(cache, value, response);
      })
    );
    // Commit a new document only when its build assets are ready. Interrupted
    // warming keeps the previous complete shell and its versioned chunks readable.
    await saveResponse(cache, "/mail", document);
    return true;
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(warmShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "WARM_MAIL_SHELL" && Array.isArray(event.data.resources))
    event.waitUntil(warmShell(event.data.resources));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers.has("authorization")) return;
  const document =
    request.mode === "navigate" && url.origin === self.location.origin && url.pathname === "/mail";
  if (!document && !publicAsset(url)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(MAIL_CACHE);
      try {
        const response = await fetch(request);
        // Keep the canonical document free of account/query state. Cache only public static chunks here.
        if (!document) await saveResponse(cache, request, response);
        return response;
      } catch (error) {
        const saved = await cache.match(document ? "/mail" : request);
        if (saved) return saved;
        throw error;
      }
    })()
  );
});
