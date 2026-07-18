// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, STORAGE_KEY, type ReadingSettings } from "@/lib/reading-settings";
import ReadingPreferences from "./ReadingPreferences";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderPreferences(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ReadingPreferences)));
  return { host, root };
}

describe("ReadingPreferences", () => {
  beforeEach(() => {
    toastError.mockReset();
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
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-reading-width");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.removeAttribute("data-text-size");
    document.documentElement.removeAttribute("data-font");
    document.body.replaceChildren();
  });

  it("uses native radio controls and writes through the shared reading-settings state", async () => {
    const { host, root } = await renderPreferences();
    const wide = host.querySelector<HTMLInputElement>("#reading-width-wide");
    const full = host.querySelector<HTMLInputElement>("#reading-width-full");
    const serif = host.querySelector<HTMLInputElement>("#reading-font-serif");

    expect(wide?.type).toBe("radio");
    expect(wide?.checked).toBe(true);
    expect(full?.checked).toBe(false);

    await act(async () => full?.click());
    await act(async () => serif?.click());

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as ReadingSettings;
    expect(saved).toEqual({ ...DEFAULT_SETTINGS, width: "full", font: "serif" });
    expect(document.documentElement.getAttribute("data-reading-width")).toBe("full");
    expect(document.documentElement.getAttribute("data-font")).toBe("serif");

    act(() => root.unmount());
  });

  it("resets persisted settings and document attributes to defaults", async () => {
    const { host, root } = await renderPreferences();
    await act(async () =>
      host.querySelector<HTMLInputElement>("#reading-density-spacious")?.click()
    );

    const reset = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Reset defaults")
    );
    expect(reset?.disabled).toBe(false);

    await act(async () => reset?.click());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute("data-density")).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#reading-density-comfortable")?.checked).toBe(
      true
    );

    act(() => root.unmount());
  });

  it("keeps the last durable selection and reports a failed write", async () => {
    const { host, root } = await renderPreferences();
    window.localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };

    await act(async () => host.querySelector<HTMLInputElement>("#reading-width-full")?.click());

    expect(toastError).toHaveBeenCalledWith("Couldn't save the reading settings");
    expect(document.documentElement.hasAttribute("data-reading-width")).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#reading-width-wide")?.checked).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#reading-width-full")?.checked).toBe(false);

    act(() => root.unmount());
  });

  it("accepts a setting that applied before a secondary persistence error", async () => {
    const { host, root } = await renderPreferences();
    const apply = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = (key, value) => {
      apply(key, value);
      throw new Error("mirror failed");
    };

    await act(async () => host.querySelector<HTMLInputElement>("#reading-width-full")?.click());

    expect(toastError).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute("data-reading-width")).toBe("full");
    expect(host.querySelector<HTMLInputElement>("#reading-width-full")?.checked).toBe(true);

    act(() => root.unmount());
  });

  it("re-renders when another settings surface publishes a storage change", async () => {
    const { host, root } = await renderPreferences();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, textSize: "large" })
    );

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

    expect(host.querySelector<HTMLInputElement>("#reading-text-size-large")?.checked).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#reading-text-size-normal")?.checked).toBe(false);

    act(() => root.unmount());
  });
});
