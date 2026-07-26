// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AssistantSourceEvidence } from "@/components/assistant/AssistantSourceEvidence";
import { AssistantAnswerMarkdown } from "@/components/assistant/AssistantAnswerMarkdown";
import {
  focusAssistantSource,
  parseAssistantSources,
} from "@/components/assistant/source-citations";
import { buildSystemPrompt, readDocContextFromDom, type DocContext } from "@/lib/ai/context";

function currentPageDocument(): Document {
  const doc = document.implementation.createHTMLDocument("Reader");
  doc.body.innerHTML = `
    <article data-article>
      <h1 id="introduction">Introduction</h1>
      <p>Verto keeps ordinary Markdown files on your device.</p>
      <h2 id="sync">Sync</h2>
      <p>OneDrive can synchronize the folder between devices.</p>
    </article>
  `;
  return doc;
}

describe("current-page source anchors", () => {
  it("assigns stable heading and paragraph anchors across repeated reads", () => {
    const doc = currentPageDocument();
    const first = readDocContextFromDom(doc);
    const second = readDocContextFromDom(doc);

    expect(first.sourceAnchors).toEqual(second.sourceAnchors);
    expect(first.sourceAnchors).toHaveLength(4);
    expect(first.sourceAnchors?.[0]).toMatchObject({
      targetId: "introduction",
      label: "Introduction",
      text: "Introduction",
    });
    expect(first.sourceAnchors?.[1]?.label).toBe("Introduction · paragraph 1");

    const paragraph = doc.querySelector("p");
    expect(paragraph?.id).toBe(first.sourceAnchors?.[1]?.targetId);
    expect(paragraph?.getAttribute("data-source-anchor")).toBe(first.sourceAnchors?.[1]?.id);
  });

  it("lists the exact parseable citation contract and only included source ids", () => {
    const ctx = readDocContextFromDom(currentPageDocument(), 80);
    const prompt = buildSystemPrompt(ctx);

    expect(prompt).toContain("SOURCE CITATION CONTRACT");
    expect(prompt).toContain("[[source:SOURCE_ID]]");
    expect(prompt).toContain(`id="${ctx.sourceAnchors?.[0]?.id}"`);
    expect(prompt).toContain("Use only SOURCE_ID values listed below");
    expect(ctx.truncated).toBe(true);
    expect(ctx.sourceAnchors?.every((source) => prompt.includes(source.id))).toBe(true);
  });

  it("keeps non-paragraph article text in the general document body", () => {
    const doc = currentPageDocument();
    doc
      .querySelector("article")
      ?.insertAdjacentHTML("beforeend", "<ul><li>Conflict copies remain ordinary files.</li></ul>");

    expect(readDocContextFromDom(doc).body).toContain("Conflict copies remain ordinary files.");
  });
});

describe("Assistant source validation", () => {
  const context: DocContext = {
    sourceAnchors: [
      {
        id: "source-p-valid",
        targetId: "paragraph-valid",
        label: "Introduction · paragraph 1",
        text: "Grounded passage.",
      },
    ],
  };

  it("keeps only citations present in the current page context", () => {
    const parsed = parseAssistantSources(
      "Supported claim. [[source:source-p-valid]] Unsupported claim. [[source:source-p-old]] Repeat. [[source:source-p-valid]]",
      context
    );

    expect(parsed.content).toBe(
      "Supported claim. [1](#verto-source-citation-1) Unsupported claim.  Repeat. [1](#verto-source-citation-1)"
    );
    expect(parsed.citations).toEqual([
      {
        ...context.sourceAnchors?.[0],
        index: 1,
      },
    ]);
    expect(parsed.invalidCitationCount).toBe(1);
    expect(parsed.hasCurrentPageEvidence).toBe(true);
  });

  it("marks an answer without a valid current-page citation as unverified", () => {
    const parsed = parseAssistantSources("A general answer. [[source:source-p-other]]", context);

    expect(parsed.citations).toEqual([]);
    expect(parsed.invalidCitationCount).toBe(1);
    expect(parsed.hasCurrentPageEvidence).toBe(false);
  });

  it("renders citations as page links and an explicit no-evidence state", () => {
    const citation = {
      ...context.sourceAnchors![0],
      index: 1,
    };
    const cited = renderToStaticMarkup(
      <AssistantSourceEvidence citations={[citation]} onSelect={() => undefined} />
    );
    const unsupported = renderToStaticMarkup(
      <AssistantSourceEvidence citations={[]} onSelect={() => undefined} />
    );

    expect(cited).toContain('href="#paragraph-valid"');
    expect(cited).toContain("Evidence from this page");
    expect(unsupported).toContain("No supporting passage was found on the current page.");
  });

  it("renders an inline citation as a source-jump link", () => {
    const citation = {
      ...context.sourceAnchors![0],
      index: 1,
    };
    const answer = renderToStaticMarkup(
      <AssistantAnswerMarkdown
        content="Grounded claim. [1](#verto-source-citation-1)"
        citations={[citation]}
        onSelect={() => undefined}
      />
    );

    expect(answer).toContain('class="assistant-inline-citation"');
    expect(answer).toContain('href="#paragraph-valid"');
    expect(answer).toContain("Go to Introduction");
  });

  it("scrolls and focuses only a matching anchor inside the current article", () => {
    document.body.innerHTML = currentPageDocument().body.innerHTML;
    const doc = document;
    const contextWithAnchors = readDocContextFromDom(doc);
    const citation = {
      ...contextWithAnchors.sourceAnchors![1],
      index: 1,
    };
    const target = doc.querySelector<HTMLElement>(`[data-source-anchor="${citation.id}"]`);
    const scrollIntoView = vi.fn();
    if (target) target.scrollIntoView = scrollIntoView;

    expect(focusAssistantSource(citation, doc)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(doc.activeElement).toBe(target);

    expect(
      focusAssistantSource({ id: "source-p-missing", targetId: "outside-current-article" }, doc)
    ).toBe(false);
  });

  it("uses non-animated scrolling when reduced motion is requested", () => {
    document.body.innerHTML = currentPageDocument().body.innerHTML;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const contextWithAnchors = readDocContextFromDom(document);
    const citation = {
      ...contextWithAnchors.sourceAnchors![1],
      index: 1,
    };
    const target = document.querySelector<HTMLElement>(`[data-source-anchor="${citation.id}"]`);
    const scrollIntoView = vi.fn();
    if (target) target.scrollIntoView = scrollIntoView;

    expect(focusAssistantSource(citation, document)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  it("relocates a stale citation by its saved excerpt", () => {
    document.body.innerHTML = currentPageDocument().body.innerHTML;
    const target = document.querySelectorAll<HTMLElement>("article p")[1];
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    expect(
      focusAssistantSource(
        {
          id: "source-p-stale",
          targetId: "paragraph-that-moved",
          text: "OneDrive can synchronize the folder between devices.",
        },
        document
      )
    ).toBe(true);
    expect(document.activeElement).toBe(target);
    expect(target.dataset.agentSourceActive).toBe("true");
  });
});
