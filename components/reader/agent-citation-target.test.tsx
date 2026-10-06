// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { documentBlocks } from "@/lib/agent-content/blocks";
import { contentVersion } from "@/lib/agent-content/identity";
import type { ContentDocument } from "@/lib/agent-content/types";
import { findAgentCitationTarget } from "./agent-citation-target";

async function sourceBlocks(source: string) {
  const version = await contentVersion(source);
  const doc: ContentDocument = {
    id: "test",
    title: "Test",
    href: "/read/local?document=test",
    version,
    format: "md",
    draft: false,
    tags: [],
    sourceLabel: "test",
  };
  return { version, blocks: documentBlocks(doc, source) };
}

describe("Agent citation locating", () => {
  it("locates a source heading displayed in the document masthead", async () => {
    document.body.innerHTML =
      "<section><header data-page-identity><h1>Notebook</h1></header><article data-article><p>Body.</p></article></section>";
    const source = "# Notebook\n\nBody.";
    const { version, blocks } = await sourceBlocks(source);
    expect(
      findAgentCitationTarget(
        document.querySelector("section")!,
        blocks[0].citation,
        source,
        version
      )
    ).toBe(document.querySelector("h1"));
  });

  it("matches formatted paragraphs and focuses only article content", async () => {
    document.body.innerHTML =
      "<aside><p>Useful evidence.</p></aside><section><article data-article><p>Useful <strong>evidence.</strong></p></article></section>";
    const source = "Useful **evidence.**";
    const { version, blocks } = await sourceBlocks(source);
    const target = findAgentCitationTarget(
      document.querySelector("section")!,
      blocks[0].citation,
      source,
      version
    );
    expect(target).toBe(document.querySelector("article p"));
  });

  it("distinguishes duplicate paragraphs by the verified source block", async () => {
    document.body.innerHTML =
      "<section><article data-article><p>Same passage.</p><p>Same passage.</p></article></section>";
    const source = "Same passage.\n\nSame passage.";
    const { version, blocks } = await sourceBlocks(source);
    const root = document.querySelector("section")!;
    expect(findAgentCitationTarget(root, blocks[1].citation, source, version)).toBe(
      document.querySelectorAll("p")[1]
    );
    expect(findAgentCitationTarget(root, blocks[1].citation, source, "older")).toBeNull();
  });

  it("does not accept a forged excerpt or highlight an unrelated navigation element", async () => {
    document.body.innerHTML =
      "<section><nav><p>Navigation secret.</p></nav><article data-article><p>Real passage.</p></article></section>";
    const source = "Real passage.";
    const { version, blocks } = await sourceBlocks(source);
    const root = document.querySelector("section")!;
    expect(
      findAgentCitationTarget(
        root,
        { ...blocks[0].citation, excerpt: "Navigation secret." },
        source,
        version
      )
    ).toBeNull();
    expect(
      findAgentCitationTarget(root, { ...blocks[0].citation, blockId: "forged" }, source, version)
    ).toBeNull();
  });

  it("locates a table citation when the renderer emits adjacent cells without whitespace", async () => {
    const source = "| Feature | Value |\n| --- | --- |\n| Local **files** | Portable |";
    document.body.innerHTML =
      "<section><article data-article><table><thead><tr><th>Feature</th><th>Value</th></tr></thead><tbody><tr><td>Local <strong>files</strong></td><td>Portable</td></tr></tbody></table></article></section>";
    const { version, blocks } = await sourceBlocks(source);
    expect(blocks[0].text).toBe("Feature Value Local files Portable");
    expect(
      findAgentCitationTarget(
        document.querySelector("section")!,
        blocks[0].citation,
        source,
        version
      )
    ).toBe(document.querySelector("table"));
  });

  it("locates a list citation while preserving inline word boundaries", async () => {
    const source = "- One **bold**word\n- Two items";
    document.body.innerHTML =
      "<section><article data-article><ul><li>One <strong>bold</strong>word</li><li>Two items</li></ul></article></section>";
    const { version, blocks } = await sourceBlocks(source);
    expect(blocks[0].text).toBe("One boldword Two items");
    expect(
      findAgentCitationTarget(
        document.querySelector("section")!,
        blocks[0].citation,
        source,
        version
      )
    ).toBe(document.querySelector("ul"));
  });

  it("locates a paragraph citation across a Markdown hard line break", async () => {
    const source = "A hard break  \nkeeps separate words.";
    document.body.innerHTML =
      "<section><article data-article><p>A hard break<br>keeps separate words.</p></article></section>";
    const { version, blocks } = await sourceBlocks(source);
    expect(blocks[0].text).toBe("A hard break keeps separate words.");
    expect(
      findAgentCitationTarget(
        document.querySelector("section")!,
        blocks[0].citation,
        source,
        version
      )
    ).toBe(document.querySelector("p"));
  });
});
