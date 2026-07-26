// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderDocument = vi.hoisted(() => vi.fn());

vi.mock("@/components/runtime/RuntimeDocument", () => ({
  RuntimeDocument: ({ source }: { source: string }) => {
    renderDocument(source);
    return createElement("pre", { "data-runtime-document": true }, source);
  },
}));

import { LocalMdxWorkspace } from "./LocalMdxWorkspace";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

beforeEach(() => {
  renderDocument.mockReset();
});

async function renderWorkspace(
  props: Partial<React.ComponentProps<typeof LocalMdxWorkspace>> = {}
): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(LocalMdxWorkspace, {
        source: "# Starting point\n",
        title: "Notes",
        onSave: vi.fn(),
        initialMode: "edit",
        ...props,
      })
    );
  });
  return { host, root };
}

function replaceSource(textarea: HTMLTextAreaElement, source: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, source);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("LocalMdxWorkspace", () => {
  it("saves the local draft through Ctrl+S", async () => {
    const onSave = vi.fn();
    const { host, root } = await renderWorkspace({ onSave });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");

    await act(async () => {
      replaceSource(textarea, "# Changed\n");
    });
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    await act(async () => {
      window.dispatchEvent(event);
    });

    await vi.waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        source: "# Changed\n",
        title: "Notes",
        fileId: null,
        format: "mdx",
        isDesktop: false,
      })
    );
    expect(event.defaultPrevented).toBe(true);
    await act(async () => root.unmount());
  });

  it("keeps edits made during a save when the persisted source returns", async () => {
    let finishSave: (() => void) | null = null;
    const saveGate = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    function PersistedWorkspace() {
      const [source, setSource] = useState("# Starting point\n");
      return createElement(LocalMdxWorkspace, {
        fileId: "notes.mdx",
        source,
        title: "Notes",
        initialMode: "edit",
        onSave: async ({ source: nextSource }) => {
          await saveGate;
          setSource(nextSource);
        },
      });
    }

    await act(async () => root.render(createElement(PersistedWorkspace)));
    const splitButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Split")
    );
    if (!splitButton) throw new Error("Expected split mode control");
    await act(async () => splitButton.click());

    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");
    await act(async () => replaceSource(textarea, "# First saved version\n"));

    const saveButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save draft")
    );
    if (!saveButton) throw new Error("Expected save control");
    await act(async () => saveButton.click());
    await act(async () => replaceSource(textarea, "# Newer unsaved version\n"));
    await act(async () => finishSave?.());

    await vi.waitFor(() => expect(host.textContent).toContain("Unsaved"));
    expect(host.textContent).not.toContain("Draft saved.");
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "# Newer unsaved version\n"
    );
    expect(host.querySelector("section[aria-label='Source']")).not.toBeNull();
    expect(host.querySelector("section[aria-label='Preview']")).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("keeps a failed save editable and reports the storage error", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("The folder is read-only."));
    const { host, root } = await renderWorkspace({ fileId: "notes.mdx", onSave });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");

    await act(async () => replaceSource(textarea, "# Still here after failure\n"));
    const saveButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save draft")
    );
    if (!saveButton) throw new Error("Expected save control");
    await act(async () => saveButton.click());

    await vi.waitFor(() =>
      expect(host.querySelector("[role='alert']")?.textContent).toContain(
        "The folder is read-only."
      )
    );
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "# Still here after failure\n"
    );
    expect(host.textContent).toContain("Unsaved");

    await act(async () => root.unmount());
  });

  it("keeps unsupported executable MDX visible as source instead of silently dropping it", async () => {
    const source = 'import Chart from "./Chart"\n\n# Report\n';
    const { host, root } = await renderWorkspace({ source, initialMode: "read" });

    expect(host.querySelector("[role='alert']")?.textContent).toContain("does not execute");
    expect(host.querySelector("[role='alert']")?.textContent).toContain(
      'import Chart from "./Chart"'
    );
    expect(renderDocument).not.toHaveBeenCalled();

    const sourceButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Open Source")
    );
    if (!sourceButton) throw new Error("Expected source fallback button");
    await act(async () => sourceButton.click());
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(source);
    await act(async () => root.unmount());
  });

  it("previews safe MDX components without weakening source-only editing rules", async () => {
    const source = '<Callout type="info">\n  Grounded context.\n</Callout>\n';
    const { host, root } = await renderWorkspace({ source, initialMode: "read" });

    expect(host.querySelector("[role='alert']")).toBeNull();
    expect(renderDocument).toHaveBeenCalledWith(source);
    expect(host.textContent).not.toContain("Preview kept in Source mode");
    await act(async () => root.unmount());
  });

  it("offers source and preview panes in split mode and supports a plain document canvas", async () => {
    const { host, root } = await renderWorkspace({ appearance: "document" });
    const splitButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Split")
    );
    if (!splitButton) throw new Error("Expected split mode control");
    await act(async () => splitButton.click());

    expect(host.querySelector("section[data-appearance='document']")).not.toBeNull();
    expect(host.querySelector("section[aria-label='Source'] textarea")).not.toBeNull();
    expect(
      host.querySelector("section[aria-label='Preview'] [data-runtime-document]")
    ).not.toBeNull();
    await act(async () => root.unmount());
  });
});
