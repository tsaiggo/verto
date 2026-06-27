import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { renderToStaticMarkup } from "react-dom/server";

describe("compileMDXContent helper", () => {
  it("exists and is exported from lib/mdx", async () => {
    const mod = await import("@/lib/mdx");
    expect(typeof mod.compileMDXContent).toBe("function");
  });

  it("renders open Accordion content inside AccordionGroup through the MDX pipeline", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(`
<AccordionGroup>
  <Accordion title="First panel" defaultOpen>First body</Accordion>
  <Accordion title="Second panel">Second body</Accordion>
</AccordionGroup>
`);

    const html = renderToStaticMarkup(content);

    expect(html).toContain("First panel");
    expect(html).toContain("Second panel");
    expect(html).toContain("First body");
  });

  it("renders active Tab content inside Tabs through the MDX pipeline", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(`
<Tabs defaultValue="usage">
  <Tab label="Install">npm install verto</Tab>
  <Tab label="Usage">Run the reader</Tab>
</Tabs>
`);

    const html = renderToStaticMarkup(content);

    expect(html).toContain("Install");
    expect(html).toContain("Usage");
    expect(html).toContain("Run the reader");
  });

  it("renders plain Markdown files with CommonMark-only syntax", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<!-- authoring note -->

# Plain Markdown

Use {braces} literally and compare values such as 2 < 5 in prose.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).toContain("Plain Markdown");
    expect(html).toContain("Use {braces} literally");
    expect(html).toContain("2 &lt; 5");
  });

  it("preserves raw HTML elements in plain Markdown files", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<h1 align="center">Verto Knowledge</h1>

<p align="center">
  <img src="https://example.com/badge.svg" alt="Badge" />
</p>

<details>
<summary>More</summary>

Hidden notes.

</details>
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).toContain('<h1 align="center"');
    expect(html).toContain("Verto Knowledge");
    expect(html).toContain('src="https://example.com/badge.svg"');
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>More</summary>");
    expect(html).toContain("Hidden notes.");
  });

  it("keeps inline comments working when plain Markdown contains raw HTML", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<details>
<summary>Context</summary>

This note needs a comment[^c-1].

</details>

[^c-1]: Hidden annotation.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).toContain("<details>");
    expect(html).toContain("<summary>Context</summary>");
    expect(html).toContain("This note needs a comment");
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Show');
    expect(html).toContain("💬");
    expect(html).not.toContain("Cannot compile inlineCommentRef node");
  });
});

describe("compileMDXContent strips the leading title heading", () => {
  it("drops a leading H1 that duplicates the page title but keeps later headings", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `# Page Title

Body paragraph.

## Kept Section

Section body.
`,
      { format: "mdx" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("Page Title");
    expect(html).toContain("Body paragraph.");
    expect(html).toContain("Kept Section");
  });
});

describe("compileMDXContent neutralizes UI-breaking raw HTML in plain Markdown", () => {
  it("neutralizes a global <style> block so it cannot blank the page", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `## Heading

<style>:root, body, * { display: none !important }</style>

Visible paragraph.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("<style");
    expect(html).toContain("Heading");
    expect(html).toContain("Visible paragraph.");
  });

  it("neutralizes <script> tags so they cannot execute", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<script>alert(1)</script>

Safe content.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("<script");
    expect(html).toContain("Safe content.");
  });

  it("neutralizes <iframe> embeds", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<iframe src="https://evil.example"></iframe>

After iframe.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("<iframe");
    expect(html).toContain("After iframe.");
  });

  it("does not let an unterminated <style> swallow following HTML in the same block", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<div>
<style>
<p>Survives.</p>
</div>
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("<style");
    expect(html).toContain("Survives.");
  });

  it("strips a document-level <base> tag that would rewrite every relative link", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<base href="https://evil.example/">

After base.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("<base");
    expect(html).toContain("After base.");
  });

  it("strips injected <link> stylesheets", async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<link rel="stylesheet" href="https://evil.example/x.css">

After link.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("<link");
    expect(html).toContain("After link.");
  });

  it('strips <meta http-equiv="refresh"> that would redirect the page', async () => {
    const { compileMDXContent } = await import("@/lib/mdx");
    const { content } = await compileMDXContent(
      `<meta http-equiv="refresh" content="0; url=https://evil.example">

After meta.
`,
      { format: "md" }
    );

    const html = renderToStaticMarkup(content);

    expect(html).not.toContain("<meta");
    expect(html).toContain("After meta.");
  });
});

describe("getDocumentBySlug", () => {
  it("returns null for nonexistent slug", async () => {
    const { getDocumentBySlug } = await import("@/lib/mdx");
    const result = await getDocumentBySlug(["nonexistent", "definitely-missing-path"]);
    expect(result).toBeNull();
  });
});

describe("gray-matter frontmatter parsing", () => {
  it("parses blog frontmatter correctly", async () => {
    const raw = await fs.readFile(
      path.join(process.cwd(), "test/fixtures/sample-blog.mdx"),
      "utf-8"
    );
    const { data } = matter(raw);
    expect(data.title).toBe("Test Blog Post");
    expect(data.date).toBe("2026-01-15"); // string, not Date
    expect(data.tags).toEqual(["test", "vitest"]);
    expect(typeof data.author).toBe("string");
  });

  it("parses doc frontmatter correctly", async () => {
    const raw = await fs.readFile(
      path.join(process.cwd(), "test/fixtures/sample-doc.mdx"),
      "utf-8"
    );
    const { data } = matter(raw);
    expect(data.title).toBe("Test Document");
    expect(data.description).toBe("A test document for vitest");
    expect(data.order).toBe(1);
  });

  it("returns empty data for missing frontmatter", async () => {
    const raw = await fs.readFile(path.join(process.cwd(), "test/fixtures/invalid.mdx"), "utf-8");
    const { data } = matter(raw);
    expect(Object.keys(data).length).toBe(0);
  });

  it("handles colons in quoted values", () => {
    const raw = '---\ntitle: "Building Verto: A Guide"\n---\nContent';
    const { data } = matter(raw);
    expect(data.title).toBe("Building Verto: A Guide");
  });
});
