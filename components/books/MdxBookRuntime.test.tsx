import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagedBookRuntime } from "./MdxBookRuntime";

describe("managed book render selection", () => {
  it("opens portable MDX in an unmanaged desktop editor without waiting for an absent article ID", () => {
    const source = '---\nvertoBookId: "book-123"\n---\n# Chapter';
    const html = renderToStaticMarkup(
      <ManagedBookRuntime source={source}>Portable chapter preview</ManagedBookRuntime>
    );
    expect(html).toBe("Portable chapter preview");
  });
  it("does not block ordinary managed documents that include a book metadata example", () => {
    const source = "# YAML reference\n```yaml\nvertoBookId: example\n```";
    const html = renderToStaticMarkup(
      <ManagedBookRuntime articleId="ordinary" source={source}>
        Ordinary preview
      </ManagedBookRuntime>
    );
    expect(html).toBe("Ordinary preview");
  });
  it("waits for actual managed book resources before rendering its content", () => {
    const source = '---\nvertoBookId: "book-123"\n---\n# Chapter';
    const html = renderToStaticMarkup(
      <ManagedBookRuntime articleId="chapter" source={source}>
        Content requiring local images
      </ManagedBookRuntime>
    );
    expect(html).toContain("Opening book resources");
    expect(html).not.toContain("Content requiring local images");
  });
});
