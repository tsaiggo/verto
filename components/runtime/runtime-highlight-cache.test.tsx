// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const codeToHtml = vi.hoisted(() =>
  vi.fn((code: string, options?: unknown) => {
    void options;
    return `<pre class="shiki github-light github-dark" style="--shiki-light-bg:#fff;--shiki-dark-bg:#111"><code><span style="--shiki-light:#cf222e;--shiki-dark:#ff7b72">${code}</span></code></pre>`;
  })
);

vi.mock("@/lib/shiki", () => ({
  getHighlighter: () => Promise.resolve({ codeToHtml }),
  getShikiTransformers: () => ["shared-transformer"],
}));

import { RuntimeCodeBlock, RuntimePre } from "@/components/runtime/runtime-components";

function codeBlock(code: string, lang: string) {
  return createElement("code", { className: `language-${lang}` }, code);
}

async function flushHighlightEffect() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderPre(code: string, lang: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(RuntimePre, null, codeBlock(code, lang)));
  });
  await flushHighlightEffect();
  const html = host.innerHTML;
  act(() => root.unmount());
  host.remove();
  return html;
}

async function renderRuntimeCodeBlock(code: string, lang: string, meta: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(RuntimeCodeBlock, { code, language: lang, meta }));
  });
  await flushHighlightEffect();
  const html = host.innerHTML;
  act(() => root.unmount());
  host.remove();
  return html;
}

describe("RuntimePre Shiki highlight cache", () => {
  beforeEach(() => {
    codeToHtml.mockClear();
  });

  it("highlights identical code blocks only once across renders", async () => {
    const first = await renderPre("const x = 1;", "ts");
    expect(first).toContain("const x = 1;");
    expect(first).toContain('class="shiki github-light github-dark"');
    expect(first).toContain("--shiki-light-bg");
    expect(first).toContain("--shiki-light:#cf222e");
    expect(codeToHtml).toHaveBeenCalledTimes(1);

    // A second, identical block reuses the cached HTML — no extra highlight.
    await renderPre("const x = 1;", "ts");
    expect(codeToHtml).toHaveBeenCalledTimes(1);

    // A different block triggers exactly one new highlight.
    await renderPre("const y = 2;", "ts");
    expect(codeToHtml).toHaveBeenCalledTimes(2);
  });

  it("passes fence metadata and shared transformers into Shiki", async () => {
    await renderRuntimeCodeBlock("const titled = true;", "ts", 'title="demo.ts" showLineNumbers');

    const options = codeToHtml.mock.calls[0]?.[1] as {
      meta?: { __raw?: string };
      transformers?: unknown[];
    };
    expect(options.meta?.__raw).toBe('title="demo.ts" showLineNumbers');
    expect(options.transformers).toEqual(["shared-transformer"]);
  });
});
