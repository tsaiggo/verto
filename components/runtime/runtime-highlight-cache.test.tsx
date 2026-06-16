// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const codeToHtml = vi.hoisted(() =>
  vi.fn((code: string) => `<pre class="shiki"><code>${code}</code></pre>`)
);

vi.mock("@/lib/shiki", () => ({
  getHighlighter: () => Promise.resolve({ codeToHtml }),
}));

import { RuntimePre } from "@/components/runtime/runtime-components";

function codeBlock(code: string, lang: string) {
  return createElement("code", { className: `language-${lang}` }, code);
}

async function renderPre(code: string, lang: string) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(RuntimePre, null, codeBlock(code, lang)));
  });
  // Flush the highlight effect's microtasks.
  await act(async () => {
    await Promise.resolve();
  });
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
    expect(codeToHtml).toHaveBeenCalledTimes(1);

    // A second, identical block reuses the cached HTML — no extra highlight.
    await renderPre("const x = 1;", "ts");
    expect(codeToHtml).toHaveBeenCalledTimes(1);

    // A different block triggers exactly one new highlight.
    await renderPre("const y = 2;", "ts");
    expect(codeToHtml).toHaveBeenCalledTimes(2);
  });
});
