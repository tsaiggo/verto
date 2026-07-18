// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const disconnectRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const loadActiveRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const listRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runtime-local-folder", () => ({
  disconnectRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  listRuntimeLocalFolder,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: toastError,
    success: toastSuccess,
  }),
}));

vi.mock("./LocalConnectPanel", () => ({ default: () => null }));
vi.mock("./LocalFolderPickerButton", () => ({ default: () => null }));
vi.mock("./OnboardingReturnLink", () => ({ default: () => null }));
vi.mock("./RssSourceDetail", () => ({
  default: () => null,
  formatRssSync: () => "-",
  useSubscriptions: () => [],
}));

import SourcesOverview, { type SourceRow } from "./SourcesOverview";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const SOURCES: SourceRow[] = [
  {
    kind: "local",
    name: "Local Library",
    detail: "C:/Notes",
    lastSync: "Just now",
    items: 1,
    status: "synced",
  },
  {
    kind: "rss",
    name: "RSS",
    detail: "No feeds subscribed",
    lastSync: "-",
    items: 0,
    status: "disconnected",
  },
];

async function renderOverview() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(SourcesOverview, { sources: SOURCES }));
    await Promise.resolve();
    await Promise.resolve();
  });
  return { host, root };
}

function buttonsNamed(host: HTMLElement, name: string): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>("button")).filter(
    (button) => button.textContent?.trim() === name
  );
}

describe("SourcesOverview local disconnect", () => {
  beforeEach(() => {
    disconnectRuntimeLocalFolder.mockReset();
    loadActiveRuntimeLocalFolder.mockReset();
    listRuntimeLocalFolder.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();

    loadActiveRuntimeLocalFolder.mockReturnValue("C:/Notes");
    listRuntimeLocalFolder.mockResolvedValue([]);
    disconnectRuntimeLocalFolder.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps the confirmation open when disconnect resolves without changing runtime state", async () => {
    const { host, root } = await renderOverview();

    await act(async () => {
      buttonsNamed(host, "Disconnect")[0]?.click();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Disconnect this local library?");

    await act(async () => {
      buttonsNamed(host, "Disconnect").at(-1)?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(disconnectRuntimeLocalFolder).toHaveBeenCalledOnce();
    expect(loadActiveRuntimeLocalFolder).toHaveReturnedWith("C:/Notes");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Could not disconnect the local library",
      expect.objectContaining({ description: expect.stringContaining("still active") })
    );
    expect(host.textContent).toContain("Disconnect this local library?");
    expect(buttonsNamed(host, "Disconnect").at(-1)?.disabled).toBe(false);

    act(() => root.unmount());
  });
});
