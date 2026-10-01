import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeGoogleMail } from "./google-auth";

const READ = "https://www.googleapis.com/auth/gmail.readonly";
const SEND = "https://www.googleapis.com/auth/gmail.send";
const UPDATE = "https://www.googleapis.com/auth/gmail.modify";

function identity(response: object) {
  const init = vi.fn((config: { callback: (value: object) => void }) => ({
    requestAccessToken: vi.fn(() => config.callback(response)),
  }));
  vi.stubGlobal("window", { google: { accounts: { oauth2: { initTokenClient: init } } } });
  return init;
}

afterEach(() => vi.unstubAllGlobals());

describe("Gmail token permission responses", () => {
  it.each([
    [UPDATE, `${UPDATE} ${SEND}`, "read"],
    [UPDATE, `${READ} ${UPDATE}`, "send"],
    [SEND, `${READ} ${SEND}`, "update"],
  ])(
    "identifies the actual missing permission during %s expansion",
    async (scope, granted, missing) => {
      identity({ access_token: "secret-token", scope: granted, expires_in: 3600 });
      await expect(
        authorizeGoogleMail({ clientId: "client", scope, requiredScopes: [READ, SEND, UPDATE] })
      ).rejects.toThrow(`Gmail ${missing} permission was not granted.`);
    }
  );

  it.each(["access_denied", "server_error"])(
    "rejects OAuth %s even if a token is present, without exposing response details",
    async (error) => {
      identity({
        access_token: "secret-token",
        scope: `${READ} ${UPDATE}`,
        error,
        error_description: "secret-token",
      });
      await expect(
        authorizeGoogleMail({ clientId: "client", scope: UPDATE, requiredScopes: [READ, UPDATE] })
      ).rejects.toThrow(
        error === "access_denied"
          ? "Gmail update permission was not granted."
          : "Google sign-in was cancelled or could not be completed."
      );
    }
  );

  it("binds incremental consent to the account and returns only an in-memory expiring token", async () => {
    const init = identity({
      access_token: "token",
      scope: `${READ} ${UPDATE} ${SEND}`,
      expires_in: 120,
    });
    const started = Date.now();
    const result = await authorizeGoogleMail({
      clientId: "client",
      scope: UPDATE,
      requiredScopes: [READ, UPDATE, SEND],
      accountAddress: "alice@gmail.com",
      prompt: "consent",
    });
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: UPDATE,
        include_granted_scopes: true,
        login_hint: "alice@gmail.com",
      })
    );
    expect(result).toEqual({ token: "token", expiresAt: expect.any(Number) });
    expect(result.expiresAt).toBeGreaterThanOrEqual(started + 60000);
    expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 60000);
    expect(init.mock.results[0].value.requestAccessToken).toHaveBeenCalledWith({
      prompt: "consent",
    });
  });
});
