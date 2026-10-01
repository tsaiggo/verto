// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readDrafts, withDraftStorage } from "@/lib/mail/drafts";
import type { MailConnection, MailConnector } from "@/lib/mail/model";

const runtime = vi.hoisted(() => ({
  saveGate: undefined as Promise<void> | undefined,
  failedSave: false,
  onSelect: undefined as ((id: string) => void) | undefined,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("account=all") }));
vi.mock("@/lib/mail/view-state", async (original) => ({
  ...(await original<typeof import("@/lib/mail/view-state")>()),
  readMailView: () => undefined,
  saveMailView: vi.fn(),
}));
vi.mock("@/lib/mail/drafts", async (original) => {
  const actual = await original<typeof import("@/lib/mail/drafts")>();
  return {
    ...actual,
    saveMailDraftWithStatus: async (...args: Parameters<typeof actual.saveMailDraftWithStatus>) => {
      await runtime.saveGate;
      return runtime.failedSave
        ? { status: "unavailable" as const }
        : actual.saveMailDraftWithStatus(...args);
    },
  };
});
vi.mock("./MailFromPicker", () => ({
  default: ({ disabled, onSelect }: { disabled: boolean; onSelect: (id: string) => void }) => {
    runtime.onSelect = onSelect;
    return createElement(
      "button",
      { type: "button", disabled, "aria-label": "From account" },
      "From account"
    );
  },
}));

import MailWorkbench from "./MailWorkbench";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
const sourceKey = "google:reader@example.com";
const targetKey = "microsoft:work@example.com";
let host: HTMLDivElement;
let root: Root;

function setField(field: HTMLTextAreaElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function button(name: string): HTMLButtonElement {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.getAttribute("aria-label") === name || item.textContent?.trim() === name
  );
  if (!found) throw new Error(`Button not found: ${name}`);
  return found;
}

async function eventually(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => withDraftStorage(async () => undefined));
    assertion();
  });
}

async function renderDraft() {
  const sendMessage = vi.fn(async () => {});
  const source: MailConnection = {
    account: {
      provider: "google",
      id: "source",
      address: "reader@example.com",
      displayName: "Reader",
    },
    folders: [{ id: "inbox", name: "Inbox", kind: "inbox" }],
  };
  const target: MailConnection = {
    account: {
      provider: "microsoft",
      id: "target",
      address: "work@example.com",
      displayName: "Work",
    },
    folders: [{ id: "inbox", name: "Inbox", kind: "inbox" }],
  };
  const connector: MailConnector = {
    id: "google",
    label: "Gmail",
    isConfigured: () => true,
    connect: async () => {},
    restore: async () => source,
    disconnect: async () => {},
    listMessages: async () => ({ messages: [] }),
    getMessage: async () => {
      throw new Error("Not used");
    },
    enableSending: async () => {},
    sendMessage,
  };
  await act(async () =>
    root.render(
      createElement(MailWorkbench, {
        connector,
        connection: source,
        scopeId: "all",
        demo: false,
        accounts: [
          { id: "google:source", connector, connection: source, status: "connected" },
          {
            id: "microsoft:target",
            connector: { ...connector, id: "microsoft" },
            connection: target,
            status: "connected",
          },
        ],
      })
    )
  );
  await act(async () => button("Compose").click());
  const body = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message body"]')!;
  await act(async () => setField(body, "Previously saved words"));
  await eventually(() => expect(readDrafts(sourceKey)[0].bodyText).toBe("Previously saved words"));
  await act(async () => button("Enable sending").click());
  return { body, sendMessage };
}

describe("changing a draft's sending account", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    runtime.saveGate = undefined;
    runtime.failedSave = false;
    runtime.onSelect = undefined;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("locks queued edits, send, close and discard while waiting for the latest autosave, then moves its full saved content", async () => {
    const { body, sendMessage } = await renderDraft();
    let release!: () => void;
    runtime.saveGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await act(async () => setField(body, "Latest words awaiting storage"));
    expect(readDrafts(sourceKey)[0].bodyText).toBe("Previously saved words");
    const form = host.querySelector<HTMLFormElement>('form[aria-label="Message draft"]')!;
    await act(async () => {
      runtime.onSelect!("microsoft:target");
      // These events arrive before React renders disabled controls.
      setField(body, "An attempted edit during movement");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      button("Save & close").click();
      button("Discard draft").click();
    });
    expect(body.disabled).toBe(true);
    expect(button("From account").disabled).toBe(true);
    expect(button("Changing account…").disabled).toBe(true);
    expect(button("Save & close").disabled).toBe(true);
    expect(button("Discard draft").disabled).toBe(true);
    expect(host.querySelector("form")).toBe(form);
    expect(sendMessage).not.toHaveBeenCalled();
    await act(async () => release());
    await eventually(() =>
      expect(readDrafts(targetKey)[0]?.bodyText).toBe("Latest words awaiting storage")
    );
    expect(readDrafts(sourceKey)).toEqual([]);
    expect(
      host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message body"]')?.value
    ).toBe("Latest words awaiting storage");
    expect(host.textContent).not.toContain("Changing account…");
    expect(button("Save & close").disabled).toBe(false);
  });

  it("keeps unsaved words in the original account when the awaited autosave fails, and unlocks recovery", async () => {
    const { body } = await renderDraft();
    let release!: () => void;
    runtime.saveGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    runtime.failedSave = true;
    await act(async () => setField(body, "Keep these words after storage fails"));
    await act(async () => {
      runtime.onSelect!("microsoft:target");
    });
    await act(async () => release());
    await eventually(() => expect(host.textContent).toContain("Save this draft's latest changes"));
    expect(readDrafts(targetKey)).toEqual([]);
    expect(readDrafts(sourceKey)[0].bodyText).toBe("Previously saved words");
    expect(body.value).toBe("Keep these words after storage fails");
    expect(body.disabled).toBe(false);
  });
});
