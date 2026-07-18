// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));
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
  beforeEach(() => {
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
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
      host.querySelector<HTMLButtonElement>('[aria-label="Voice input not supported"]')?.disabled
    ).toBe(true);

    act(() => root.unmount());
  });

  it("hands the current input to Agent without dropping the prompt", async () => {
    const { host, root } = await renderComposer();
    const input = host.querySelector<HTMLInputElement>('input[name="q"]');
    if (!input) throw new Error("Search input is unavailable");

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!valueSetter) throw new Error("Native input setter is unavailable");

    await act(async () => {
      valueSetter.call(input, "Summarize & cite this");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(
      host.querySelector<HTMLAnchorElement>('a[aria-label="Ask Verto Agent"]')?.getAttribute("href")
    ).toBe("/agent?prompt=Summarize%20%26%20cite%20this");

    act(() => root.unmount());
  });

  it("transcribes into the real search input when browser speech recognition is available", async () => {
    const start = vi.fn();
    class Recognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((event: VoiceRecognitionEvent) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start = start;
      stop = vi.fn();
      abort = vi.fn();
    }
    type VoiceRecognitionEvent = {
      results: ArrayLike<{ 0?: { transcript?: string } }>;
    };
    (window as unknown as { SpeechRecognition: typeof Recognition }).SpeechRecognition =
      Recognition;

    const { host, root } = await renderComposer();
    const voice = host.querySelector<HTMLButtonElement>('[aria-label="Start voice input"]');
    expect(voice?.disabled).toBe(false);

    act(() => voice?.click());
    expect(start).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });

  it("recovers when browser speech recognition fails to start", async () => {
    class Recognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult = null;
      onend = null;
      onerror = null;
      start = vi.fn(() => {
        throw new Error("Permission denied");
      });
      stop = vi.fn();
      abort = vi.fn();
    }
    (window as unknown as { SpeechRecognition: typeof Recognition }).SpeechRecognition =
      Recognition;

    const { host, root } = await renderComposer();
    const voice = host.querySelector<HTMLButtonElement>('[aria-label="Start voice input"]');
    act(() => voice?.click());

    expect(host.querySelector('[aria-label="Stop voice input"]')).toBeNull();
    expect(host.querySelector('[aria-label="Start voice input"]')).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Voice input could not be started"
    );

    expect(toastErrorMock).toHaveBeenCalledWith("Voice input unavailable", {
      description: "Voice input could not be started. Check browser permissions and try again.",
    });

    act(() => root.unmount());
  });
});
