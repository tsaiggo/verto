import { describe, it, expect, vi } from "vitest";

import {
  DeviceFlowError,
  pollForToken,
  requestDeviceCode,
} from "@/lib/auth/github-device";
import type { FetchLike } from "@/lib/tauri";

// ---------------------------------------------------------------------------
// Helpers — build JSON Responses and a queued fake fetch.
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fetch that returns each queued response in order. */
function queuedFetch(responses: Response[]): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  let i = 0;
  const fetchImpl: FetchLike = vi.fn(async (url: string) => {
    calls.push(url);
    const res = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return res;
  });
  return { fetchImpl, calls };
}

const noSleep = () => Promise.resolve();

describe("requestDeviceCode", () => {
  it("maps the GitHub response to camelCase", async () => {
    const { fetchImpl } = queuedFetch([
      jsonResponse({
        device_code: "dev-123",
        user_code: "WXYZ-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      }),
    ]);

    const result = await requestDeviceCode("client-id", "repo", fetchImpl);

    expect(result).toEqual({
      deviceCode: "dev-123",
      userCode: "WXYZ-1234",
      verificationUri: "https://github.com/login/device",
      expiresIn: 900,
      interval: 5,
    });
  });

  it("throws a DeviceFlowError when the client id is missing", async () => {
    const { fetchImpl } = queuedFetch([jsonResponse({})]);
    await expect(
      requestDeviceCode("", "repo", fetchImpl),
    ).rejects.toBeInstanceOf(DeviceFlowError);
  });

  it("surfaces a non-OK HTTP status", async () => {
    const { fetchImpl } = queuedFetch([
      new Response("nope", { status: 500, statusText: "Server Error" }),
    ]);
    await expect(
      requestDeviceCode("client-id", "repo", fetchImpl),
    ).rejects.toThrow(/500/);
  });
});

describe("pollForToken", () => {
  it("waits through authorization_pending then returns the token", async () => {
    const { fetchImpl, calls } = queuedFetch([
      jsonResponse({ error: "authorization_pending" }),
      jsonResponse({ error: "authorization_pending" }),
      jsonResponse({ access_token: "gho_token", token_type: "bearer" }),
    ]);

    const token = await pollForToken({
      clientId: "client-id",
      deviceCode: "dev-123",
      interval: 1,
      expiresIn: 900,
      fetchImpl,
      sleep: noSleep,
    });

    expect(token).toBe("gho_token");
    expect(calls).toHaveLength(3);
  });

  it("backs off on slow_down and still succeeds", async () => {
    const { fetchImpl } = queuedFetch([
      jsonResponse({ error: "slow_down", interval: 5 }),
      jsonResponse({ access_token: "gho_token" }),
    ]);

    const token = await pollForToken({
      clientId: "client-id",
      deviceCode: "dev-123",
      interval: 1,
      expiresIn: 900,
      fetchImpl,
      sleep: noSleep,
    });

    expect(token).toBe("gho_token");
  });

  it("keeps polling after a transient token request transport failure", async () => {
    const calls: string[] = [];
    let attempt = 0;
    const fetchImpl: FetchLike = vi.fn(async (url: string) => {
      calls.push(url);
      attempt += 1;
      if (attempt === 1) {
        throw new Error(
          "error sending request for url (https://github.com/login/oauth/access_token)",
        );
      }
      return jsonResponse({ access_token: "gho_token" });
    });

    const token = await pollForToken({
      clientId: "client-id",
      deviceCode: "dev-123",
      interval: 1,
      expiresIn: 900,
      fetchImpl,
      sleep: noSleep,
    });

    expect(token).toBe("gho_token");
    expect(calls).toHaveLength(2);
  });

  it("surfaces non-transport token request failures immediately", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(0); // deadline calculation
    now.mockReturnValueOnce(0); // first loop deadline check
    now.mockReturnValueOnce(2_000); // would expire if the error were swallowed

    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error("url not allowed on the configured scope");
    });

    try {
      await expect(
        pollForToken({
          clientId: "client-id",
          deviceCode: "dev-123",
          interval: 1,
          expiresIn: 1,
          fetchImpl,
          sleep: noSleep,
        }),
      ).rejects.toThrow(/url not allowed/);
    } finally {
      now.mockRestore();
    }
  });

  it("throws on access_denied", async () => {
    const { fetchImpl } = queuedFetch([
      jsonResponse({ error: "access_denied" }),
    ]);

    await expect(
      pollForToken({
        clientId: "client-id",
        deviceCode: "dev-123",
        interval: 1,
        expiresIn: 900,
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toMatchObject({ code: "access_denied" });
  });

  it("throws on expired_token", async () => {
    const { fetchImpl } = queuedFetch([
      jsonResponse({ error: "expired_token" }),
    ]);

    await expect(
      pollForToken({
        clientId: "client-id",
        deviceCode: "dev-123",
        interval: 1,
        expiresIn: 900,
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toMatchObject({ code: "expired_token" });
  });

  it("stops when the deadline has passed", async () => {
    const { fetchImpl, calls } = queuedFetch([
      jsonResponse({ error: "authorization_pending" }),
    ]);

    await expect(
      pollForToken({
        clientId: "client-id",
        deviceCode: "dev-123",
        interval: 1,
        expiresIn: 0, // already expired
        fetchImpl,
        sleep: noSleep,
      }),
    ).rejects.toMatchObject({ code: "expired_token" });
    // Never even reached the token endpoint.
    expect(calls).toHaveLength(0);
  });

  it("aborts when the signal is already aborted", async () => {
    const { fetchImpl } = queuedFetch([
      jsonResponse({ error: "authorization_pending" }),
    ]);
    const controller = new AbortController();
    controller.abort();

    await expect(
      pollForToken({
        clientId: "client-id",
        deviceCode: "dev-123",
        interval: 1,
        expiresIn: 900,
        fetchImpl,
        sleep: noSleep,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "cancelled" });
  });
});
