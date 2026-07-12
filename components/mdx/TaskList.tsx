"use client";

import { useEffect, useRef } from "react";
import type React from "react";

/**
 * A light wrapper authors can use around a Markdown task list. The Markdown
 * list itself is rendered by InteractiveTaskList below, preserving a valid
 * list structure while adding local-only completion state.
 */
export default function TaskList({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={joinClassNames("task-list", className)} />;
}

/**
 * Keeps standard GFM task lists useful in the reader without modifying source
 * Markdown. Completion is deliberately local to this browser and document —
 * Verto remains a file reader, not a sync-backed task manager.
 */
export function InteractiveTaskList({ className, ...props }: React.ComponentPropsWithoutRef<"ul">) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const checkboxes = Array.from(
      list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
    if (checkboxes.length === 0) return;

    const storageKey = taskListStorageKey(list);
    const saved = loadTaskState(storageKey);

    checkboxes.forEach((checkbox, index) => {
      checkbox.disabled = false;
      if (typeof saved?.[index] === "boolean") checkbox.checked = saved[index];
      if (!checkbox.hasAttribute("aria-label")) {
        checkbox.setAttribute("aria-label", taskLabel(checkbox, index));
      }
    });

    const persist = (event: Event) => {
      const checkbox = event.target;
      if (!(checkbox instanceof HTMLInputElement) || checkbox.type !== "checkbox") return;
      saveTaskState(
        storageKey,
        checkboxes.map((item) => item.checked)
      );
    };

    list.addEventListener("change", persist);
    return () => list.removeEventListener("change", persist);
  }, []);

  return <ul {...props} ref={listRef} className={joinClassNames("task-list", className)} />;
}

function taskListStorageKey(list: HTMLUListElement): string {
  const lists = Array.from(document.querySelectorAll<HTMLUListElement>("ul.task-list"));
  const index = Math.max(0, lists.indexOf(list));
  return `verto:task-list:${window.location.pathname}:${index}`;
}

function loadTaskState(storageKey: string): boolean[] | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "boolean")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function saveTaskState(storageKey: string, state: boolean[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Private browsing or a full storage quota should never make the reader
    // unusable. The checkbox still works for the current page view.
  }
}

function taskLabel(checkbox: HTMLInputElement, index: number): string {
  const text = checkbox.closest("li")?.textContent?.trim();
  return text ? `Task: ${text}` : `Task ${index + 1}`;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}
