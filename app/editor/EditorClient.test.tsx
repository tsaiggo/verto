// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  readLocalFile: vi.fn(),
  writeLocalFile: vi.fn(),
}));
const folderMocks = vi.hoisted(() => ({
  loadActiveLocalFolder: vi.fn(() => "C:/library" as string | null),
}));
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri", () => tauriMocks);
vi.mock("@/lib/local-folder", () => folderMocks);
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/components/runtime/RuntimeDocument", () => ({
  RuntimeDocument: ({ source }: { source: string }) => createElement("pre", null, source),
}));

import EditorClient from "./EditorClient";
import { sameOriginNavigationAnchor, shouldBlockEditorLeave } from "./editor-leave-guard";
import { requestAppNavigation } from "@/lib/app-navigation";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function renderEditor(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(EditorClient, { slug: "guide" }));
  });
  await vi.waitFor(() => expect(host.querySelector("textarea")?.value).toBe("# Loaded\n"));
  return { host, root };
}

function replaceSource(textarea: HTMLTextAreaElement, source: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(textarea, source);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function beforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

function historyNavigationEvent(navigationType = "traverse", destination = "/library"): Event {
  const event = new Event("navigate", { cancelable: true });
  Object.defineProperties(event, {
    navigationType: { configurable: true, value: navigationType },
    destination: {
      configurable: true,
      value: { url: new URL(destination, window.location.href).href },
    },
    hashChange: { configurable: true, value: false },
  });
  return event;
}

function saveButton(host: HTMLElement): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) =>
    candidate.textContent?.includes("Save")
  );
  if (!button) throw new Error("Save button not found");
  return button;
}

describe("EditorClient leave guard", () => {
  beforeEach(() => {
    tauriMocks.isTauri.mockReturnValue(true);
    tauriMocks.readLocalFile.mockReset().mockResolvedValue("# Loaded\n");
    tauriMocks.writeLocalFile.mockReset().mockResolvedValue(undefined);
    folderMocks.loadActiveLocalFolder.mockReset().mockReturnValue("C:/library");
    toastError.mockReset();
    vi.stubGlobal("navigation", new EventTarget());
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("recognizes dirty and pending drafts", () => {
    expect(shouldBlockEditorLeave("same", "same", "idle")).toBe(false);
    expect(shouldBlockEditorLeave("changed", "same", "idle")).toBe(true);
    expect(shouldBlockEditorLeave("same", "same", "saving")).toBe(true);
    expect(shouldBlockEditorLeave("same", "same", "error")).toBe(false);
  });

  it("only treats unmodified same-origin anchor clicks as leave attempts", () => {
    const anchor = document.createElement("a");
    anchor.href = "/library";
    const label = document.createElement("span");
    anchor.append(label);
    document.body.append(anchor);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(click, "target", { configurable: true, value: label });
    expect(sameOriginNavigationAnchor(click, `${window.location.origin}/editor`)).toBe(anchor);

    anchor.href = "https://example.com/library";
    expect(sameOriginNavigationAnchor(click, `${window.location.origin}/editor`)).toBeNull();

    anchor.href = "/library";
    const modifiedClick = new MouseEvent("click", { ctrlKey: true, button: 0 });
    Object.defineProperty(modifiedClick, "target", { configurable: true, value: label });
    expect(
      sameOriginNavigationAnchor(modifiedClick, `${window.location.origin}/editor`)
    ).toBeNull();
  });

  it("blocks dirty exits, rejects SPA navigation, and clears the guard after save", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { host, root } = await renderEditor();

    expect(beforeUnload().defaultPrevented).toBe(false);
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Editor textarea not found");
    act(() => replaceSource(textarea, "# Changed\n"));
    expect(beforeUnload().defaultPrevented).toBe(true);

    const anchor = document.createElement("a");
    anchor.href = "/library";
    document.body.append(anchor);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(click);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(click.defaultPrevented).toBe(true);

    await act(async () => saveButton(host).click());
    await vi.waitFor(() => expect(tauriMocks.writeLocalFile).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(beforeUnload().defaultPrevented).toBe(false));
    act(() => root.unmount());
  });

  it("cancels browser back and forward before SPA state can replace the draft", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const navigation = (window as unknown as { navigation: EventTarget }).navigation;
    const { host, root } = await renderEditor();
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Editor textarea not found");
    act(() => replaceSource(textarea, "# Unsaved history draft\n"));

    const back = historyNavigationEvent();
    act(() => navigation.dispatchEvent(back));
    const forward = historyNavigationEvent();
    act(() => navigation.dispatchEvent(forward));

    expect(back.defaultPrevented).toBe(true);
    expect(forward.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(textarea.value).toBe("# Unsaved history draft\n");
    expect(tauriMocks.readLocalFile).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it("allows a confirmed browser history traversal", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const navigation = (window as unknown as { navigation: EventTarget }).navigation;
    const { host, root } = await renderEditor();
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Editor textarea not found");
    act(() => replaceSource(textarea, "# Ready to discard\n"));

    const traversal = historyNavigationEvent();
    act(() => navigation.dispatchEvent(traversal));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(traversal.defaultPrevented).toBe(false);
    act(() => root.unmount());
  });

  it("cancels an imperative app navigation before it can discard a dirty draft", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { host, root } = await renderEditor();
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Editor textarea not found");
    act(() => replaceSource(textarea, "# Shortcut draft\n"));

    let allowed = true;
    act(() => {
      allowed = requestAppNavigation();
    });

    expect(confirm).toHaveBeenCalledOnce();
    expect(allowed).toBe(false);
    expect(textarea.value).toBe("# Shortcut draft\n");
    act(() => root.unmount());
  });

  it("restores a cancelled popstate before downstream SPA listeners observe it", async () => {
    vi.stubGlobal("navigation", undefined);
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const pushState = vi.spyOn(window.history, "pushState");
    const forward = vi.spyOn(window.history, "forward").mockImplementation(() => undefined);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const { host, root } = await renderEditor();
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Editor textarea not found");
    act(() => replaceSource(textarea, "# Protected popstate draft\n"));
    await vi.waitFor(() => expect(pushState).toHaveBeenCalledTimes(1));

    const downstream = vi.fn();
    window.addEventListener("popstate", downstream);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true } }));
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledTimes(1);
    expect(downstream).not.toHaveBeenCalled();
    expect(textarea.value).toBe("# Protected popstate draft\n");

    const sentinelState = pushState.mock.calls[0]?.[0];
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: sentinelState }));
    });
    confirm.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true } }));
    });
    expect(back).toHaveBeenCalledTimes(1);

    window.removeEventListener("popstate", downstream);
    act(() => root.unmount());
  });

  it("blocks while save is pending and toasts a native failure after unmount", async () => {
    const pending = deferred<void>();
    tauriMocks.writeLocalFile.mockReturnValueOnce(pending.promise);
    const { host, root } = await renderEditor();

    await act(async () => saveButton(host).click());
    await vi.waitFor(() => expect(tauriMocks.writeLocalFile).toHaveBeenCalledTimes(1));
    expect(beforeUnload().defaultPrevented).toBe(true);
    act(() => root.unmount());

    pending.reject(new Error("Disk is unavailable"));
    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Save failed. The draft may not be on disk.", {
        description: "Disk is unavailable",
      })
    );
  });

  it("keeps the native save error visible while the editor remains mounted", async () => {
    tauriMocks.writeLocalFile.mockRejectedValueOnce(new Error("Permission denied"));
    const { host, root } = await renderEditor();

    await act(async () => saveButton(host).click());
    await vi.waitFor(() =>
      expect(host.querySelector("[role='alert']")?.textContent).toBe("Permission denied")
    );
    expect(toastError).toHaveBeenCalledWith("Save failed. The draft may not be on disk.", {
      description: "Permission denied",
    });
    act(() => root.unmount());
  });
});
