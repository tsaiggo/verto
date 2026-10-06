import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubModelsProvider, GITHUB_MODELS_ENDPOINT } from "@/lib/ai/github-copilot";
import { tauriFetch, type FetchLike } from "@/lib/tauri";

const native = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: native.fetch }));

beforeEach(() => {
  native.fetch.mockReset();
  vi.stubGlobal("window", {});
});
afterEach(() => vi.unstubAllGlobals());

describe("assistant HTTP transport", () => {
  it("allows the browser fetch to be called as a provider options method", async () => {
    const response = new Response(
      JSON.stringify({
        model: "test-model",
        choices: [{ message: { role: "assistant", content: "A grounded edit." } }],
      }),
      { headers: { "Content-Type": "application/json" } }
    );
    // Browser fetch rejects unrelated method receivers such as the provider's
    // options object. A generic vi.fn would silently hide that browser failure.
    const browserFetch = vi.fn<FetchLike>(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(response);
    });
    vi.stubGlobal("fetch", browserFetch);
    const controller = new AbortController();
    const provider = createGitHubModelsProvider({
      token: "test-access-key",
      fetchImpl: await tauriFetch(),
    });

    await expect(
      provider.chat([{ role: "user", content: "Tighten this paragraph." }], {
        signal: controller.signal,
      })
    ).resolves.toMatchObject({ content: "A grounded edit.", model: "test-model" });
    expect(browserFetch).toHaveBeenCalledExactlyOnceWith(
      GITHUB_MODELS_ENDPOINT,
      expect.objectContaining({ method: "POST", signal: controller.signal })
    );
    expect(browserFetch.mock.contexts[0]).toBe(globalThis);
    expect(native.fetch).not.toHaveBeenCalled();
  });

  it("keeps native requests on the Tauri HTTP plugin", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const browserFetch = vi.fn();
    vi.stubGlobal("fetch", browserFetch);
    const response = new Response("Native response");
    native.fetch.mockResolvedValue(response);
    const options = { fetchImpl: await tauriFetch() };
    const init: RequestInit = { method: "POST", body: "Native request" };

    expect(options.fetchImpl).toBe(native.fetch);
    await expect(options.fetchImpl("https://example.test/assistant", init)).resolves.toBe(response);
    expect(native.fetch).toHaveBeenCalledExactlyOnceWith("https://example.test/assistant", init);
    expect(browserFetch).not.toHaveBeenCalled();
  });
});
