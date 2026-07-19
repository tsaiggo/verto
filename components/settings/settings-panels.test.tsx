// @vitest-environment jsdom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AboutPanel, AgentPanel, AppearancePanel } from "./settings-panels";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function render(element: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("settings panels", () => {
  it("uses native radio semantics for theme selection", async () => {
    const onTheme = vi.fn();
    const { host, root } = await render(
      createElement(AppearancePanel, { theme: "light", onTheme })
    );
    const themeInputs = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="radio"][name="theme"]')
    );

    expect(themeInputs).toHaveLength(3);
    expect(themeInputs.find((input) => input.value === "light")?.checked).toBe(true);
    const darkLabel = host.querySelector<HTMLLabelElement>('label[for="theme-dark"]');
    expect(darkLabel).not.toBeNull();
    await act(async () => darkLabel?.click());
    expect(onTheme).toHaveBeenCalledWith("dark");

    act(() => root.unmount());
  });

  it("shows a setup return link when Agent settings are an onboarding detour", async () => {
    const { host, root } = await render(createElement(AgentPanel, { fromOnboarding: true }));
    const back = host.querySelector<HTMLAnchorElement>('a[href="/onboarding/ai"]');

    expect(back?.textContent).toContain("Back to setup");

    act(() => root.unmount());
  });

  it("renders the shared Verto mark with concrete version and build labels", async () => {
    const { host, root } = await render(
      createElement(AboutPanel, { version: "0.1.1", build: "Development build" })
    );

    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.textContent).toContain("0.1.1");
    expect(host.textContent).toContain("Development build");
    expect(host.textContent).not.toContain("See release metadata");
    expect(host.textContent).not.toContain("Check for updates");

    act(() => root.unmount());
  });
});
