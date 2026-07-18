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

import EditorClient, { editorFilenameError, isMissingLocalFileError } from "./EditorClient";
import { sameOriginNavigationAnchor, shouldBlockEditorLeave } from "./editor-leave-guard";
import { APP_NEW_DOCUMENT_EVENT, requestAppNavigation } from "@/lib/app-navigation";

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

function downloadButton(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>('button[aria-label^="Download"]');
  if (!button) throw new Error("Download button not found");
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

  it("accepts only portable Markdown filenames", () => {
    expect(editorFilenameError("notes.mdx")).toBeNull();
    expect(editorFilenameError("notes.md")).toBeNull();
    expect(editorFilenameError("notes.txt")).toBe("Use a .md or .mdx filename.");
    expect(editorFilenameError("../notes.mdx")).toBe("Use a filename without path characters.");
    expect(editorFilenameError("CON.mdx")).toBe("Choose a different filename.");
    expect(editorFilenameError(" notes.mdx")).toBe("Remove leading or trailing spaces.");
  });

  it("only classifies the desktop command's explicit OS not-found contract as missing", () => {
    expect(
      isMissingLocalFileError(
        "could not inspect file: The system cannot find the file specified. (os error 2)"
      )
    ).toBe(true);
    expect(isMissingLocalFileError("could not resolve file: path missing (os error 3)")).toBe(true);
    expect(isMissingLocalFileError({ code: "not_found" })).toBe(true);
    expect(isMissingLocalFileError("could not inspect file: Access is denied. (os error 5)")).toBe(
      false
    );
    expect(isMissingLocalFileError(new Error("Disk unavailable"))).toBe(false);
  });

  it("keeps both editor panels mounted and links them to stable tab ids", async () => {
    const { host, root } = await renderEditor();
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const sourceTab = tabs.find((tab) => tab.textContent === "Source");
    const previewTab = tabs.find((tab) => tab.textContent === "Preview");
    const sourcePanel = host.querySelector<HTMLElement>("#editor-source-panel");
    const previewPanel = host.querySelector<HTMLElement>("#editor-preview-panel");

    expect(sourceTab?.getAttribute("aria-controls")).toBe(sourcePanel?.id);
    expect(previewTab?.getAttribute("aria-controls")).toBe(previewPanel?.id);
    expect(sourcePanel?.getAttribute("aria-labelledby")).toBe(sourceTab?.id);
    expect(previewPanel?.getAttribute("aria-labelledby")).toBe(previewTab?.id);
    expect(sourcePanel?.hidden).toBe(false);
    expect(previewPanel?.hidden).toBe(true);

    await act(async () => previewTab?.click());
    expect(sourcePanel?.hidden).toBe(true);
    expect(previewPanel?.hidden).toBe(false);
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
    act(() => root.unmount());
  });

  it("renders route loading and error feedback inside the selected tabpanel", async () => {
    const pending = deferred<string>();
    tauriMocks.readLocalFile.mockReturnValue(pending.promise);
    let host = document.createElement("div");
    document.body.append(host);
    let root = createRoot(host);
    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    const loading = Array.from(host.querySelectorAll<HTMLElement>('[role="status"]')).find(
      (status) => status.textContent?.includes("Loading document")
    );
    expect(loading?.closest('[role="tabpanel"]')?.id).toBe("editor-source-panel");
    act(() => root.unmount());
    await act(async () => pending.resolve("# Loaded later\n"));

    tauriMocks.readLocalFile.mockReset().mockRejectedValue(new Error("Disk unavailable"));
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    await vi.waitFor(() =>
      expect(
        host.querySelector<HTMLElement>('[role="alert"]')?.closest('[role="tabpanel"]')?.id
      ).toBe("editor-source-panel")
    );
    expect(host.querySelector<HTMLElement>('[role="alert"]')?.textContent).toContain(
      "Disk unavailable"
    );
    expect(tauriMocks.readLocalFile).toHaveBeenCalledOnce();
    expect(saveButton(host).disabled).toBe(true);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(true);
    expect(tauriMocks.writeLocalFile).not.toHaveBeenCalled();

    tauriMocks.readLocalFile.mockResolvedValueOnce("# Recovered\n");
    const retry = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Retry"
    );
    await act(async () => retry?.click());
    await vi.waitFor(() =>
      expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("# Recovered\n")
    );
    expect(tauriMocks.readLocalFile).toHaveBeenCalledTimes(2);
    expect(saveButton(host).disabled).toBe(false);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(false);
    act(() => root.unmount());
  });

  it("only enables a writable desktop draft after both candidates are confirmed missing", async () => {
    tauriMocks.readLocalFile.mockRejectedValue(
      new Error("could not inspect file: The system cannot find the file specified. (os error 2)")
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    await vi.waitFor(() =>
      expect(
        Array.from(host.querySelectorAll<HTMLElement>('[role="status"]')).some((status) =>
          status.textContent?.includes("was not found")
        )
      ).toBe(true)
    );

    expect(tauriMocks.readLocalFile).toHaveBeenNthCalledWith(
      1,
      "C:/library",
      "C:/library/guide.mdx"
    );
    expect(tauriMocks.readLocalFile).toHaveBeenNthCalledWith(
      2,
      "C:/library",
      "C:/library/guide.md"
    );
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(false);
    expect(saveButton(host).disabled).toBe(false);

    await act(async () => saveButton(host).click());
    await vi.waitFor(() =>
      expect(tauriMocks.writeLocalFile).toHaveBeenCalledWith(
        "C:/library",
        "C:/library/guide.mdx",
        "# Untitled\n\n"
      )
    );
    act(() => root.unmount());
  });

  it("treats a non-JSON web 404 as an unavailable static capability", async () => {
    tauriMocks.isTauri.mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html><title>Not found</title>", {
          status: 404,
          headers: { "content-type": "text/html" },
        })
      )
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    await vi.waitFor(() => expect(host.textContent).toContain("Editor unavailable in this build"));
    expect(host.querySelector("textarea")).toBeNull();
    act(() => root.unmount());
  });

  it("keeps a live API JSON 404 as a writable missing web document", async () => {
    tauriMocks.isTauri.mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
      )
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    await vi.waitFor(() =>
      expect(
        Array.from(host.querySelectorAll<HTMLElement>('[role="status"]')).some((status) =>
          status.textContent?.includes("was not found")
        )
      ).toBe(true)
    );
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.readOnly).toBe(false);
    expect(downloadButton(host).disabled).toBe(false);
    act(() => root.unmount());
  });

  it("keeps a web network failure blocked and retryable", async () => {
    tauriMocks.isTauri.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    await vi.waitFor(() =>
      expect(host.querySelector<HTMLElement>('[role="alert"]')?.textContent).toContain(
        "could not be reached"
      )
    );
    expect(host.textContent).not.toContain("Editor unavailable in this build");
    expect(downloadButton(host).disabled).toBe(true);
    expect(
      Array.from(host.querySelectorAll<HTMLButtonElement>("button")).some(
        (button) => button.textContent === "Retry"
      )
    ).toBe(true);
    act(() => root.unmount());
  });

  it("keeps a non-JSON web success response blocked and retryable", async () => {
    tauriMocks.isTauri.mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>proxy error</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      )
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    await vi.waitFor(() =>
      expect(host.querySelector<HTMLElement>('[role="alert"]')?.textContent).toContain(
        "non-JSON response"
      )
    );
    expect(host.textContent).not.toContain("Editor unavailable in this build");
    expect(downloadButton(host).disabled).toBe(true);
    act(() => root.unmount());
  });

  it("keeps a web 5xx blocked and recovers through Retry", async () => {
    tauriMocks.isTauri.mockReturnValue(false);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Editor backend unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            source: "# Web recovered\n",
            id: "guide.mdx",
            title: "Guide",
            ext: ".mdx",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(EditorClient, { slug: "guide" })));
    await vi.waitFor(() =>
      expect(host.querySelector<HTMLElement>('[role="alert"]')?.textContent).toContain(
        "Editor backend unavailable"
      )
    );
    expect(downloadButton(host).disabled).toBe(true);

    const retry = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Retry"
    );
    await act(async () => retry?.click());
    await vi.waitFor(() =>
      expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("# Web recovered\n")
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(downloadButton(host).disabled).toBe(false);
    act(() => root.unmount());
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

  it("confirms before replacing a dirty draft with a new document", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { host, root } = await renderEditor();
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Editor textarea not found");
    act(() => replaceSource(textarea, "# Keep this draft\n"));

    act(() => window.dispatchEvent(new Event(APP_NEW_DOCUMENT_EVENT)));
    expect(confirm).toHaveBeenCalledOnce();
    expect(textarea.value).toBe("# Keep this draft\n");

    confirm.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event(APP_NEW_DOCUMENT_EVENT)));
    expect(textarea.value).toBe("# Untitled\n\n");
    expect(host.querySelector<HTMLInputElement>("input[aria-label='Filename']")?.value).toBe(
      "untitled.mdx"
    );
    expect(beforeUnload().defaultPrevented).toBe(false);
    act(() => root.unmount());
  });

  it("keeps a new document isolated from an earlier pending save", async () => {
    const pending = deferred<void>();
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    tauriMocks.writeLocalFile.mockReturnValueOnce(pending.promise);
    const { host, root } = await renderEditor();

    await act(async () => saveButton(host).click());
    await vi.waitFor(() => expect(tauriMocks.writeLocalFile).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event(APP_NEW_DOCUMENT_EVENT)));

    expect(confirm).toHaveBeenCalledOnce();
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("# Untitled\n\n");
    expect(host.querySelector<HTMLInputElement>("input[aria-label='Filename']")?.value).toBe(
      "untitled.mdx"
    );
    expect(beforeUnload().defaultPrevented).toBe(false);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    expect(beforeUnload().defaultPrevented).toBe(false);
    expect(host.querySelector<HTMLInputElement>("input[aria-label='Filename']")?.value).toBe(
      "untitled.mdx"
    );
    expect(host.textContent).not.toContain("Saved to local library");
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
