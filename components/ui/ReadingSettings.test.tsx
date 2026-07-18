// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  type ReadingSettings as ReadingSettingsState,
} from "@/lib/reading-settings";
import ReadingSettings from "./ReadingSettings";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function renderSettings(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(ReadingSettings));
  });

  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Reading settings"]');
  if (!trigger) throw new Error("Reading settings trigger was not rendered");

  await act(async () => {
    trigger.click();
  });

  return { host, root };
}

function radios(label: string): HTMLButtonElement[] {
  const group = document.querySelector<HTMLElement>(`[role="radiogroup"][aria-label="${label}"]`);
  if (!group) throw new Error(`${label} group was not rendered`);
  return Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
}

async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

function selectedLabel(options: HTMLButtonElement[]): string | undefined {
  return options
    .find((option) => option.getAttribute("aria-checked") === "true")
    ?.textContent?.trim();
}

describe("ReadingSettings radio groups", () => {
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
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-reading-width");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.removeAttribute("data-text-size");
    document.documentElement.removeAttribute("data-font");
    document.body.replaceChildren();
  });

  it("uses roving tabindex and supports the complete radio-group keyboard model", async () => {
    const { host, root } = await renderSettings();
    let widthOptions = radios("Reading width");

    expect(widthOptions.map((option) => option.tabIndex)).toEqual([-1, -1, 0, -1]);
    expect(selectedLabel(widthOptions)).toBe("Wide");

    widthOptions[2]?.focus();
    await press(widthOptions[2]!, "ArrowRight");
    widthOptions = radios("Reading width");
    expect(selectedLabel(widthOptions)).toBe("Full");
    expect(document.activeElement).toBe(widthOptions[3]);

    await press(widthOptions[3]!, "ArrowRight");
    widthOptions = radios("Reading width");
    expect(selectedLabel(widthOptions)).toBe("Narrow");

    await press(widthOptions[0]!, "ArrowLeft");
    widthOptions = radios("Reading width");
    expect(selectedLabel(widthOptions)).toBe("Full");

    await press(widthOptions[3]!, "Home");
    widthOptions = radios("Reading width");
    expect(selectedLabel(widthOptions)).toBe("Narrow");

    await press(widthOptions[0]!, "End");
    widthOptions = radios("Reading width");
    expect(selectedLabel(widthOptions)).toBe("Full");

    await press(widthOptions[3]!, "ArrowUp");
    widthOptions = radios("Reading width");
    expect(selectedLabel(widthOptions)).toBe("Wide");

    await press(widthOptions[2]!, "ArrowDown");
    widthOptions = radios("Reading width");
    expect(selectedLabel(widthOptions)).toBe("Full");
    expect(widthOptions.map((option) => option.tabIndex)).toEqual([-1, -1, -1, 0]);

    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null"
    ) as ReadingSettingsState;
    expect(stored).toEqual({ ...DEFAULT_SETTINGS, width: "full" });

    act(() => root.unmount());
    host.remove();
  });

  it("keeps the last durable selection and reports a failed write", async () => {
    const { host, root } = await renderSettings();
    window.localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };

    let widthOptions = radios("Reading width");
    await act(async () => widthOptions[3]?.click());
    widthOptions = radios("Reading width");

    expect(toastError).toHaveBeenCalledWith("Couldn't save the reading settings");
    expect(selectedLabel(widthOptions)).toBe("Wide");
    expect(document.documentElement.hasAttribute("data-reading-width")).toBe(false);

    act(() => root.unmount());
    host.remove();
  });

  it("applies the same roving keyboard behavior to the font choices", async () => {
    const { host, root } = await renderSettings();
    let fontOptions = radios("Reading font");

    expect(fontOptions.map((option) => option.tabIndex)).toEqual([0, -1, -1]);
    fontOptions[0]?.focus();
    await press(fontOptions[0]!, "End");
    fontOptions = radios("Reading font");

    expect(selectedLabel(fontOptions)).toBe("AaMono");
    expect(document.activeElement).toBe(fontOptions[2]);
    expect(fontOptions.map((option) => option.tabIndex)).toEqual([-1, -1, 0]);

    act(() => root.unmount());
    host.remove();
  });
});
