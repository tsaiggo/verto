import { afterEach, describe, expect, it, vi } from "vitest";
import { mailBlob, mailJson, mailPost } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("mail HTTP helpers", () => {
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
