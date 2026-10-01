import { describe, expect, it, vi } from "vitest";
import { mailHtmlToText } from "./html";
import { mailTextParts } from "./text-links";

describe("HTML email reading", () => {
  it("retains a button destination, image alt and decoded text without loading remote content", () => {
    const request = vi.spyOn(globalThis, "fetch");
    try {
      expect(
        mailHtmlToText(
          '<p>Account &amp; delivery</p><p><a href="https://example.com/confirm?id=42&amp;source=mail">Confirm address</a></p><p><img src="https://tracker.example/pixel" alt="Order #42"></p><script>fetch("https://tracker.example/script")</script>'
        )
      ).toBe(
        "Account & delivery\n\nConfirm address <https://example.com/confirm?id=42&source=mail>\n\nOrder #42"
      );
      expect(request).not.toHaveBeenCalled();
    } finally {
      request.mockRestore();
    }
  });

  it("preserves an empty-label link and does not duplicate a visible destination", () => {
    expect(
      mailHtmlToText(
        '<p><a href="https://example.com/read">https://example.com/read</a></p><p><a href="mailto:help@example.com"></a></p>'
      )
    ).toBe("<https://example.com/read>\n\n<mailto:help@example.com>");
  });

  it("keeps the exact destinations of adjacent links and legal punctuation inside hrefs", () => {
    const text = mailHtmlToText(
      '<a href="https://example.com/a">One</a><a href="https://example.com/b">Two</a><p><a href="https://example.com/archive)">Read</a></p><p><a href="https://example.com/don\'t?yes=true!">Quoted</a></p>'
    );
    const parts = mailTextParts(text);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/archive)",
      "https://example.com/don't?yes=true!",
    ]);
  });

  it("keeps unsafe and relative anchor labels as inert text", () => {
    expect(
      mailHtmlToText(
        '<p><a href="javascript:alert(1)">Unsafe</a></p><p><a href="data:text/html,test">Data</a></p><p><a href="/account">Relative</a></p><p><a href="https://user:password@example.com/">Credentials</a></p><img alt="&lt;script&gt;" src="cid:body-image">'
      )
    ).toBe("Unsafe\n\nData\n\nRelative\n\nCredentials\n<script>");
  });
});
