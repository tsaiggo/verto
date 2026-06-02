// GitHub OAuth Device Flow.
//
// The desktop app authenticates the user with GitHub's Device Authorization
// Grant (https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow).
// Device flow is the right fit for a native app: it only needs a *public*
// `client_id` — no client secret to ship — and works without a redirect URL
// or an embedded browser.
//
// The flow:
//   1. POST /login/device/code  → { device_code, user_code, verification_uri }
//   2. Show `user_code`, open `verification_uri` in the system browser.
//   3. Poll POST /login/oauth/access_token until the user approves, GitHub
//      returns `access_token`, or the code expires.
//
// These functions take an injected `fetch` so they can run against the Tauri
// HTTP plugin in production (to dodge CORS) and a mock in tests.

import type { FetchLike } from "@/lib/tauri";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

/**
 * Default OAuth scopes. `repo` grants read access to private repositories
 * (and is a superset of `public_repo`); `read:user` lets us show the signed-in
 * account's login and avatar.
 */
export const DEFAULT_SCOPE = "repo read:user";

export interface DeviceCodeResponse {
  /** Long-lived code the app exchanges for a token while polling. */
  deviceCode: string;
  /** Short human code the user types into the verification page. */
  userCode: string;
  /** URL the user opens to enter `userCode`. */
  verificationUri: string;
  /** Seconds until `deviceCode` expires. */
  expiresIn: number;
  /** Minimum seconds the app must wait between polls. */
  interval: number;
}

/** Raw shape returned by GitHub (snake_case) for the device-code request. */
interface RawDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  error?: string;
  error_description?: string;
}

/** Raw shape returned by GitHub for the access-token poll. */
interface RawTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

/** Error thrown when the device-flow cannot complete. */
export class DeviceFlowError extends Error {
  constructor(
    message: string,
    /** GitHub error code, e.g. "access_denied", "expired_token". */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DeviceFlowError";
  }
}

function jsonHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "verto-desktop",
  };
}

/**
 * Step 1 — request a device + user code for the given OAuth app `clientId`.
 */
export async function requestDeviceCode(
  clientId: string,
  scope: string,
  fetchImpl: FetchLike,
): Promise<DeviceCodeResponse> {
  if (!clientId) {
    throw new DeviceFlowError(
      "Missing GitHub OAuth client id. Set NEXT_PUBLIC_VERTO_GITHUB_CLIENT_ID.",
    );
  }
  const res = await fetchImpl(DEVICE_CODE_URL, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  if (!res.ok) {
    throw new DeviceFlowError(
      `GitHub device-code request failed: ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as RawDeviceCode;
  if (data.error) {
    throw new DeviceFlowError(
      data.error_description ?? data.error,
      data.error,
    );
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

export interface PollOptions {
  clientId: string;
  deviceCode: string;
  /** Initial poll interval in seconds (from the device-code response). */
  interval: number;
  /** Seconds until the device code expires. */
  expiresIn: number;
  fetchImpl: FetchLike;
  /** Injected delay (ms) — overridable in tests to avoid real waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Lets the caller abort an in-flight login (e.g. user closed the dialog). */
  signal?: AbortSignal;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Step 3 — poll until the user approves the request. Resolves with the OAuth
 * access token, or throws a {@link DeviceFlowError} on denial / timeout.
 *
 * Honours GitHub's polling contract: back off by 5s on `slow_down`, keep
 * waiting on `authorization_pending`, and stop on `expired_token` /
 * `access_denied`.
 */
export async function pollForToken(opts: PollOptions): Promise<string> {
  const {
    clientId,
    deviceCode,
    expiresIn,
    fetchImpl,
    sleep = defaultSleep,
    signal,
  } = opts;
  let interval = Math.max(1, opts.interval || 5);
  const deadline = Date.now() + expiresIn * 1000;

  while (true) {
    if (signal?.aborted) {
      throw new DeviceFlowError("Sign-in cancelled.", "cancelled");
    }
    if (Date.now() >= deadline) {
      throw new DeviceFlowError(
        "The login request expired. Please try again.",
        "expired_token",
      );
    }

    await sleep(interval * 1000);
    if (signal?.aborted) {
      throw new DeviceFlowError("Sign-in cancelled.", "cancelled");
    }

    const res = await fetchImpl(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: GRANT_TYPE,
      }),
    });
    const data = (await res.json()) as RawTokenResponse;

    if (data.access_token) {
      return data.access_token;
    }

    switch (data.error) {
      case "authorization_pending":
        // Keep waiting at the current interval.
        break;
      case "slow_down":
        // GitHub asks us to back off; honour its suggested interval if given.
        interval = (data.interval ?? interval) + 5;
        break;
      case "expired_token":
        throw new DeviceFlowError(
          "The login request expired. Please try again.",
          "expired_token",
        );
      case "access_denied":
        throw new DeviceFlowError(
          "Access was denied on GitHub.",
          "access_denied",
        );
      default:
        throw new DeviceFlowError(
          data.error_description ?? data.error ?? "Unknown device-flow error.",
          data.error,
        );
    }
  }
}

/** Resolve the configured OAuth client id from the public build env. */
export function getClientId(): string {
  return (process.env.NEXT_PUBLIC_VERTO_GITHUB_CLIENT_ID ?? "").trim();
}
