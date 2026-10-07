import { describe, expect, it } from "vitest";
import { deriveDescription } from "@/lib/content-source/metadata";
import { articleDescription } from "@/lib/browser-articles";

describe("article descriptions", () => {
  it("prefers explicit descriptions and keeps the reader dek explicit", () => {
    expect(
      deriveDescription({ description: "  A short introduction.  " }, "Body paragraph.")
    ).toEqual({
      description: "A short introduction.",
      dek: "A short introduction.",
    });
    expect(deriveDescription({}, "# Title\n\nFirst **real** paragraph.")).toEqual({
      description: "First real paragraph.",
      dek: undefined,
    });
  });

  it("reads safe scalar and folded descriptions without evaluating YAML", () => {
    expect(articleDescription('---\ndescription: "阅读笔记：重新理解设计"\n---\n\n正文。')).toBe(
      "阅读笔记：重新理解设计"
    );
    expect(
      articleDescription("---\ndescription: >-\n  First line\n  second line\n---\n\nBody.")
    ).toBe("First line second line");
    expect(
      articleDescription(
        "---\ndescription: !!js/function function() { return 'code'; }\n---\n\nReal prose."
      )
    ).toBe("Real prose.");
  });

  it("extracts a real paragraph after either kind of code fence, headings, and a cover", () => {
    const source =
      "# Article\n\n~~~js\nconst unfinished = {\n~~~\n\n```md\n# Code heading\n```\n\n![Cover](cover.png)\n\nThis is **useful prose** with a [link](https://example.com).\nIt continues on the next line.\n\nSecond paragraph.";
    expect(articleDescription(source)).toBe(
      "This is useful prose with a link. It continues on the next line."
    );
  });

  it("keeps CJK prose from HTML while excluding headings, scripts, and comments", () => {
    expect(
      articleDescription(
        "<h1>标题</h1><script>secretCode()</script><!-- hidden --><p>这是<strong>真正的正文</strong>，包含 &amp; 符号。</p><p>第二段。</p>"
      )
    ).toBe("这是真正的正文，包含 & 符号。");
  });

  it("skips HTML code blocks before looking for prose", () => {
    expect(
      articleDescription('<pre><code>const secret = "hidden";</code></pre><p>Actual prose.</p>')
    ).toBe("Actual prose.");
  });

  it("excludes MDX modules, nested expressions, component attributes, and code-only content", () => {
    const source =
      'import { Widget } from "./widget";\n\nexport const metadata = { secret: "hidden" };\n\n<Widget data={{ label: "do not show" }} />\n\n{(() => { const nested = { secret: "hidden" }; return nested; })()}\n\n<Callout tone="info">可见的正文，<strong>保留中文</strong>。</Callout>\n\nMore prose.';
    expect(articleDescription(source)).toBe("可见的正文，保留中文。");
    expect(
      articleDescription(
        "# Title\n\n```js\nconst value = 'hidden';\n```\n\n{callFunction()}\n\n<Widget />"
      )
    ).toBeUndefined();
  });

  it("limits previews without cutting an emoji in half", () => {
    const description = articleDescription("😀".repeat(220));
    expect(Array.from(description ?? "")).toHaveLength(200);
    expect(description).toBe(`${"😀".repeat(199)}…`);
  });
});
