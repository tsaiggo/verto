// @vitest-environment jsdom

import { act, createElement } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Collection } from "@/lib/collections";

const mocks = vi.hoisted(() => ({
  addDocToCollection: vi.fn(),
  collections: [] as Collection[],
  createCollection: vi.fn(),
  listeners: new Set<() => void>(),
  removeDocFromCollection: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/collections", () => ({
  addDocToCollection: mocks.addDocToCollection,
  createCollection: mocks.createCollection,
  loadCollections: () => mocks.collections,
  removeDocFromCollection: mocks.removeDocFromCollection,
  subscribeCollections: (callback: () => void) => {
    mocks.listeners.add(callback);
    return () => mocks.listeners.delete(callback);
  },
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children?: ReactNode;
    "aria-label"?: string;
  }) => <div aria-label={ariaLabel}>{children}</div>,
  DropdownMenuItem: ({
    children,
    disabled,
    onSelect,
    "aria-label": ariaLabel,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onSelect?: () => void;
    "aria-label"?: string;
  }) => (
    <button type="button" disabled={disabled} aria-label={ariaLabel} onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children?: ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-dialog-root>{children}</div> : null),
  DialogContent: ({ children }: { children?: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: ReactNode; className?: string }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    variant,
    size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => <button data-variant={variant} data-size={size} {...props} />,
}));

import { AddToCollectionButton } from "@/components/reader/AddToCollectionButton";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const HREF = "/read/reader-notes";
const TITLE = "Reader notes";

function savedCollection(included = false): Collection {
  return {
    id: "collection-1",
    name: "Research",
    docHrefs: included ? [HREF] : [],
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

function buttonWithText(host: ParentNode, text: string): HTMLButtonElement | null {
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

async function renderButton(): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(createElement(AddToCollectionButton, { href: HREF, title: TITLE }))
  );
  return host;
}

async function openCreateDialog(host: HTMLElement, name = "  Research  ") {
  await act(async () => buttonWithText(host, "Create and add to collection")?.click());
  const input = host.querySelector<HTMLInputElement>("#collection-name");
  expect(input).not.toBeNull();
  await setInputValue(input!, name);
  return input!;
}

beforeEach(() => {
  mocks.addDocToCollection.mockReset();
  mocks.collections = [];
  mocks.createCollection.mockReset();
  mocks.listeners.clear();
  mocks.removeDocFromCollection.mockReset();
  mocks.toastError.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("AddToCollectionButton membership failures", () => {
  it("keeps membership unchanged, blocks duplicate clicks, and toasts when add was not applied", async () => {
    mocks.collections = [savedCollection(false)];
    const pending = deferred<never>();
    mocks.addDocToCollection.mockReturnValue(pending.promise);
    const host = await renderButton();
    const add = host.querySelector<HTMLButtonElement>('[aria-label="Add to Research"]');

    await act(async () => {
      add?.click();
      await Promise.resolve();
    });

    expect(add?.disabled).toBe(true);
    add?.click();
    expect(mocks.addDocToCollection).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.querySelector<HTMLButtonElement>('[aria-label="Add to Research"]')?.disabled).toBe(
      false
    );
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Add to collection"]')
    ).not.toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't add to collection",
      expect.objectContaining({ description: expect.stringContaining("not in Research") })
    );
  });

  it("accepts a mirror-only rejected add from local membership without another toast", async () => {
    mocks.collections = [savedCollection(false)];
    mocks.addDocToCollection.mockImplementation(async () => {
      mocks.collections = [savedCollection(true)];
      notifyCollectionsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderButton();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Add to Research"]')?.click();
      await Promise.resolve();
    });

    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Remove from Research"]')
    ).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="In 1 collection"]')).not.toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("keeps membership and toasts when remove was not applied locally", async () => {
    mocks.collections = [savedCollection(true)];
    mocks.removeDocFromCollection.mockRejectedValue(new Error("storage unavailable"));
    const host = await renderButton();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Remove from Research"]')?.click();
      await Promise.resolve();
    });

    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Remove from Research"]')
    ).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="In 1 collection"]')).not.toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't remove from collection",
      expect.objectContaining({ description: expect.stringContaining("still in Research") })
    );
  });

  it("accepts a mirror-only rejected remove from local membership without another toast", async () => {
    mocks.collections = [savedCollection(true)];
    mocks.removeDocFromCollection.mockImplementation(async () => {
      mocks.collections = [savedCollection(false)];
      notifyCollectionsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderButton();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Remove from Research"]')?.click();
      await Promise.resolve();
    });

    expect(host.querySelector<HTMLButtonElement>('[aria-label="Add to Research"]')).not.toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Add to collection"]')
    ).not.toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});

describe("AddToCollectionButton create and add failures", () => {
  it("keeps the dialog and input, locks controls, and blocks duplicate submits when create fails", async () => {
    const pending = deferred<never>();
    mocks.createCollection.mockReturnValue(pending.promise);
    const host = await renderButton();
    const input = await openCreateDialog(host);
    const form = host.querySelector<HTMLFormElement>("form");

    await act(async () => {
      buttonWithText(host, "Create and add")?.click();
      await Promise.resolve();
    });

    expect(form?.getAttribute("aria-busy")).toBe("true");
    expect(input.disabled).toBe(true);
    expect(buttonWithText(host, "Cancel")?.disabled).toBe(true);
    expect(buttonWithText(host, "Creating and adding...")?.disabled).toBe(true);
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(mocks.createCollection).toHaveBeenCalledTimes(1);
    expect(mocks.createCollection).toHaveBeenCalledWith("Research");

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#collection-name")?.value).toBe("  Research  ");
    expect(host.querySelector<HTMLInputElement>("#collection-name")?.disabled).toBe(false);
    expect(buttonWithText(host, "Create and add")?.disabled).toBe(false);
    expect(mocks.addDocToCollection).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't create collection",
      expect.objectContaining({ description: expect.stringContaining("name is still here") })
    );
  });

  it("keeps the dialog after add fails and reuses the created collection on retry", async () => {
    mocks.createCollection.mockImplementation(async () => {
      mocks.collections = [savedCollection(false)];
      notifyCollectionsChanged();
      return mocks.collections;
    });
    mocks.addDocToCollection
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockImplementationOnce(async () => {
        mocks.collections = [savedCollection(true)];
        notifyCollectionsChanged();
        return mocks.collections;
      });
    const host = await renderButton();
    await openCreateDialog(host);

    await act(async () => {
      buttonWithText(host, "Create and add")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#collection-name")?.value).toBe("  Research  ");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't add to collection",
      expect.objectContaining({ description: expect.stringContaining("name is still here") })
    );

    await act(async () => {
      buttonWithText(host, "Create and add")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.createCollection).toHaveBeenCalledTimes(1);
    expect(mocks.addDocToCollection).toHaveBeenCalledTimes(2);
  });

  it("closes without duplicate toasts when mirror-only rejects left both steps applied locally", async () => {
    mocks.createCollection.mockImplementation(async () => {
      mocks.collections = [savedCollection(false)];
      notifyCollectionsChanged();
      throw new Error("create mirror failed");
    });
    mocks.addDocToCollection.mockImplementation(async () => {
      mocks.collections = [savedCollection(true)];
      notifyCollectionsChanged();
      throw new Error("add mirror failed");
    });
    const host = await renderButton();
    await openCreateDialog(host);

    await act(async () => {
      buttonWithText(host, "Create and add")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.createCollection).toHaveBeenCalledTimes(1);
    expect(mocks.addDocToCollection).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="In 1 collection"]')).not.toBeNull();
  });
});
