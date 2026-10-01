import { afterEach, describe, expect, it, vi } from "vitest";
import { mailBlob, mailJson, mailPost, MailRequestError } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("mail HTTP helpers", () => {
  it.each(["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded"])(
    "keeps Gmail quota reason %s distinct from permission failure even when the provider code is numeric",
    async (reason) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            {
              error: {
                code: 403,
                errors: [{ reason, message: "secret-token" }],
                message: "secret-token",
              },
            },
            { status: 403 }
          )
        )
      );
      const error = await mailJson("https://gmail.googleapis.com/test", "secret-token").catch(
        (error) => error
      );
      expect(error).toBeInstanceOf(MailRequestError);
      if (!(error instanceof MailRequestError)) throw new Error("Expected a mail quota error.");
      expect(error).toMatchObject({ status: 403, code: reason, reason });
      expect(error.message).toContain(
        reason === "dailyLimitExceeded" ? "daily request limit" : "too many requests"
      );
      expect(error.message).not.toMatch(/reconnect|access was denied|secret-token/i);
    }
  );

  it("keeps Gmail domain policy restrictions as permission failures and Graph string codes intact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: { code: 403, errors: [{ reason: "domainPolicy" }] },
          },
          { status: 403 }
        )
      )
    );
    await expect(mailJson("https://gmail.googleapis.com/test", "token")).rejects.toMatchObject({
      status: 403,
      code: "domainPolicy",
      reason: "domainPolicy",
      message: "Mail access was denied. Check the app permission and reconnect.",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: { code: "syncStateNotFound", errors: [{ reason: "other" }] },
          },
          { status: 410 }
        )
      )
    );
    await expect(mailJson("https://graph.microsoft.com/test", "token")).rejects.toMatchObject({
      status: 410,
      code: "syncStateNotFound",
      reason: "other",
    });
  });

  it("exposes HTTP status and provider code without displaying provider error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "syncStateNotFound", message: "secret-token" } },
          { status: 410 }
        )
      )
    );
    let caught: unknown;
    try {
      await mailJson("https://graph.microsoft.com/test", "secret-token");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MailRequestError);
    expect(caught).toMatchObject({
      status: 410,
      code: "syncStateNotFound",
      message: "Mail request failed (410).",
    });
    expect(String(caught)).not.toContain("secret-token");
  });
  it("accepts an empty 202 send response and keeps bearer tokens in headers", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await mailPost("https://graph.microsoft.com/v1.0/me/sendMail", "secret-token", {
      message: { subject: 'Quote "' },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("secret-token");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret-token");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body as string)).toEqual({ message: { subject: 'Quote "' } });
  });

  it("does not expose API or transport error bodies containing tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("secret-token", { status: 403 }))
    );
    await expect(mailJson("https://gmail.googleapis.com/test", "secret-token")).rejects.toThrow(
      "Mail access was denied"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("secret-token");
      })
    );
    await expect(mailPost("https://gmail.googleapis.com/test", "secret-token", {})).rejects.toThrow(
      "Mail could not be reached"
    );
    await expect(mailBlob("https://gmail.googleapis.com/test", "secret-token")).rejects.toThrow(
      "Mail could not be reached"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("secret-token", { status: 200 }))
    );
    await expect(mailJson("https://gmail.googleapis.com/test", "secret-token")).rejects.toThrow(
      "unreadable response"
    );
  });
});
