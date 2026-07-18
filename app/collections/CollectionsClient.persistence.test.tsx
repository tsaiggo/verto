// @vitest-environment jsdom

import { act, createElement } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Collection } from "@/lib/collections";

const mocks = vi.hoisted(() => ({
  collections: [] as Collection[],
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
  listeners: new Set<() => void>(),
  renameCollection: vi.fn(),
  routerReplace: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.routerReplace }),
  useSearchParams: () => ({ get: () => "" }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children?: ReactNode;
    href: string | { pathname?: string };
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : (href.pathname ?? "#")} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/collections", () => ({
  createCollection: mocks.createCollection,
  deleteCollection: mocks.deleteCollection,
  loadCollections: () => mocks.collections,
  renameCollection: mocks.renameCollection,
  subscribeCollections: (callback: () => void) => {
    mocks.listeners.add(callback);
    return () => mocks.listeners.delete(callback);
  },
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => ({ status: "idle", folder: null, index: null, error: null }),
}));

vi.mock("@/components/home/home-data", () => ({ runtimeHomeWorkspace: () => null }));
vi.mock("./CollectionDetail", () => ({ CollectionDetail: () => null }));

vi.mock("@/components/layout/ContentPage", () => ({
  ContentPage: ({ children }: { children?: ReactNode; width?: string }) => <main>{children}</main>,
  ContentHeader: ({
    actions,
    title,
  }: {
    actions?: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    title?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

vi.mock("@/components/ui/content-primitives", () => ({
  ContentEmptyState: ({
    action,
    description,
    title,
  }: {
    action?: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    title?: ReactNode;
  }) => (
    <div>
      {title}
      {description}
      {action}
    </div>
  ),
  ContentPanel: ({ children }: { children?: ReactNode; [key: string]: unknown }) => (
    <div>{children}</div>
  ),
  ContentRow: ({
    actions,
    description,
    title,
  }: {
    actions?: ReactNode;
    className?: string;
    description?: ReactNode;
    leading?: ReactNode;
    metadata?: ReactNode;
    title?: ReactNode;
  }) => (
    <div>
      {title}
      {description}
      {actions}
    </div>
  ),
  ContentSection: ({
    children,
    title,
  }: {
    children?: ReactNode;
    description?: ReactNode;
    title?: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  ContentStatus: () => null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { align?: string; children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    onSelect,
  }: {
    children?: ReactNode;
    className?: string;
    onClick?: () => void;
    onSelect?: () => void;
  }) => (
    <button type="button" onClick={onClick ?? onSelect}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { asChild?: boolean; children?: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    onOpenChange,
    open,
  }: {
    children?: ReactNode;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) =>
    open ? (
      <div data-dialog-root>
        <button type="button" aria-label="Dialog close" onClick={() => onOpenChange(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children?: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    asChild,
    size,
    variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    size?: string;
    variant?: string;
  }) => <button data-as-child={asChild} data-size={size} data-variant={variant} {...props} />,
}));

import CollectionsClient from "./CollectionsClient";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function collection(id = "collection-1", name = "Research"): Collection {
  return {
    id,
    name,
    docHrefs: [],
    createdAt: "2026-07-17T00:00:00.000Z",
  };
}

function notifyCollectionsChanged() {
  for (const listener of mocks.listeners) listener();
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function buttonWithText(host: ParentNode, text: string) {
  return (
    Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  );
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

let root: Root | null = null;

async function renderClient() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(createElement(CollectionsClient, { folderGroups: [], staticDocuments: [] }))
  );
  return host;
}

async function openCreate(host: HTMLElement, name: string) {
  await act(async () => buttonWithText(host, "New collection")?.click());
  const input = host.querySelector<HTMLInputElement>("#col-create-name");
  expect(input).not.toBeNull();
  await setInputValue(input!, name);
  return input!;
}

async function openRename(host: HTMLElement, name: string) {
  await act(async () => buttonWithText(host, "Rename")?.click());
  const input = host.querySelector<HTMLInputElement>("#col-rename-name");
  expect(input).not.toBeNull();
  await setInputValue(input!, name);
  return input!;
}

beforeEach(() => {
  mocks.collections = [];
  mocks.createCollection.mockReset();
  mocks.deleteCollection.mockReset();
  mocks.listeners.clear();
  mocks.renameCollection.mockReset();
  mocks.routerReplace.mockReset();
  mocks.toastError.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("CollectionsClient create persistence", () => {
  it("keeps the dialog and input, disables close, and blocks duplicate submits on true failure", async () => {
    mocks.collections = [collection()];
    const pending = deferred<never>();
    mocks.createCollection.mockReturnValue(pending.promise);
    const host = await renderClient();
    const input = await openCreate(host, "  Research  ");
    const form = input.closest("form");

    await act(async () => {
      buttonWithText(host, "Create")?.click();
      await Promise.resolve();
    });

    expect(input.disabled).toBe(true);
    expect(buttonWithText(host, "Cancel")?.disabled).toBe(true);
    expect(buttonWithText(host, "Creating...")?.disabled).toBe(true);
    expect(form?.getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      host.querySelector<HTMLButtonElement>('[aria-label="Dialog close"]')?.click();
      await Promise.resolve();
    });
    expect(mocks.createCollection).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.querySelector<HTMLInputElement>("#col-create-name")?.value).toBe("  Research  ");
    expect(host.querySelector<HTMLInputElement>("#col-create-name")?.disabled).toBe(false);
    expect(mocks.collections).toHaveLength(1);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't create collection",
      expect.objectContaining({ description: expect.stringContaining("name is still here") })
    );
  });

  it("closes without another toast when a mirror-only reject created a new local id", async () => {
    mocks.collections = [collection()];
    mocks.createCollection.mockImplementation(async (name: string) => {
      mocks.collections = [collection("collection-2", name), ...mocks.collections];
      notifyCollectionsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderClient();
    await openCreate(host, "Research");

    await act(async () => {
      buttonWithText(host, "Create")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.collections).toHaveLength(2);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});

describe("CollectionsClient rename persistence", () => {
  it("keeps the original row and edited input on true failure while blocking re-entry", async () => {
    mocks.collections = [collection()];
    const pending = deferred<never>();
    mocks.renameCollection.mockReturnValue(pending.promise);
    const host = await renderClient();
    const input = await openRename(host, "  Papers  ");
    const form = input.closest("form");

    await act(async () => {
      buttonWithText(host, "Save")?.click();
      await Promise.resolve();
    });

    expect(input.disabled).toBe(true);
    expect(buttonWithText(host, "Saving...")?.disabled).toBe(true);
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      host.querySelector<HTMLButtonElement>('[aria-label="Dialog close"]')?.click();
      await Promise.resolve();
    });
    expect(mocks.renameCollection).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.querySelector<HTMLInputElement>("#col-rename-name")?.value).toBe("  Papers  ");
    expect(host.textContent).toContain("Research");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't rename collection",
      expect.objectContaining({ description: expect.stringContaining("new name is still here") })
    );
  });

  it("closes and shows the local name after a mirror-only reject without another toast", async () => {
    mocks.collections = [collection()];
    mocks.renameCollection.mockImplementation(async (id: string, name: string) => {
      mocks.collections = [collection(id, name)];
      notifyCollectionsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderClient();
    await openRename(host, "Papers");

    await act(async () => {
      buttonWithText(host, "Save")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain("Papers");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});

describe("CollectionsClient delete persistence", () => {
  it("keeps the collection and confirmation on true failure while blocking duplicate delete", async () => {
    mocks.collections = [collection()];
    const pending = deferred<never>();
    mocks.deleteCollection.mockReturnValue(pending.promise);
    const host = await renderClient();
    await act(async () => buttonWithText(host, "Delete")?.click());

    await act(async () => {
      buttonWithText(host, "Delete collection")?.click();
      await Promise.resolve();
    });

    expect(buttonWithText(host, "Cancel")?.disabled).toBe(true);
    expect(buttonWithText(host, "Deleting...")?.disabled).toBe(true);
    buttonWithText(host, "Deleting...")?.click();
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Dialog close"]')?.click();
      await Promise.resolve();
    });
    expect(mocks.deleteCollection).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Research");
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(mocks.routerReplace).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't delete collection",
      expect.objectContaining({ description: expect.stringContaining("still here") })
    );
  });

  it("closes and navigates after a mirror-only reject removed the local collection", async () => {
    mocks.collections = [collection()];
    mocks.deleteCollection.mockImplementation(async () => {
      mocks.collections = [];
      notifyCollectionsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderClient();
    await act(async () => buttonWithText(host, "Delete")?.click());

    await act(async () => {
      buttonWithText(host, "Delete collection")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain("Make your first collection");
    expect(mocks.routerReplace).toHaveBeenCalledWith("/collections");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
