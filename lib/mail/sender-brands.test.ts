import { describe, expect, it } from "vitest";
import { getSenderBrand, SENDER_BRANDS } from "./sender-brands";

describe("sender brands", () => {
  it.each([
    ["updates@google.com", "google"],
    ["gmail-team@google.com", "gmail"],
    ["receipt@apple.com", "apple"],
    ["account@microsoft.com", "microsoft"],
    ["notifications@github.com", "github"],
    ["team@notion.so", "notion"],
    ["team@notion.com", "notion"],
    ["orders@amazon.com", "amazon"],
    ["updates@spotify.com", "spotify"],
    ["notifications@slack.com", "slack"],
    ["no-reply@dropbox.com", "dropbox"],
  ])("matches explicit service domains: %s", (address, id) => {
    expect(getSenderBrand(address)?.id).toBe(id);
  });

  it("uses the parsed address, including case and quoted names", () => {
    expect(getSenderBrand('"Google, Notifications" <UPDATES@GOOGLE.COM>')?.id).toBe("google");
    expect(getSenderBrand("Gmail <GMAIL-TEAM@GOOGLE.COM>")?.id).toBe("gmail");
    expect(getSenderBrand("Apple (store) <receipt@apple.com>")?.id).toBe("apple");
  });

  it("matches genuine dot subdomains without confusing similar domains", () => {
    expect(getSenderBrand("news@email.apple.com")?.id).toBe("apple");
    expect(getSenderBrand("updates@notifications.mail.microsoft.com")?.id).toBe("microsoft");
    expect(getSenderBrand("hello@news.notion.so")?.id).toBe("notion");
  });

  it.each([
    "Apple <person@example.com>",
    '"accounts@google.com" <person@example.com>',
    "security@google.com.evil.example",
    "security@evilgoogle.com",
    "receipt@notapple.com",
    "account@microsoftcom.example",
    "updates@github.co",
    "notifications@github-com.example",
    "orders@amazon.example",
    "updates@goog1e.com",
    "updates@gооgle.com",
    "updates@xn--ggle-0nda.com",
  ])("does not infer a brand from names or lookalike domains: %s", (from) => {
    expect(getSenderBrand(from)).toBeUndefined();
  });

  it.each([
    "person@gmail.com",
    "gmail-team@gmail.com",
    "Gmail <person@googlemail.com>",
    "person@outlook.com",
    "person@hotmail.com",
    "person@live.com",
    "person@tenant.onmicrosoft.com",
    "person@icloud.com",
    "person@me.com",
  ])("keeps personal mailbox providers on their personal fallback: %s", (from) => {
    expect(getSenderBrand(from)).toBeUndefined();
  });

  it("limits Gmail's mark to the explicit service address", () => {
    expect(getSenderBrand("gmail-team+news@google.com")?.id).toBe("google");
    expect(getSenderBrand("gmail-team@email.google.com")?.id).toBe("google");
    expect(getSenderBrand("gmail-noreply@google.com")?.id).toBe("google");
  });

  it.each([
    "",
    "Google",
    "google.com",
    "person@google.com extra",
    "Google <person@google.com> extra",
    "Google <person@google.com",
    "person@google.com\r\nBcc: other@example.com",
    "person@google..com",
    "person@google.com.",
  ])("falls back for malformed provider headers: %s", (from) => {
    expect(getSenderBrand(from)).toBeUndefined();
  });

  it("keeps local assets deterministic and uniquely named", () => {
    expect(SENDER_BRANDS).toHaveLength(10);
    expect(new Set(SENDER_BRANDS.map((brand) => brand.id)).size).toBe(10);
    for (const brand of SENDER_BRANDS) {
      expect(brand.asset).toBe(`/mail/brands/${brand.id}.svg`);
    }
    expect(getSenderBrand("receipt@apple.com")).toBe(getSenderBrand("receipt@apple.com"));
  });
});
