// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import HomeCommandComposer from "./HomeCommandComposer";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderComposer() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(HomeCommandComposer, { sourceLabel: "Local library" }));
  });

  return { host, root };
}

describe("HomeCommandComposer", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("offers an accessible workspace search and the supporting Verto actions", async () => {
    const { host, root } = await renderComposer();
    const form = host.querySelector<HTMLFormElement>('form[role="search"]');
    const input = host.querySelector<HTMLInputElement>('input[name="q"]');
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]');
    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>("a"));

    expect(host.querySelector("h2")?.textContent).toBe("Search or ask your workspace");
    expect(form?.getAttribute("action")).toBe("/search");
    expect(form?.method.toLowerCase()).toBe("get");
    expect(input?.type).toBe("search");
    expect(input?.placeholder).toBe("Search your workspace");
    expect(input?.labels?.[0]?.textContent?.trim()).toBe("Search your workspace");
    expect(submit?.getAttribute("aria-label")).toBe("Search workspace");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/integrations",
      "/integrations",
      "/agent",
    ]);
    expect(links[0]?.getAttribute("aria-label")).toBe("Add or manage content sources");
    expect(links[1]?.getAttribute("aria-label")).toBe("Review source access");
    expect(host.getAttribute("role")).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Library ready");
    expect(host.textContent).toContain("Local library");
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Voice input unavailable"]')?.disabled
    ).toBe(true);

    act(() => root.unmount());
  });
});
