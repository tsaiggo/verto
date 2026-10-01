// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MailAccountSwitcher, { type MailAccountOption } from "./MailAccountSwitcher";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const accounts: MailAccountOption[] = [
  { id: "personal", address: "personal@example.com", displayName: "Personal", provider: "google" },
  { id: "work", address: "work@example.com", displayName: "Work", provider: "microsoft" },
];

class TestPointerEvent extends MouseEvent {
  readonly pointerType = "mouse";
  readonly pointerId = 1;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function renderSwitcher() {
  const onSelect = vi.fn();
  await act(async () =>
    root.render(
      createElement(MailAccountSwitcher, {
        accounts,
        selectedId: "personal",
        onSelect,
        onAdd: vi.fn(),
        allInboxes: { unreadCount: 8 },
        demo: true,
      })
    )
  );
  return onSelect;
}

function trigger(): HTMLButtonElement {
  return host.querySelector<HTMLButtonElement>("button[aria-haspopup='menu']")!;
}

function itemContaining(label: string): HTMLElement {
  const item = Array.from(document.querySelectorAll<HTMLElement>("[role='menuitemradio']")).find(
    (element) => element.textContent?.includes(label)
  );
  expect(item, `Menu option ${label} should be present`).toBeDefined();
  return item!;
}

async function pointerClick(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(
      new TestPointerEvent("pointerdown", { bubbles: true, button: 0, cancelable: true })
    );
    element.dispatchEvent(
      new TestPointerEvent("pointerup", { bubbles: true, button: 0, cancelable: true })
    );
    element.click();
  });
}

describe("Mail account menu selection", () => {
  it.each([
    ["All inboxes", "all"],
    ["work@example.com", "work"],
  ])("selects %s once immediately after opening by pointer", async (label, id) => {
    const onSelect = await renderSwitcher();
    await pointerClick(trigger());
    await pointerClick(itemContaining(label));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(id);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it.each([
    ["All inboxes", "all"],
    ["work@example.com", "work"],
  ])("selects %s once using Enter", async (label, id) => {
    const onSelect = await renderSwitcher();
    await act(async () =>
      trigger().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
      )
    );
    await act(async () => {
      const item = itemContaining(label);
      item.focus();
      item.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      );
    });

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(id);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});
