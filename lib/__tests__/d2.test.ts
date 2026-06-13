import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("rehype-d2", () => {
  it("rewrites ```d2 fenced blocks into <d2-block>", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent("```d2\na -> b\n```\n");
    const html = renderToStaticMarkup(content);
    // Server-rendered output should NOT include a Shiki-highlighted <pre>
    expect(html).not.toContain("language-d2");
    // The D2Block client component renders a wrapper with `d2` class
    expect(html).toContain('class="d2"');
  });

  it("leaves non-d2 code blocks alone", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent("```ts\nconst x = 1;\n```\n");
    const html = renderToStaticMarkup(content);
    expect(html).toContain("<pre");
  });
});
