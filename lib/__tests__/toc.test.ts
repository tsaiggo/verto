import { describe, it, expect } from "vitest";
import { extractTOC } from "@/lib/toc";

describe("extractTOC", () => {
  it("extracts h2 and h3 by default", () => {
    const md = `# Title\n## Section\n### Subsection\n#### Skipped`;
    const toc = extractTOC(md);
    expect(toc).toEqual([
      { id: "section", text: "Section", level: 2 },
      { id: "subsection", text: "Subsection", level: 3 },
    ]);
  });

  it("honors maxDepth = 4", () => {
    const md = `## A\n### B\n#### C\n##### D`;
    const toc = extractTOC(md, { maxDepth: 4 });
    expect(toc.map((t) => t.level)).toEqual([2, 3, 4]);
  });

  it("honors minDepth = 3", () => {
    const md = `## Skipped\n### Kept\n#### KeptToo`;
    const toc = extractTOC(md, { minDepth: 3, maxDepth: 4 });
    expect(toc.map((t) => t.text)).toEqual(["Kept", "KeptToo"]);
  });

  it("skips headings inside fenced code blocks", () => {
    const md = `## Real\n\n\`\`\`md\n## Fake\n\`\`\`\n\n## AlsoReal`;
    const toc = extractTOC(md);
    expect(toc.map((t) => t.text)).toEqual(["Real", "AlsoReal"]);
  });

  it("skips headings inside HTML comments", () => {
    const md = `## Real\n<!--\n## Hidden\n-->\n## AlsoReal`;
    const toc = extractTOC(md);
    expect(toc.map((t) => t.text)).toEqual(["Real", "AlsoReal"]);
  });

  it("returns empty array when minDepth > maxDepth", () => {
    expect(extractTOC("## A", { minDepth: 5, maxDepth: 2 })).toEqual([]);
  });

  it("clamps absurd depth values", () => {
    const md = `# Title\n## Section`;
    expect(extractTOC(md, { minDepth: 0 })).toEqual([
      { id: "title", text: "Title", level: 1 },
      { id: "section", text: "Section", level: 2 },
    ]);
  });

  it("strips trailing closing # marks (ATX style)", () => {
    const md = `## Hello ##`;
    const toc = extractTOC(md);
    expect(toc).toEqual([{ id: "hello", text: "Hello", level: 2 }]);
  });

  it("preserves non-ASCII (CJK) characters in ids to match rehype-slug", () => {
    const md = `## 介绍\n### Hello 你好`;
    const toc = extractTOC(md);
    expect(toc).toEqual([
      { id: "介绍", text: "介绍", level: 2 },
      { id: "hello-你好", text: "Hello 你好", level: 3 },
    ]);
  });
  it("matches rehype-slug's unique IDs for repeated headings", () => {
    expect(extractTOC("## Overview\n\n## Overview")).toEqual([
      { id: "overview", text: "Overview", level: 2 },
      { id: "overview-1", text: "Overview", level: 2 },
    ]);
  });

  it("uses converted EPUB anchors and clean literal titles in the reading outline", () => {
    const source = `---
title: "First chapter"
vertoBookId: "11111111-1111-4111-8111-111111111111"
---
# <span id="epub-001-intro" /> First chapter

## <span id="epub-001-observations" /> Field observations

### <span id="epub-001-literals" /> &#x69;mport \\{value\\} &amp; &lt;Plain&gt; \\#

## Field observations`;
    expect(extractTOC(source)).toEqual([
      { id: "epub-001-observations", text: "Field observations", level: 2 },
      { id: "epub-001-literals", text: "import {value} & <Plain> #", level: 3 },
      { id: "field-observations-1", text: "Field observations", level: 2 },
    ]);
  });

  it("ignores generated-looking headings inside fenced code and HTML comments", () => {
    const source = `\`\`\`mdx
## <span id="epub-001-code" /> Example only
\`\`\`
<!--
## <span id="epub-001-comment" /> Hidden
-->
## <span id="epub-001-real" /> Real section ##`;
    expect(extractTOC(source)).toEqual([{ id: "epub-001-real", text: "Real section", level: 2 }]);
  });

  it("preserves ordinary headings and arbitrary inline spans", () => {
    const source = '## Literal \\{value\\}\n## <span id="manual-anchor" /> Manual section';
    expect(extractTOC(source).map((item) => item.text)).toEqual([
      "Literal \\{value\\}",
      '<span id="manual-anchor" /> Manual section',
    ]);
  });
});
