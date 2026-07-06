import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("Shiki code block colors", () => {
  it("maps both light and dark Shiki CSS variables in global styles", async () => {
    const css = await fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf-8");

    const lightTokenRule =
      css.match(/\.shiki,\s*\.shiki span\s*{(?<body>[^}]*)}/s)?.groups?.body ?? "";
    const darkTokenRule =
      css.match(/html\.dark \.shiki,\s*html\.dark \.shiki span\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";

    expect(css).toMatch(/\.shiki\s*{[^}]*background-color:\s*var\(--shiki-light-bg\)/s);
    expect(css).toMatch(/html\.dark \.shiki\s*{[^}]*background-color:\s*var\(--shiki-dark-bg\)/s);

    expect(lightTokenRule).toMatch(/color:\s*var\(--shiki-light\)/);
    expect(lightTokenRule).not.toMatch(/background-color:/);
    expect(css).toMatch(
      /\.shiki,\s*\.shiki span\s*{[^}]*font-style:\s*var\(--shiki-light-font-style\)/s
    );
    expect(darkTokenRule).toMatch(/color:\s*var\(--shiki-dark\)/);
    expect(darkTokenRule).not.toMatch(/background-color:/);
    expect(css).toMatch(
      /html\.dark \.shiki,\s*html\.dark \.shiki span\s*{[^}]*font-style:\s*var\(--shiki-dark-font-style\)/s
    );
  });

  it("emits Shiki light and dark color variables during MDX compilation", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(`
\`\`\`ts
const answer: number = 42;
\`\`\`
`);

    const html = renderToStaticMarkup(content);

    expect(html).toContain('class="shiki');
    expect(html).toContain("--shiki-light:");
    expect(html).toContain("--shiki-dark:");
  }, 15000);
});
