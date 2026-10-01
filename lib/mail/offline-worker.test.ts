import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "https://mail.example.com";
const OLD_HTML = '<main>Saved Mail</main><script src="/_next/static/old/mail.js"></script>';
const NEW_HTML = `<main>New Mail</main>
  <script src="/_next/static/new/mail.js?v=2&amp;build=new"></script>
  <link rel="stylesheet" href='/_next/static/new/mail.css'>
  <script src="https://foreign.example/_next/static/private.js"></script>`;
const SCRIPT = `${ORIGIN}/_next/static/new/mail.js?v=2&build=new`;
const STYLE = `${ORIGIN}/_next/static/new/mail.css`;
const EXTRA = `${ORIGIN}/_next/static/new/hydration.js`;

type WorkerRequest = Pick<Request, "url" | "method" | "mode" | "headers">;
type CacheKey = string | WorkerRequest;
interface WorkerEvent {
  request?: WorkerRequest;
  data?: { type: string; resources: unknown[] };
  waitUntil(promise: Promise<unknown>): void;
  respondWith?(promise: Promise<Response>): void;
}

function cacheKey(key: CacheKey): string {
  return typeof key === "string" ? new URL(key, ORIGIN).href : key.url;
}

function request(url: string, options: Partial<WorkerRequest> = {}): WorkerRequest {
  return {
    url: new URL(url, ORIGIN).href,
    method: "GET",
    mode: "cors",
    headers: new Headers(),
    ...options,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function worker() {
  const saved = new Map<string, Response>([
    [`${ORIGIN}/mail`, new Response(OLD_HTML)],
    [`${ORIGIN}/_next/static/old/mail.js`, new Response("old build")],
  ]);
  const cache = {
    match: vi.fn(async (key: CacheKey) => saved.get(cacheKey(key))?.clone()),
    put: vi.fn(async (key: CacheKey, response: Response) => {
      saved.set(cacheKey(key), response.clone());
    }),
  };
  const caches = { open: vi.fn(async () => cache) };
  const fetch =
    vi.fn<(input: string | WorkerRequest, options?: RequestInit) => Promise<Response>>();
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: WorkerEvent) => void) => {
      handlers.set(type, listener);
    },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  runInNewContext(
    readFileSync(new URL("../../public/mail-sw.js", import.meta.url), "utf8"),
    { self, caches, fetch, URL, Response },
    { filename: "mail-sw.js" }
  );
  const dispatch = (type: string, event: WorkerEvent) => {
    const handler = handlers.get(type);
    if (!handler) throw new Error(`Worker did not register ${type}.`);
    handler(event);
  };
  return {
    saved,
    cache,
    caches,
    fetch,
    self,
    async warm(resources: unknown[] = []) {
      const pending: Promise<unknown>[] = [];
      dispatch("message", {
        data: { type: "WARM_MAIL_SHELL", resources },
        waitUntil: (promise) => {
          pending.push(promise);
        },
      });
      return (await Promise.all(pending))[0];
    },
    fetchEvent(value: WorkerRequest) {
      const respondWith = vi.fn<(promise: Promise<Response>) => void>();
      dispatch("fetch", { request: value, waitUntil: vi.fn(), respondWith });
      return { respondWith, response: respondWith.mock.calls[0]?.[0] };
    },
    async read(key: CacheKey) {
      return saved.get(cacheKey(key))?.clone().text();
    },
  };
}

describe("Mail offline service worker", () => {
  it.each(["document error", "document unavailable", "build error", "build unavailable"])(
    "retains the previous complete shell when warming has a %s",
    async (failure) => {
      const runtime = worker();
      runtime.fetch.mockImplementation(async (input) => {
        const url = cacheKey(input);
        if (url === `${ORIGIN}/mail`) {
          if (failure === "document error") throw new Error("Document network failed.");
          return new Response(NEW_HTML, { status: failure === "document unavailable" ? 503 : 200 });
        }
        if (url === SCRIPT) {
          if (failure === "build error") throw new Error("Chunk network failed.");
          return new Response("Chunk unavailable", { status: 404 });
        }
        return new Response("New stylesheet");
      });
      expect(await runtime.warm()).toBe(false);
      expect(await runtime.read("/mail")).toBe(OLD_HTML);
      expect(await runtime.read("/_next/static/old/mail.js")).toBe("old build");
      expect(runtime.cache.put.mock.calls.some(([key]) => cacheKey(key) === `${ORIGIN}/mail`)).toBe(
        false
      );
    }
  );

  it("commits a new canonical document only after HTML assets and additional public chunks are cached", async () => {
    const runtime = worker();
    const script = deferred<Response>();
    const extra = deferred<Response>();
    const shared = `${ORIGIN}/_next/static/shared.js`;
    runtime.saved.set(shared, new Response("Already cached"));
    runtime.fetch.mockImplementation(async (input) => {
      const url = cacheKey(input);
      if (url === `${ORIGIN}/mail`) return new Response(NEW_HTML);
      if (url === SCRIPT) return script.promise;
      if (url === EXTRA) return extra.promise;
      if (url === STYLE) return new Response("New stylesheet");
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const warming = runtime.warm([
      SCRIPT,
      EXTRA,
      shared,
      "https://foreign.example/_next/static/leak.js",
      `${ORIGIN}/api/mail/private`,
      "not-a-url",
    ]);
    await vi.waitFor(() =>
      expect(runtime.cache.put.mock.calls.some(([key]) => cacheKey(key) === STYLE)).toBe(true)
    );
    expect(await runtime.read("/mail")).toBe(OLD_HTML);
    script.resolve(new Response("New mail build"));
    await vi.waitFor(() =>
      expect(runtime.cache.put.mock.calls.some(([key]) => cacheKey(key) === SCRIPT)).toBe(true)
    );
    expect(await runtime.read("/mail")).toBe(OLD_HTML);
    extra.resolve(new Response("Hydration chunk"));
    expect(await warming).toBe(true);
    expect(await runtime.read("/mail")).toBe(NEW_HTML);
    expect(runtime.cache.put.mock.calls.map(([key]) => cacheKey(key)).at(-1)).toBe(
      `${ORIGIN}/mail`
    );
    expect(new Set(runtime.fetch.mock.calls.map(([input]) => cacheKey(input)))).toEqual(
      new Set([`${ORIGIN}/mail`, SCRIPT, STYLE, EXTRA])
    );
    expect(runtime.fetch.mock.calls[0]).toEqual(["/mail", { cache: "reload" }]);
    expect(runtime.fetch.mock.calls.filter(([input]) => cacheKey(input) === SCRIPT)).toHaveLength(
      1
    );
  });

  it.each(["/mail", "/mail?account=work&message=private", "/mail?folder=INBOX&search=body"])(
    "serves the canonical saved shell when navigation %s loses the network",
    async (url) => {
      const runtime = worker();
      runtime.fetch.mockRejectedValue(new Error("Offline"));
      const event = runtime.fetchEvent(request(url, { mode: "navigate" }));
      expect(event.respondWith).toHaveBeenCalledOnce();
      expect(await (await event.response!).text()).toBe(OLD_HTML);
      expect(runtime.cache.match).toHaveBeenCalledExactlyOnceWith("/mail");
      expect(runtime.cache.put).not.toHaveBeenCalled();
    }
  );

  it("returns an online account navigation without overwriting the canonical shell or storing its query", async () => {
    const runtime = worker();
    runtime.fetch.mockResolvedValue(new Response("Current account route"));
    const event = runtime.fetchEvent(
      request("/mail?account=work&message=private", { mode: "navigate" })
    );
    expect(await (await event.response!).text()).toBe("Current account route");
    expect(await runtime.read("/mail")).toBe(OLD_HTML);
    expect(runtime.saved.size).toBe(2);
    expect(runtime.cache.put).not.toHaveBeenCalled();
  });

  it("never intercepts provider requests, authorized requests, POSTs or private APIs", () => {
    const runtime = worker();
    const protectedRequests = [
      request("https://gmail.googleapis.com/gmail/v1/users/me/messages"),
      request("https://graph.microsoft.com/v1.0/me/messages"),
      request("https://login.microsoftonline.com/common/oauth2/authorize"),
      request("https://foreign.example/_next/static/foreign.js"),
      request("/_next/static/protected.js", {
        headers: new Headers({ Authorization: "Bearer secret-token" }),
      }),
      request("/mail", {
        mode: "navigate",
        headers: new Headers({ authorization: "Bearer secret-token" }),
      }),
      request("/_next/static/submit.js", { method: "POST" }),
      request("/mail", { method: "POST", mode: "navigate" }),
      request("/api/mail/messages"),
      request("/mail/oauth/callback?code=private", { mode: "navigate" }),
      request("/mail?account=private"),
      request("/_next/image?url=private"),
      request("/_next/static-other/private.js"),
    ];
    for (const value of protectedRequests)
      expect(runtime.fetchEvent(value).respondWith).not.toHaveBeenCalled();
    expect(runtime.fetch).not.toHaveBeenCalled();
    expect(runtime.caches.open).not.toHaveBeenCalled();
    expect(runtime.cache.put).not.toHaveBeenCalled();
  });

  it("caches successful public static responses and serves the same chunk offline", async () => {
    const runtime = worker();
    runtime.fetch.mockResolvedValueOnce(new Response("Public chunk"));
    const value = request("/_next/static/new/chunk.js?build=2");
    expect(await (await runtime.fetchEvent(value).response!).text()).toBe("Public chunk");
    expect(runtime.cache.put).toHaveBeenCalledOnce();
    expect(await runtime.read(value)).toBe("Public chunk");
    runtime.fetch.mockRejectedValue(new Error("Offline"));
    expect(await (await runtime.fetchEvent(value).response!).text()).toBe("Public chunk");
    expect(runtime.cache.put).toHaveBeenCalledOnce();
    await expect(
      runtime.fetchEvent(request("/_next/static/new/other.js")).response
    ).rejects.toThrow("Offline");
  });

  it("does not save a failed public chunk response over a cached build asset", async () => {
    const runtime = worker();
    runtime.fetch.mockResolvedValue(new Response("Build temporarily unavailable", { status: 503 }));
    const value = request("/_next/static/old/mail.js");
    expect((await runtime.fetchEvent(value).response!).status).toBe(503);
    expect(runtime.cache.put).not.toHaveBeenCalled();
    expect(await runtime.read(value)).toBe("old build");
  });
});
