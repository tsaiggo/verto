// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InteractiveTaskList } from "./TaskList";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderTaskList() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(
      createElement(
        InteractiveTaskList,
        null,
        createElement(
          "li",
          null,
          createElement("input", { type: "checkbox", defaultChecked: true, disabled: true }),
          "Read the document"
        ),
        createElement(
          "li",
          null,
          createElement("input", { type: "checkbox", defaultChecked: false, disabled: true }),
          "Try a reader control"
        )
      )
    );
    await Promise.resolve();
  });

  return { host, root };
}

function taskStateKey() {
  return `verto:task-list:${window.location.pathname}:0`;
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
}

describe("InteractiveTaskList", () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    document.body.replaceChildren();
  });

  it("turns GFM checkboxes into keyboard-accessible local reader state", async () => {
    window.history.replaceState({}, "", "/read/demo");
    const { host, root } = await renderTaskList();
    const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

    expect(inputs).toHaveLength(2);
    expect(inputs[0]?.disabled).toBe(false);
    expect(inputs[0]?.checked).toBe(true);
    expect(inputs[0]?.getAttribute("aria-label")).toBe("Task: Read the document");

    act(() => inputs[0]?.click());

    expect(inputs[0]?.checked).toBe(false);
    expect(window.localStorage.getItem(taskStateKey())).toBe(JSON.stringify([false, false]));

    cleanup(root, host);
  });

  it("restores the saved completion state for the same document", async () => {
    window.history.replaceState({}, "", "/read/demo");
    window.localStorage.setItem(taskStateKey(), JSON.stringify([false, true]));
    const { host, root } = await renderTaskList();
    const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

    expect(inputs.map((input) => input.checked)).toEqual([false, true]);

    cleanup(root, host);
  });
});
