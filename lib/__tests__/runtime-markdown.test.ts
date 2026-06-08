import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RuntimeMarkdown } from "@/components/runtime/RuntimeMarkdown";

describe("RuntimeMarkdown", () => {
  it("renders common Markdown without executing raw HTML", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeMarkdown, {
        source: `# Runtime README

Hello **Verto**.

- One
- Two

<img src=x onerror="alert(1)">

\`inline\`

\`\`\`ts
const ok = true
\`\`\`
`,
      }),
    );

    expect(html).toContain("Runtime README");
    expect(html).toContain("<strong>Verto</strong>");
    expect(html).toContain("<li>One</li>");
    expect(html).toContain("<code>inline</code>");
    expect(html).toContain("const ok = true");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
  });

  it("does not render javascript links as anchors", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeMarkdown, {
        source: "[safe](https://example.com) [bad](javascript:alert(1))",
      }),
    );

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("bad");
    expect(html).not.toContain("javascript:alert");
  });
});
