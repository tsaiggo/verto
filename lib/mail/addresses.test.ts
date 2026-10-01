import { describe, expect, it } from "vitest";
import { mailSender, parseMailRecipients } from "./addresses";

describe("mail addresses", () => {
  it("parses quoted names containing commas, escaped quotes, and Unicode", () => {
    expect(
      parseMailRecipients(
        '"Chen, Maya" <Maya@example.com>, "李 明" <li@example.com>; "O\\"Brien" <ob@example.com>'
      )
    ).toEqual(["maya@example.com", "li@example.com", "ob@example.com"]);
    expect(mailSender('"Chen, Maya" <Maya@example.com>')).toEqual({
      name: "Chen, Maya",
      address: "maya@example.com",
      initials: "CM",
    });
    expect(mailSender('"李 明" <li@example.com>')).toEqual({
      name: "李 明",
      address: "li@example.com",
      initials: "李明",
    });
  });

  it("handles comments and deduplicates case-insensitive addresses", () => {
    expect(parseMailRecipients("Maya (Design, team) <maya@example.com>, MAYA@example.com")).toEqual(
      ["maya@example.com"]
    );
    expect(parseMailRecipients("alex+notes@example.com")).toEqual(["alex+notes@example.com"]);
    expect(parseMailRecipients("  ")).toEqual([]);
  });

  it.each([
    "person",
    "person@",
    "person@example",
    "person@-example.com",
    "person@example..com",
    "a..b@example.com",
    "a@example.com,,b@example.com",
    '"Unclosed name <a@example.com>',
    "Name <a@example.com",
    "Name <a@example.com> extra",
    "a@example.com\r\nBcc: other@example.com",
  ])("rejects malformed recipient input: %s", (value) => {
    expect(() => parseMailRecipients(value)).toThrow("Enter valid email addresses");
  });

  it("renders names even when a provider header is missing an address", () => {
    expect(mailSender("Maya Chen")).toEqual({ name: "Maya Chen", address: "", initials: "MC" });
    expect(mailSender("")).toEqual({ name: "Unknown sender", address: "", initials: "US" });
    expect(mailSender("bob@example.com")).toEqual({
      name: "bob@example.com",
      address: "bob@example.com",
      initials: "B",
    });
  });
});
