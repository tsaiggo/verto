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
import { requestAppNavigation } from "@/lib/app-navigation";
import { LocalFileWriteConflictError } from "@/lib/tauri";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

beforeEach(() => {
  renderDocument.mockReset();
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: new EventTarget(),
  });
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
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: undefined,
  });
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

  it("blocks beforeunload, file links, and app navigation while the draft is dirty", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { host, root } = await renderWorkspace({ fileId: "notes.mdx" });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");

    await act(async () => replaceSource(textarea, "# Unsaved navigation draft\n"));

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    const fileLink = document.createElement("a");
    fileLink.href = "/runtime/local?file=other.mdx";
    fileLink.textContent = "Other file";
    document.body.append(fileLink);
    const click = new MouseEvent("click", { bubbles: true, button: 0, cancelable: true });
    fileLink.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);

    expect(requestAppNavigation()).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "# Unsaved navigation draft\n"
    );

    await act(async () => root.unmount());
  });

  it("cancels a dirty browser history traversal with one prompt", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const navigation = (window as unknown as { navigation: EventTarget }).navigation;
    const { host, root } = await renderWorkspace({ fileId: "notes.mdx" });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");
    await act(async () => replaceSource(textarea, "# Unsaved history draft\n"));

    const traversal = new Event("navigate", { cancelable: true });
    Object.defineProperty(traversal, "navigationType", {
      configurable: true,
      value: "traverse",
    });
    await act(async () => {
      navigation.dispatchEvent(traversal);
    });

    expect(traversal.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    expect(textarea.value).toBe("# Unsaved history draft\n");

    await act(async () => root.unmount());
  });

  it("does not prompt twice after a confirmed same-origin link", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { host, root } = await renderWorkspace({ fileId: "notes.mdx" });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");
    await act(async () => replaceSource(textarea, "# Ready to discard\n"));

    const fileLink = document.createElement("a");
    fileLink.href = "/runtime/local?file=other.mdx";
    fileLink.addEventListener("click", (event) => event.preventDefault());
    document.body.append(fileLink);
    fileLink.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));

    expect(requestAppNavigation()).toBe(true);
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });

  it("blocks beforeunload while an unchanged draft is still saving", async () => {
    let finishSave: (() => void) | null = null;
    const saveGate = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const { host, root } = await renderWorkspace({
      fileId: "notes.mdx",
      onSave: () => saveGate,
    });
    const saveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Save draft"
    );
    if (!saveButton) throw new Error("Expected save control");

    await act(async () => saveButton.click());
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await act(async () => finishSave?.());
    await act(async () => root.unmount());
  });

  it("offers explicit overwrite recovery after a revision conflict", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new LocalFileWriteConflictError("opened", "external"))
      .mockResolvedValueOnce(undefined);
    const { host, root } = await renderWorkspace({
      fileId: "notes.mdx",
      isDesktop: true,
      onReloadFromDisk: vi.fn().mockResolvedValue("# External disk version\n"),
      onSave,
    });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");
    await act(async () => replaceSource(textarea, "# Protected local draft\n"));

    const saveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Save"
    );
    if (!saveButton) throw new Error("Expected save control");
    await act(async () => saveButton.click());
    await vi.waitFor(() => expect(host.textContent).toContain("Reload disk version"));
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "# Protected local draft\n"
    );

    const overwrite = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Overwrite anyway"
    );
    if (!overwrite) throw new Error("Expected overwrite control");
    await act(async () => overwrite.click());
    await vi.waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith({
        source: "# Protected local draft\n",
        title: "Notes",
        fileId: "notes.mdx",
        format: "mdx",
        isDesktop: true,
        forceOverwrite: true,
      })
    );
    expect(host.textContent).toContain("Saved to your local folder.");

    await act(async () => root.unmount());
  });

  it("keeps the textarea and local draft when reloading a conflict fails", async () => {
    const onReloadFromDisk = vi.fn().mockRejectedValue(new Error("The disk read failed."));
    const onSave = vi.fn().mockRejectedValue(new LocalFileWriteConflictError("opened", "external"));
    const { host, root } = await renderWorkspace({
      fileId: "notes.mdx",
      isDesktop: true,
      onReloadFromDisk,
      onSave,
    });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");
    await act(async () => replaceSource(textarea, "# Protected local draft\n"));
    const saveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Save"
    );
    if (!saveButton) throw new Error("Expected save control");
    await act(async () => saveButton.click());
    await vi.waitFor(() => expect(host.textContent).toContain("Reload disk version"));

    const reload = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Reload disk version"
    );
    if (!reload) throw new Error("Expected reload control");
    await act(async () => reload.click());

    await vi.waitFor(() =>
      expect(host.querySelector("[role='alert']")?.textContent).toContain(
        "Could not reload the disk version. The disk read failed."
      )
    );
    expect(host.querySelector<HTMLTextAreaElement>("textarea")).toBe(textarea);
    expect(textarea.value).toBe("# Protected local draft\n");
    expect(host.textContent).toContain("Unsaved");
    expect(host.textContent).toContain("Reload disk version");

    await act(async () => root.unmount());
  });

  it("replaces the draft and resets its baseline only after reload succeeds", async () => {
    const onSourceChange = vi.fn();
    const onReloadFromDisk = vi.fn().mockResolvedValue("# External disk version\n");
    const onSave = vi.fn().mockRejectedValue(new LocalFileWriteConflictError("opened", "external"));
    const { host, root } = await renderWorkspace({
      fileId: "notes.mdx",
      isDesktop: true,
      onReloadFromDisk,
      onSave,
      onSourceChange,
    });
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected source textarea");
    await act(async () => replaceSource(textarea, "# Protected local draft\n"));
    const saveButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Save"
    );
    if (!saveButton) throw new Error("Expected save control");
    await act(async () => saveButton.click());
    await vi.waitFor(() => expect(host.textContent).toContain("Reload disk version"));
    const reload = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Reload disk version"
    );
    if (!reload) throw new Error("Expected reload control");

    await act(async () => reload.click());

    await vi.waitFor(() => expect(textarea.value).toBe("# External disk version\n"));
    expect(host.textContent).not.toContain("Unsaved");
    expect(host.textContent).toContain("Saved to your local folder.");
    expect(onReloadFromDisk).toHaveBeenCalledOnce();
    expect(onSourceChange).toHaveBeenLastCalledWith("# External disk version\n");

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
