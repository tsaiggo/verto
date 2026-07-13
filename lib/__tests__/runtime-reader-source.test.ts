import { describe, expect, it } from "vitest";
import { runtimeFileLabel, stripRuntimeTitleHeading } from "@/lib/runtime-reader-source";

describe("stripRuntimeTitleHeading", () => {
  it("removes a leading H1 represented by the reader masthead", () => {
    expect(stripRuntimeTitleHeading("# Product Guide\n\n## Start here\nBody")).toBe(
      "## Start here\nBody"
    );
  });

  it("preserves frontmatter while removing the first body H1", () => {
    expect(
      stripRuntimeTitleHeading("---\ntitle: Product Guide\n---\n\n# Product Guide\n\nBody")
    ).toBe("---\ntitle: Product Guide\n---\n\nBody");
  });

  it("leaves documents without a leading H1 unchanged", () => {
    const source = "Intro paragraph\n\n## Details";
    expect(stripRuntimeTitleHeading(source)).toBe(source);
  });
});

describe("runtimeFileLabel", () => {
  it("turns a browser-local opaque ID into a readable relative path", () => {
    expect(
      runtimeFileLabel(
        "browser-local:Product%20Notes/guides/product-guide.md",
        "Product Guide",
        ".md"
      )
    ).toBe("guides/product-guide.md");
  });

  it("shortens an absolute local path without losing its parent context", () => {
    expect(runtimeFileLabel("/Users/me/notes/product-guide.md", "Product Guide", ".md")).toBe(
      "notes/product-guide.md"
    );
  });
});
