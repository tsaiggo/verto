import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";

describe("RuntimeDocument", () => {
  it("renders common Markdown without executing raw HTML", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "md",
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
      })
    );

    expect(html).toContain("Runtime README");
    expect(html).toContain("<strong>Verto</strong>");
    expect(html).toContain("<li>One</li>");
    expect(html).toContain("<code");
    expect(html).toContain("inline</code>");
    expect(html).toContain("const ok = true");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
  });

  it("gives Markdown and MDX headings the IDs used by the runtime table of contents", () => {
    for (const format of ["md", "mdx"] as const) {
      const html = renderToStaticMarkup(
        createElement(RuntimeDocument, {
          format,
          source: "## Overview\n\n### Details\n\n## Overview",
        })
      );

      expect(html).toContain('id="overview"');
      expect(html).toContain('id="details"');
      expect(html).toContain('id="overview-1"');
    }
  });
  it("renders code block metadata in runtime Markdown", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "md",
        source: `# Code

\`\`\`ts title="demo.ts" showLineNumbers noCopy
const ok = true
\`\`\`
`,
      })
    );

    expect(html).toContain("demo.ts");
    expect(html).toContain("has-line-numbers");
    expect(html).toContain("const ok = true");
    expect(html).not.toContain("Copy code");
  });

  it("renders code block metadata in runtime MDX", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `# Code

\`\`\`ts title="demo.ts" showLineNumbers noCopy
const ok = true
\`\`\`
`,
      })
    );

    expect(html).toContain("demo.ts");
    expect(html).toContain("has-line-numbers");
    expect(html).toContain("const ok = true");
    expect(html).not.toContain("Copy code");
  });
  it("renders mermaid fenced blocks in runtime Markdown", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "md",
        source: `# Diagram

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
`,
      })
    );

    expect(html).toContain('class="mermaid"');
    expect(html).toContain("mermaid-loading");
    expect(html).not.toContain("language-mermaid");
  });

  it("renders mermaid fenced blocks in runtime MDX", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `# Diagram

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
`,
      })
    );

    expect(html).toContain('class="mermaid"');
    expect(html).not.toContain("language-mermaid");
  });
  it("renders Mermaid as an allowlisted runtime MDX component", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `<Mermaid chart="flowchart LR; A --> B" />`,
      })
    );

    expect(html).toContain('class="mermaid"');
    expect(html).not.toContain("Unknown component");
  });
  it("renders Callout content as an allowlisted runtime MDX component", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `<Callout type="tip">
  Preview-safe component content
</Callout>`,
      })
    );

    expect(html).toContain('role="note"');
    expect(html).toContain("Tip");
    expect(html).toContain("Preview-safe component content");
  });
  it("does not render javascript links as anchors", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "md",
        source: "[safe](https://example.com) [bad](javascript:alert(1))",
      })
    );

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("bad");
    expect(html).not.toContain("javascript:alert");
  });

  it("strips frontmatter before rendering runtime files", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `---
title: Hidden
---

# Visible`,
      })
    );

    expect(html).toContain("Visible");
    expect(html).not.toContain("title: Hidden");
  });

  it("renders allowlisted shadcn components in MDX without imports", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `<Button variant="outline">Open docs</Button>`,
      })
    );

    expect(html).toContain("Open docs");
    expect(html).toContain("button");
    expect(html).toContain("border");
  });

  it("keeps unknown MDX components from crashing runtime rendering", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `<SomeoneElsesChart>Revenue</SomeoneElsesChart>`,
      })
    );

    expect(html).toContain("Unknown component");
    expect(html).toContain("SomeoneElsesChart");
  });

  it("blocks MDX expressions and import declarations", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeDocument, {
        format: "mdx",
        source: `import Evil from "https://example.com/evil.js"

# Safe

{globalThis.location.href}`,
      })
    );

    expect(html).toContain("Safe");
    expect(html).not.toContain("example.com/evil");
    expect(html).not.toContain("globalThis");
  });
});
