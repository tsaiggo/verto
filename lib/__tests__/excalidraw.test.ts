import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("rehype-excalidraw", () => {
  it("rewrites ```excalidraw fenced blocks into <excalidraw-block>", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      '```excalidraw\n{"elements":[],"appState":{},"files":{}}\n```\n'
    );
    const html = renderToStaticMarkup(content);
    // Server-rendered output should NOT include a Shiki-highlighted <pre>
    expect(html).not.toContain("language-excalidraw");
    // The ExcalidrawBlock client component renders a wrapper with `excalidraw` class
    expect(html).toContain('class="excalidraw"');
  });

  it("leaves non-excalidraw code blocks alone", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent("```ts\nconst x = 1;\n```\n");
    const html = renderToStaticMarkup(content);
    // Shiki should still emit a <pre> for normal languages
    expect(html).toContain("<pre");
  });
});
