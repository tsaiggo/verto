// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

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
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/runtime/RuntimeDocument", () => ({
  RuntimeDocument: ({ source }: { source: string }) => createElement("pre", null, source),
}));

import EditorClient from "./EditorClient";
import { useArticleEditorDocument } from "@/components/editor/ArticleEditorDocument";
import { sameOriginNavigationAnchor, shouldBlockEditorLeave } from "./editor-leave-guard";
import { requestAppNavigation } from "@/lib/app-navigation";
import * as browserArticles from "@/lib/browser-articles";
import type { BrowserArticleSaveResult } from "@/lib/browser-articles";

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
    /^(?:Save|Saving)/.test(candidate.textContent?.trim() ?? "")
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
      expect(toastError).toHaveBeenCalledWith("Save failed — draft may not be on disk", {
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
    expect(toastError).toHaveBeenCalledWith("Save failed — draft may not be on disk", {
      description: "Permission denied",
    });
    act(() => root.unmount());
  });
});

describe("EditorClient browser articles", () => {
  const roots = new Set<Root>();
  beforeEach(() => {
    tauriMocks.isTauri.mockReturnValue(false);
    tauriMocks.writeLocalFile.mockReset();
    tauriMocks.readLocalFile.mockReset();
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("BroadcastChannel", undefined);
    vi.stubGlobal("navigation", new EventTarget());
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network is offline")));
    window.history.replaceState(null, "", "/editor");
  });
  afterEach(() => {
    act(() => {
      for (const root of roots) root.unmount();
    });
    roots.clear();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount(slug?: string) {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.add(root);
    await act(async () => {
      root.render(createElement(EditorClient, { slug }));
    });
    return {
      host,
      root,
      source: () => host.querySelector<HTMLTextAreaElement>("textarea[aria-label='MDX source']")!,
    };
  }
  async function autosave() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });
    await vi.waitFor(() =>
      expect(document.querySelector("[data-save-status='saving']")).toBeNull()
    );
  }
  async function waitFor(check: () => unknown | Promise<unknown>) {
    await vi.waitFor(async () => {
      let failure: unknown;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        try {
          await check();
        } catch (error) {
          failure = error;
        }
      });
      if (failure) throw failure;
    });
  }
  async function seed(source = "# Saved\n", filename = "saved.md", originSlug?: string) {
    const result = await browserArticles.saveBrowserArticle(
      browserArticles.createBrowserArticle({ source, filename, originSlug }),
      null
    );
    if (result.status !== "saved") throw new Error("Fixture was not saved");
    return result.article;
  }
  function click(host: HTMLElement, label: string) {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (candidate) => candidate.textContent?.trim() === label
    );
    if (!button) throw new Error(`Button ${label} not found`);
    button.click();
  }

  it("serializes a page rename before an autosave started while metadata is pending", async () => {
    const stored = await seed("# Original\n", "original.mdx");
    window.history.replaceState(null, "", `/editor?document=${stored.id}`);
    let state!: ReturnType<typeof useArticleEditorDocument>;
    function CaptureDocument() {
      const current = useArticleEditorDocument();
      useEffect(() => {
        state = current;
      }, [current]);
      return createElement("span", null, current.source);
    }
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.add(root);
    await act(async () => root.render(createElement(CaptureDocument)));
    await waitFor(() => expect(state.source).toBe(stored.source));
    const originalMetadata = browserArticles.updateBrowserArticleMetadata;
    const pending = deferred<BrowserArticleSaveResult>();
    vi.spyOn(browserArticles, "updateBrowserArticleMetadata").mockImplementationOnce(
      () => pending.promise
    );
    const saves = vi.spyOn(browserArticles, "saveBrowserArticle");
    let renamed!: Promise<void>;
    act(() => {
      renamed = state.updateMetadata({ title: "Renamed page" });
      state.changeSource("# Original\n\nTyped while renaming.\n");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });
    expect(state.blockLeave).toBe(true);
    expect(saves).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve(
        await originalMetadata(stored.id, { title: "Renamed page" }, stored.revision)
      );
      await renamed;
    });
    await waitFor(async () =>
      expect(await browserArticles.readBrowserArticle(stored.id)).toMatchObject({
        title: "Renamed page",
        source: "# Original\n\nTyped while renaming.\n",
        filename: stored.filename,
        revision: 3,
      })
    );
    await waitFor(() => expect(state.saveStatus).toBe("saved"));
    expect(state.saveError).toBe("");
    expect(state.blockLeave).toBe(false);
  });

  it("does not seed an empty draft and restores the exact first autosaved draft without a network request", async () => {
    const first = await mount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    });
    expect(await browserArticles.listBrowserArticles()).toEqual([]);
    act(() => replaceSource(first.source(), "# New article\n\nExact portable text.\n"));
    expect(beforeUnload().defaultPrevented).toBe(true);
    await autosave();
    const [stored] = await browserArticles.listBrowserArticles();
    expect(stored).toMatchObject({
      source: "# New article\n\nExact portable text.\n",
      status: "draft",
      revision: 1,
    });
    expect(new URLSearchParams(window.location.search).get("document")).toBe(stored.id);
    expect(beforeUnload().defaultPrevented).toBe(false);
    act(() => first.root.unmount());
    roots.delete(first.root);
    const restored = await mount();
    await waitFor(() => expect(restored.source().value).toBe(stored.source));
    expect(fetch).not.toHaveBeenCalled();
    expect(restored.host.textContent).toContain("Saved in this browser");
    expect(restored.host.querySelector<HTMLAnchorElement>("a")?.href).toContain(
      `/read/local?document=${stored.id}`
    );
  });

  it("keeps Export separate from saving, and explicit Save promotes a browser draft", async () => {
    const editor = await mount();
    const createUrl = vi.fn(() => "blob:portable-article");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    act(() => replaceSource(editor.source(), "# Portable\n"));
    act(() => click(editor.host, "Export"));
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(createUrl).toHaveBeenCalledOnce();
    expect(beforeUnload().defaultPrevented).toBe(true);
    expect(await browserArticles.listBrowserArticles()).toEqual([]);
    await act(async () => click(editor.host, "Save"));
    await waitFor(async () =>
      expect((await browserArticles.listBrowserArticles())[0]?.status).toBe("saved")
    );
    await waitFor(() => expect(beforeUnload().defaultPrevented).toBe(false));
    expect(beforeUnload().defaultPrevented).toBe(false);
    expect(tauriMocks.writeLocalFile).not.toHaveBeenCalled();
  });

  it("saves a source document as an honest browser copy and reopens that copy for the same slug", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ source: "# Source\n", id: "server-path", ext: ".md" }), {
        headers: { "content-type": "application/json" },
      })
    );
    const first = await mount("guide");
    await waitFor(() => expect(first.source().value).toBe("# Source\n"));
    expect(first.host.textContent).toContain("Saves a browser copy");
    expect(await browserArticles.listBrowserArticles()).toEqual([]);
    act(() => replaceSource(first.source(), "# My source copy\n"));
    await autosave();
    const [stored] = await browserArticles.listBrowserArticles();
    expect(stored).toMatchObject({
      originSlug: "guide",
      filename: "guide.md",
      source: "# My source copy\n",
    });
    expect(first.host.textContent).toContain("Browser copy");
    act(() => first.root.unmount());
    roots.delete(first.root);
    window.history.replaceState(null, "", "/editor?slug=guide");
    const reopened = await mount("guide");
    await waitFor(() => expect(reopened.source().value).toBe(stored.source));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]).toBeUndefined();
  });

  it("retains conflicting input, loads the saved version explicitly, and resumes autosaving", async () => {
    const stored = await seed();
    window.history.replaceState(null, "", `/editor?document=${stored.id}`);
    const editor = await mount();
    await waitFor(() => expect(editor.source().value).toBe(stored.source));
    act(() => replaceSource(editor.source(), "# My conflicting input\n"));
    await act(async () => {
      await browserArticles.saveBrowserArticle(
        { ...stored, source: "# Other window\n" },
        stored.revision
      );
    });
    await waitFor(() => expect(editor.host.textContent).toContain("Your text is kept here"));
    expect(editor.source().value).toBe("# My conflicting input\n");
    expect(saveButton(editor.host).disabled).toBe(true);
    act(() => replaceSource(editor.source(), "# Copyable local changes\n"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    });
    expect((await browserArticles.readBrowserArticle(stored.id))?.source).toBe("# Other window\n");
    await act(async () => click(editor.host, "Load saved version"));
    await waitFor(() => expect(editor.source().value).toBe("# Other window\n"));
    act(() => replaceSource(editor.source(), "# Restored and edited\n"));
    await autosave();
    expect((await browserArticles.readBrowserArticle(stored.id))?.source).toBe(
      "# Restored and edited\n"
    );
  });

  it("retains and guards the draft after storage failure, then retries without a duplicate article", async () => {
    const spy = vi
      .spyOn(browserArticles, "saveBrowserArticle")
      .mockRejectedValueOnce(new Error("Quota exceeded"));
    const editor = await mount();
    act(() => replaceSource(editor.source(), "# Do not lose this\n"));
    await autosave();
    expect(editor.host.textContent).toContain("Quota exceeded");
    expect(editor.source().value).toBe("# Do not lose this\n");
    expect(beforeUnload().defaultPrevented).toBe(true);
    await act(async () => click(editor.host, "Retry save"));
    await waitFor(async () => expect((await browserArticles.listBrowserArticles()).length).toBe(1));
    await waitFor(() => expect(beforeUnload().defaultPrevented).toBe(false));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0].id).toBe(spy.mock.calls[1][0].id);
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("keeps the leave guard when text returns to its baseline during a pending write", async () => {
    const stored = await seed();
    const actualSave = browserArticles.saveBrowserArticle;
    const pending = deferred<BrowserArticleSaveResult>();
    const spy = vi
      .spyOn(browserArticles, "saveBrowserArticle")
      .mockImplementationOnce(() => pending.promise);
    window.history.replaceState(null, "", `/editor?document=${stored.id}`);
    const editor = await mount();
    await waitFor(() => expect(editor.source().value).toBe(stored.source));
    act(() => replaceSource(editor.source(), "# Pending version\n"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });
    expect(spy).toHaveBeenCalledOnce();
    act(() => replaceSource(editor.source(), stored.source));
    expect(beforeUnload().defaultPrevented).toBe(true);
    expect(saveButton(editor.host).disabled).toBe(true);
    await act(async () => pending.resolve(await actualSave(spy.mock.calls[0][0], stored.revision)));
    expect(beforeUnload().defaultPrevented).toBe(true);
    await autosave();
    expect((await browserArticles.readBrowserArticle(stored.id))?.source).toBe(stored.source);
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it("loads a new document query within the mounted editor and ignores a late recovery read", async () => {
    const first = await seed("# First\n", "same.md");
    const second = await seed("# Second\n", "same.md");
    window.history.replaceState(null, "", `/editor?document=${first.id}`);
    const editor = await mount();
    await waitFor(() => expect(editor.source().value).toBe(first.source));
    await act(async () => {
      await browserArticles.saveBrowserArticle(
        { ...first, source: "# Updated first\n" },
        first.revision
      );
    });
    await waitFor(() => expect(editor.host.textContent).toContain("Load saved version"));
    const pending = deferred<typeof first | null>();
    vi.spyOn(browserArticles, "readBrowserArticle").mockImplementationOnce(() => pending.promise);
    act(() => click(editor.host, "Load saved version"));
    await act(async () => {
      await Promise.resolve();
    });
    window.history.replaceState(null, "", `/editor?document=${second.id}`);
    await act(async () => editor.root.render(createElement(EditorClient)));
    await waitFor(() => expect(editor.source().value).toBe(second.source));
    await act(async () =>
      pending.resolve({ ...first, source: "# Late first version\n", revision: 2 })
    );
    expect(editor.source().value).toBe(second.source);
    act(() => replaceSource(editor.source(), "# Second edited\n"));
    await autosave();
    expect((await browserArticles.readBrowserArticle(second.id))?.source).toBe("# Second edited\n");
    expect((await browserArticles.readBrowserArticle(first.id))?.source).toBe("# Updated first\n");
  });

  it("does not let a late native save change the file identity of a newly loaded document", async () => {
    tauriMocks.isTauri.mockReturnValue(true);
    tauriMocks.readLocalFile.mockImplementation((_root: string, path: string) =>
      Promise.resolve(path.includes("first") ? "# First file\n" : "# Second file\n")
    );
    const pending = deferred<void>();
    tauriMocks.writeLocalFile.mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const editor = await mount("first");
    await waitFor(() => expect(editor.source().value).toBe("# First file\n"));
    act(() => replaceSource(editor.source(), "# First saved late\n"));
    act(() => click(editor.host, "Save"));
    await act(async () => editor.root.render(createElement(EditorClient, { slug: "second" })));
    await waitFor(() => expect(editor.source().value).toBe("# Second file\n"));
    await act(async () => pending.resolve());
    act(() => replaceSource(editor.source(), "# Second saved\n"));
    await act(async () => click(editor.host, "Save"));
    expect(tauriMocks.writeLocalFile.mock.calls[1]).toEqual([
      "C:/library",
      "C:/library/second.mdx",
      "# Second saved\n",
    ]);
  });
});
