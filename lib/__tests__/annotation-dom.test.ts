// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { articleText, rangeToOffsets } from "@/lib/annotation-dom";

function article(html: string) {
  const root = document.createElement("article");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

afterEach(() => document.body.replaceChildren());

describe("selection boundaries in rendered articles", () => {
  it("ends a whole-paragraph selection before the next heading and paragraph", () => {
    const root = article("<p>Alpha</p><h2>Details</h2><p>Beta</p>");
    const range = document.createRange();
    range.selectNodeContents(root.querySelector("p")!);
    expect(rangeToOffsets(root, range)).toEqual({ start: 0, end: 5 });
  });

  it("keeps a nested inline selection inside the selected element", () => {
    const root = article("<p>Alpha<strong>bold</strong> tail</p><p>Beta</p>");
    const range = document.createRange();
    range.selectNodeContents(root.querySelector("strong")!);
    expect(rangeToOffsets(root, range)).toEqual({ start: 5, end: 9 });
  });

  it("maps a cross-paragraph selection without including the next paragraph", () => {
    const root = article("<p>Alpha</p><p>Beta</p><p>Gamma</p>");
    const paragraphs = root.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 2);
    range.setEnd(paragraphs[1], 1);
    expect(rangeToOffsets(root, range)).toEqual({ start: 2, end: 9 });
  });

  it("keeps skipped code out of the canonical selection offsets", () => {
    const root = article("<p>Alpha</p><pre>ignored</pre><p>Beta</p><p>Gamma</p>");
    const range = document.createRange();
    range.setStart(root, 0);
    range.setEnd(root, 3);
    expect(articleText(root)).toBe("AlphaBetaGamma");
    expect(rangeToOffsets(root, range)).toEqual({ start: 0, end: 9 });
    range.selectNodeContents(root.querySelector("pre")!);
    expect(rangeToOffsets(root, range)).toBeNull();
  });

  it("preserves native character boundaries within a text node", () => {
    const root = article("<p>Alpha beta</p><p>Gamma</p>");
    const text = root.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 3);
    range.setEnd(text, 7);
    expect(rangeToOffsets(root, range)).toEqual({ start: 3, end: 7 });
  });

  it("does not turn a selection beginning outside the article into an article highlight", () => {
    const root = article("<p>Alpha</p><p>Beta</p>");
    const range = document.createRange();
    range.setStart(document.body, 0);
    range.setEnd(root, 2);
    expect(rangeToOffsets(root, range)).toBeNull();
  });
});
