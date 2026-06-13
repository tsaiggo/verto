import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), "utf-8");
}

const nestedMainWithMainClassPattern = /<main\b[^>]*\bclassName=["']main["']/s;

describe("accessibility primitives", () => {
  it("exposes the application main content as a focusable landmark", async () => {
    const source = await readProjectFile("components/layout/AppShellClient.tsx");

    expect(source).toContain('id="main-content"');
    expect(source).toContain("tabIndex={-1}");
  });

  it("honors reduced motion preferences for global motion primitives", async () => {
    const css = await readProjectFile("app/globals.css");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("scroll-behavior: auto");
    expect(css).toContain("transition-duration: 0.01ms");
    expect(css).toContain("animation-duration: 0.01ms");
  });

  it("keeps read route content from nesting another main landmark", async () => {
    const readPage = await readProjectFile("app/read/[[...path]]/page.tsx");
    const tagPage = await readProjectFile("app/read/tags/[tag]/page.tsx");

    expect(readPage).not.toMatch(nestedMainWithMainClassPattern);
    expect(tagPage).not.toMatch(nestedMainWithMainClassPattern);
  });

  it("detects nested main landmarks even when attributes are reformatted", () => {
    const reformatted = `<main\n  data-testid="content"\n  className="main"\n>`;

    expect(reformatted).toMatch(nestedMainWithMainClassPattern);
  });
});
