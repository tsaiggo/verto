// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/components/integrations/use-onboarding-return", () => ({
  useOnboardingReturn: () => false,
}));

import SettingsView from "@/components/settings/SettingsView";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let root: Root | null = null;

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  });
}

async function renderAppearance() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(
      createElement(SettingsView, {
        initialSection: "appearance",
        source: { kind: "local", name: "Local Library", label: "Local library" },
        version: "0.1.1",
      })
    )
  );
  return host;
}

beforeEach(() => {
  installStorage();
  toastError.mockReset();
  document.documentElement.classList.remove("dark");
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.documentElement.classList.remove("dark");
  document.body.replaceChildren();
});

describe("SettingsView appearance persistence", () => {
  it("shows the durable initial choice and reacts to external theme changes", async () => {
    window.localStorage.setItem("theme", "dark");
    const host = await renderAppearance();

    expect(host.querySelector<HTMLInputElement>("#theme-dark")?.checked).toBe(true);
    window.localStorage.setItem("theme", "light");
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
    });
    expect(host.querySelector<HTMLInputElement>("#theme-light")?.checked).toBe(true);
  });

  it("keeps the durable choice and reports a true theme write failure", async () => {
    const host = await renderAppearance();
    window.localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };

    await act(async () => host.querySelector<HTMLInputElement>("#theme-dark")?.click());

    expect(toastError).toHaveBeenCalledWith("Couldn't save the appearance setting");
    expect(host.querySelector<HTMLInputElement>("#theme-system")?.checked).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#theme-dark")?.checked).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("accepts a theme choice that applied before a secondary error", async () => {
    const host = await renderAppearance();
    const apply = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = (key, value) => {
      apply(key, value);
      throw new Error("mirror failed");
    };

    await act(async () => host.querySelector<HTMLInputElement>("#theme-dark")?.click());

    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(host.querySelector<HTMLInputElement>("#theme-dark")?.checked).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });
});
