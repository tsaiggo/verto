// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));
vi.mock("@/lib/ai", () => ({
  getAssistantConfig: () => ({
    kind: "github",
    model: "openai/gpt-4.1-mini",
    enabled: true,
  }),
}));

import AssistantConnectPanel from "@/components/integrations/AssistantConnectPanel";
import { clearWebKey } from "@/lib/ai/key-store";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const STORAGE_KEY = "verto:assistant:token";
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

function setNativeValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function buttonWithText(text: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  );
}

async function renderPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(AssistantConnectPanel)));
  return host;
}

beforeEach(() => {
  installStorage();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("AssistantConnectPanel", () => {
  it("hydrates from the durable key and reacts to same-tab store changes", async () => {
    window.localStorage.setItem(STORAGE_KEY, "saved-token");
    const host = await renderPanel();

    expect(host.textContent).toContain("Saved on this device");
    await act(async () => {
      expect(clearWebKey()).toBe(true);
    });
    expect(host.textContent).toContain("Not saved");
  });

  it("saves and removes the credential through the visible controls", async () => {
    const host = await renderPanel();
    const input = host.querySelector<HTMLInputElement>("#assistant-key");
    expect(input).not.toBeNull();

    await act(async () => setNativeValue(input!, "  secret-token  "));
    await act(async () => buttonWithText("Save key")?.click());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("secret-token");
    expect(host.textContent).toContain("Saved on this device");
    expect(input?.value).toBe("");
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Assistant credential saved",
      expect.any(Object)
    );

    await act(async () => buttonWithText("Remove saved key")?.click());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(host.textContent).toContain("Not saved");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Assistant credential removed");
  });

  it("updates its visible state even when synthetic event dispatch fails", async () => {
    const host = await renderPanel();
    const input = host.querySelector<HTMLInputElement>("#assistant-key");
    await act(async () => setNativeValue(input!, "secret-token"));
    vi.spyOn(window, "dispatchEvent").mockImplementation(() => {
      throw new Error("event target unavailable");
    });

    await act(async () => buttonWithText("Save key")?.click());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("secret-token");
    expect(host.textContent).toContain("Saved on this device");
    expect(input?.value).toBe("");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Assistant credential saved",
      expect.any(Object)
    );
  });

  it("keeps the draft and reports a true save failure", async () => {
    const host = await renderPanel();
    const input = host.querySelector<HTMLInputElement>("#assistant-key");
    await act(async () => setNativeValue(input!, "retry-token"));
    window.localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };

    await act(async () => buttonWithText("Save key")?.click());

    expect(host.textContent).toContain("Not saved");
    expect(input?.value).toBe("retry-token");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Could not save the assistant credential",
      expect.any(Object)
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("keeps the saved state and reports a true removal failure", async () => {
    window.localStorage.setItem(STORAGE_KEY, "saved-token");
    const host = await renderPanel();
    window.localStorage.removeItem = () => {
      throw new Error("storage disabled");
    };

    await act(async () => buttonWithText("Remove saved key")?.click());

    expect(host.textContent).toContain("Saved on this device");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("saved-token");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Could not remove the assistant credential",
      expect.any(Object)
    );
  });
});
