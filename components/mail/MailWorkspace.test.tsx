// @vitest-environment jsdom

import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type {
  MailConnection,
  MailConnector,
  MailMessage,
  MailMessageSummary,
  MailMutationResult,
  MailPage,
} from "@/lib/mail/model";
import type { LocalMailStore } from "@/lib/mail/local-types";
import { readDrafts, withDraftStorage } from "@/lib/mail/drafts";
import {
  getMailSession,
  registerMailAccount,
  restoreMailAccounts,
  selectMailAccount,
  setMailSession,
} from "@/lib/mail/session";

const connector = vi.hoisted(() => ({
  id: "google" as const,
  label: "Gmail",
  isConfigured: vi.fn(() => true),
  connect: vi.fn(),
  restore: vi.fn(),
  disconnect: vi.fn(),
  listMessages: vi.fn(),
  getMessage: vi.fn(),
  enableUpdating: vi.fn(),
  mutateMessage: vi.fn(),
  enableSending: vi.fn(),
  sendMessage: vi.fn(),
  getAttachment: vi.fn(),
}));
const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
}));
const storageRuntime = vi.hoisted(() => ({ store: undefined as LocalMailStore | undefined }));

vi.mock("@/lib/mail/connectors", () => ({
  getMailConnectors: () => [connector],
  getRestorableMailConnectors: async () => (connector.isConfigured() ? [connector] : []),
  createMailConnector: () => connector,
}));
vi.mock("@/lib/mail/local-store", async (original) => {
  const actual = await original<typeof import("@/lib/mail/local-store")>();
  return {
    ...actual,
    getLocalMailStore: () => (storageRuntime.store ??= actual.createLocalMailStore()),
  };
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));
vi.mock("@/lib/mail/view-state", async (original) => ({
  ...(await original<typeof import("@/lib/mail/view-state")>()),
  readMailView: () => undefined,
  saveMailView: vi.fn(),
}));
vi.mock("@/components/layout/PageHeader", () => ({ default: () => null }));
vi.mock("@/components/layout/PageFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import MailWorkspace from "./MailWorkspace";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let host: HTMLDivElement;
let root: Root;

async function renderWorkspace(strict = false) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      strict
        ? createElement(StrictMode, null, createElement(MailWorkspace))
        : createElement(MailWorkspace)
    )
  );
  if (getMailSession().status === "restoring")
    await act(async () => {
      await restoreMailAccounts();
    });
  return host;
}

/** Flush React around the real IndexedDB callbacks, then assert the observable result. */
async function eventually(assertion: () => void) {
  await vi.waitFor(
    async () => {
      await act(async () => {
        await withDraftStorage(async () => undefined);
      });
      assertion();
    },
    { timeout: 2000, interval: 10 }
  );
}

function connectedSession() {
  setMailSession({
    status: "connected",
    connection: {
      account: {
        id: "account-1",
        address: "reader@example.com",
        displayName: "Reader",
        provider: "google",
      },
      folders: [{ id: "inbox", name: "Inbox", kind: "inbox" }],
    },
  });
}

function buttonNamed(page: ParentNode, name: string): HTMLButtonElement {
  const button = Array.from(page.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.getAttribute("aria-label") === name || item.textContent?.trim() === name
  );
  if (!button) throw new Error(`Missing button: ${name}`);
  return button;
}

async function changeField(page: ParentNode, label: string, value: string) {
  const control = Array.from(
    page.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
  ).find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      Array.from(item.labels ?? []).some((fieldLabel) => fieldLabel.textContent?.trim() === label)
  );
  if (!control) throw new Error(`Missing draft field: ${label}`);
  await act(async () => {
    const prototype =
      control instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // Drain the shared draft transaction after React schedules the autosave.
  await act(async () => withDraftStorage(async () => undefined));
  return control;
}

function deferredSend() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function prepareConnectedDraft(page: ParentNode, subject: string, body: string) {
  await act(async () => buttonNamed(page, "Compose").click());
  const composer = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
  await changeField(composer, "To", "recipient@example.com");
  await changeField(composer, "Subject", subject);
  await changeField(composer, "Message body", body);
  await act(async () => buttonNamed(composer, "Enable sending").click());
  return composer;
}

async function showLocalDrafts(page: ParentNode) {
  const localDrafts = Array.from(page.querySelectorAll<HTMLButtonElement>("button")).find((item) =>
    item.textContent?.includes("Local drafts")
  );
  if (!localDrafts) throw new Error("Missing Local drafts button");
  await act(async () => localDrafts.click());
}

describe("MailWorkspace status notices", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    storageRuntime.store = undefined;
    navigation.searchParams = new URLSearchParams();
    navigation.push.mockClear();
    navigation.replace.mockClear();
    connector.isConfigured.mockReturnValue(true);
    connector.restore.mockReset();
    connector.connect.mockReset();
    connector.listMessages.mockReset();
    connector.getMessage.mockReset();
    connector.enableUpdating.mockReset();
    connector.mutateMessage.mockReset();
    connector.enableSending.mockReset();
    connector.sendMessage.mockReset();
    connector.getAttachment.mockReset();
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    setMailSession({ status: "disconnected", connection: null });
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    document.body.replaceChildren();
    window.history.replaceState(null, "", "/");
    setMailSession({ status: "disconnected", connection: null });
    vi.unstubAllGlobals();
  });

  it("shows a real folder failure with a retry, then shows the empty folder only after recovery", async () => {
    connectedSession();
    let rejectLoad!: (error: Error) => void;
    const firstLoad = new Promise<MailPage>((_, reject) => {
      rejectLoad = reject;
    });
    connector.listMessages.mockReturnValueOnce(firstLoad).mockResolvedValueOnce({ messages: [] });

    const page = await renderWorkspace();
    expect(page.querySelector("[role='status']")?.textContent).toContain("Loading messages");
    expect(page.textContent).not.toContain("No messages in this folder.");

    await act(async () => rejectLoad(new Error("Session expired")));
    expect(page.querySelector("[role='alert']")?.textContent).toContain("Session expired");
    expect(page.textContent).not.toContain("No messages in this folder.");

    const retry = Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent === "Try again"
    );
    await act(async () => retry?.click());

    expect(connector.listMessages).toHaveBeenCalledTimes(2);
    expect(page.querySelector("[role='alert']")).toBeNull();
    expect(page.textContent).toContain("No messages in this folder.");
  });

  it("explains a failed session restore in the connection card", async () => {
    connector.restore.mockRejectedValueOnce(new Error("Provider sign-in expired"));

    const page = await renderWorkspace();

    expect(page.querySelector("[role='alert']")?.textContent).toContain("Provider sign-in expired");
    expect(page.textContent).toContain("Connect Gmail");
  });

  it("distinguishes missing provider configuration from a configured account awaiting sign-in", async () => {
    connector.isConfigured.mockReturnValue(false);
    const page = await renderWorkspace();
    expect(page.textContent).toContain("Mail is not configured");
    expect(page.textContent).not.toContain("Connect Gmail");
    expect(page.querySelector("[role='alert']")).toBeNull();
    await act(async () => root.unmount());

    connector.isConfigured.mockReturnValue(true);
    connector.restore.mockResolvedValue(null);
    const configuredPage = await renderWorkspace();
    expect(configuredPage.textContent).toContain("Connect your mail");
    expect(configuredPage.textContent).toContain("Connect Gmail");
    expect(configuredPage.textContent).not.toContain("Mail is not configured");
  });

  it("filters loaded messages and distinguishes no matches from an empty folder", async () => {
    connectedSession();
    connector.listMessages.mockResolvedValue({
      messages: [
        {
          id: "read",
          subject: "Reading notes",
          from: "Ada",
          receivedAt: "2026-09-01T12:00:00Z",
          preview: "Saved notes",
          isRead: true,
          hasAttachments: false,
        },
      ],
    });
    const page = await renderWorkspace();
    expect(page.textContent).toContain("Select a message to read it.");
    const unread = Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent === "Unread"
    );
    await act(async () => unread?.click());
    expect(page.textContent).toContain("No matching messages");
    expect(page.textContent).not.toContain("No messages in this folder.");
    const clear = Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear filters"
    );
    await act(async () => clear?.click());
    expect(page.textContent).toContain("Reading notes");
    const search = page.querySelector<HTMLInputElement>("[aria-label='Search loaded messages']")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        search,
        "missing"
      );
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(page.textContent).toContain("No matching messages");
  });

  it("retains message URL selection and retries message content in place", async () => {
    connectedSession();
    navigation.searchParams = new URLSearchParams("folder=inbox&message=message-1");
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.getMessage
      .mockRejectedValueOnce(new Error("Message temporarily unavailable"))
      .mockResolvedValueOnce({
        id: "message-1",
        subject: "A real message",
        from: "Ada",
        to: ["reader@example.com"],
        receivedAt: "2026-09-01T12:00:00Z",
        preview: "Preview",
        bodyText: "Message body",
        isRead: false,
        hasAttachments: false,
      });
    const page = await renderWorkspace();
    const preview = page.querySelector("[aria-label='Message preview']")!;
    expect(preview.textContent).toContain("Message temporarily unavailable");
    const retry = Array.from(preview.querySelectorAll("button")).find(
      (button) => button.textContent === "Try again"
    );
    await act(async () => retry?.click());
    expect(connector.getMessage).toHaveBeenCalledTimes(2);
    expect(preview.textContent).toContain("Message body");
    expect(preview.querySelector("a")?.getAttribute("href")).toBe("/mail?folder=inbox");
  });

  it("retries a failed next page without replacing the loaded messages", async () => {
    connectedSession();
    const first: MailMessageSummary = {
      id: "first",
      subject: "First message",
      from: "Ada",
      receivedAt: "2026-09-01T12:00:00.000Z",
      preview: "First preview",
      isRead: false,
      hasAttachments: false,
    };
    const second = { ...first, id: "second", subject: "Second message" };
    connector.listMessages
      .mockResolvedValueOnce({ messages: [first], nextPageUrl: "next" })
      .mockRejectedValueOnce(new Error("Next page failed"))
      .mockResolvedValueOnce({ messages: [second] });

    const page = await renderWorkspace();
    const loadMore = Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent === "Load more"
    );
    await act(async () => loadMore?.click());

    expect(page.querySelector("[role='alert']")?.textContent).toContain("Next page failed");
    expect(page.textContent).toContain("First message");

    const retry = Array.from(page.querySelectorAll("button")).find(
      (button) => button.textContent === "Try again"
    );
    await act(async () => retry?.click());

    expect(connector.listMessages).toHaveBeenNthCalledWith(3, "inbox", "next");
    expect(page.querySelector("[role='alert']")).toBeNull();
    expect(page.textContent).toContain("First message");
    expect(page.textContent).toContain("Second message");
  });

  it("loads the requested folder and keeps folder navigation in the URL", async () => {
    navigation.searchParams = new URLSearchParams("folder=archive");
    setMailSession({
      status: "connected",
      connection: {
        account: {
          id: "account-1",
          address: "reader@example.com",
          displayName: "Reader",
          provider: "google",
        },
        folders: [
          { id: "inbox", name: "Inbox", kind: "inbox" },
          { id: "archive", name: "Archive", kind: "archive" },
        ],
      },
    });
    connector.listMessages.mockResolvedValue({ messages: [] });

    const page = await renderWorkspace();
    const folders = page.querySelector<HTMLElement>("[aria-label='Mail folders']");
    const archive = Array.from(folders?.querySelectorAll("a") ?? []).find(
      (link) => link.textContent === "Archive"
    );

    expect(connector.listMessages).toHaveBeenCalledWith("archive");
    expect(archive?.getAttribute("href")).toBe("/mail?folder=archive");
    expect(archive?.getAttribute("aria-current")).toBe("page");
  });

  it("isolates the explicit sample inbox and simulated send from configured providers", async () => {
    navigation.searchParams = new URLSearchParams("demo=1");
    connector.restore.mockRejectedValue(new Error("A real provider must not be opened"));
    const page = await renderWorkspace(true);
    expect(page.textContent).toContain("Design review notes and next steps");
    await act(async () => buttonNamed(page, "Compose").click());
    const composer = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    expect(composer).not.toBeNull();
    await changeField(composer, "To", "reader@example.com");
    await changeField(composer, "Subject", "Simulated message");
    await changeField(composer, "Message body", "A preview message.");
    await act(async () => buttonNamed(composer, "Send preview").click());
    await eventually(() =>
      expect(page.querySelector("form[aria-label='Message draft']")).toBeNull()
    );
    expect(page.textContent).toMatch(/preview|simulat/i);
    expect(connector.restore).not.toHaveBeenCalled();
    expect(connector.connect).not.toHaveBeenCalled();
    expect(connector.listMessages).not.toHaveBeenCalled();
    expect(connector.getMessage).not.toHaveBeenCalled();
    expect(connector.enableSending).not.toHaveBeenCalled();
    expect(connector.sendMessage).not.toHaveBeenCalled();
  });

  it("restores an autosaved sample draft after the workspace is remounted", async () => {
    navigation.searchParams = new URLSearchParams("demo=1");
    let page = await renderWorkspace();
    await act(async () => buttonNamed(page, "Compose").click());
    const composer = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    await changeField(composer, "To", "reader@example.com");
    await changeField(composer, "Subject", "Return to this local draft");
    await changeField(composer, "Message body", "This is saved before the page closes.");
    expect(composer.querySelector("[role='alert']")).toBeNull();
    await act(async () => root.unmount());
    page = await renderWorkspace();
    await act(async () => {
      Array.from(page.querySelectorAll<HTMLButtonElement>("button"))
        .find((item) => item.textContent?.includes("Local drafts"))!
        .click();
    });
    await act(async () => {
      Array.from(page.querySelectorAll<HTMLButtonElement>("button"))
        .find((item) => item.textContent?.includes("Return to this local draft"))!
        .click();
    });
    expect(
      page.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message body"]')?.value
    ).toBe("This is saved before the page closes.");
  });

  it("requires explicit send permission, validates recipients, and delegates a valid send", async () => {
    connectedSession();
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.enableSending.mockResolvedValue(undefined);
    connector.sendMessage.mockResolvedValue(undefined);
    const page = await renderWorkspace();
    await act(async () => buttonNamed(page, "Compose").click());
    const composer = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    await changeField(composer, "To", "reader@example.com");
    await changeField(composer, "Subject", "A real draft");
    await changeField(composer, "Message body", "Written locally first.");
    expect(connector.enableSending).not.toHaveBeenCalled();
    expect(connector.sendMessage).not.toHaveBeenCalled();
    await act(async () => buttonNamed(composer, "Enable sending").click());
    expect(connector.enableSending).toHaveBeenCalledTimes(1);
    expect(connector.sendMessage).not.toHaveBeenCalled();
    await changeField(composer, "To", "missing-address");
    await act(async () => buttonNamed(composer, "Send mail").click());
    expect(composer.querySelector("[role='alert']")?.textContent).toMatch(
      /email|address|recipient/i
    );
    expect(connector.sendMessage).not.toHaveBeenCalled();

    await changeField(composer, "To", "reader@example.com");
    await act(async () => buttonNamed(composer, "Cc").click());
    await act(async () => buttonNamed(composer, "Bcc").click());
    await changeField(composer, "Cc", "reviewer@example.com");
    await changeField(composer, "Bcc", "archive@example.com");
    await act(async () => buttonNamed(composer, "Send mail").click());
    await eventually(() => expect(connector.sendMessage).toHaveBeenCalledTimes(1));
    expect(connector.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["reader@example.com"],
        cc: ["reviewer@example.com"],
        bcc: ["archive@example.com"],
        subject: "A real draft",
        bodyText: "Written locally first.",
      })
    );
    await eventually(() =>
      expect(page.querySelector("form[aria-label='Message draft']")).toBeNull()
    );
  });

  it("keeps the draft editable when the provider rejects sending", async () => {
    connectedSession();
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.enableSending.mockResolvedValue(undefined);
    connector.sendMessage.mockRejectedValue(new Error("Mailbox temporarily unavailable"));
    const page = await renderWorkspace();
    await act(async () => buttonNamed(page, "Compose").click());
    const composer = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    await changeField(composer, "To", "reader@example.com");
    await changeField(composer, "Subject", "Keep this draft");
    const body = await changeField(composer, "Message body", "This must survive a send failure.");
    await act(async () => buttonNamed(composer, "Enable sending").click());
    await act(async () => buttonNamed(composer, "Send mail").click());
    await eventually(() =>
      expect(composer.querySelector("[role='alert']")?.textContent).toContain(
        "Mailbox temporarily unavailable"
      )
    );
    expect(page.querySelector("form[aria-label='Message draft']")).toBe(composer);
    expect(body.value).toBe("This must survive a send failure.");
    await act(async () => buttonNamed(composer, "Save & close").click());
    await act(async () => {
      const localDrafts = Array.from(page.querySelectorAll<HTMLButtonElement>("button")).find(
        (item) => item.textContent?.includes("Local drafts")
      )!;
      localDrafts.click();
    });
    await act(async () => {
      const draft = Array.from(page.querySelectorAll<HTMLButtonElement>("button")).find((item) =>
        item.textContent?.includes("Keep this draft")
      )!;
      draft.click();
    });
    expect(
      page.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message body"]')?.value
    ).toBe("This must survive a send failure.");
  });

  it("removes a confirmed sent draft while preserving a newer active draft", async () => {
    connectedSession();
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.enableSending.mockResolvedValue(undefined);
    const delivery = deferredSend();
    connector.sendMessage.mockReturnValue(delivery.promise);
    const page = await renderWorkspace();
    const firstComposer = await prepareConnectedDraft(page, "Original message", "Original body.");
    const originalId = readDrafts("google:reader@example.com")[0].id;
    await act(async () => buttonNamed(firstComposer, "Send mail").click());
    await eventually(() => expect(connector.sendMessage).toHaveBeenCalledTimes(1));
    expect(buttonNamed(firstComposer, "Sending…").disabled).toBe(true);

    await act(async () => buttonNamed(page, "Compose").click());
    const nextComposer = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    await changeField(nextComposer, "Subject", "The next message");
    const nextBody = await changeField(nextComposer, "Message body", "Keep my newer words.");
    expect(readDrafts("google:reader@example.com")).toHaveLength(2);
    await act(async () => delivery.resolve());
    await eventually(() => expect(page.textContent).toContain("Message sent."));

    expect(page.querySelector("form[aria-label='Message draft']")).toBe(nextComposer);
    expect(nextBody.value).toBe("Keep my newer words.");
    expect(page.textContent).toContain("Message sent.");
    const saved = readDrafts("google:reader@example.com");
    expect(saved.map((draft) => draft.id)).not.toContain(originalId);
    expect(saved).toMatchObject([
      { subject: "The next message", bodyText: "Keep my newer words." },
    ]);
  });

  it("prevents another send when a pending draft is reopened", async () => {
    connectedSession();
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.enableSending.mockResolvedValue(undefined);
    const delivery = deferredSend();
    connector.sendMessage.mockReturnValue(delivery.promise);
    const page = await renderWorkspace();
    const firstComposer = await prepareConnectedDraft(page, "Waiting for delivery", "Send once.");
    await act(async () => buttonNamed(firstComposer, "Send mail").click());
    await eventually(() => expect(connector.sendMessage).toHaveBeenCalledTimes(1));
    await act(async () => buttonNamed(page, "Compose").click());
    await showLocalDrafts(page);
    const originalRow = Array.from(page.querySelectorAll<HTMLButtonElement>("button")).find(
      (item) => item.textContent?.includes("Waiting for delivery")
    )!;
    await act(async () => originalRow.click());
    const reopened = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    expect(reopened).not.toBe(firstComposer);
    const sendButton = buttonNamed(reopened, "Sending…");
    expect(sendButton.disabled).toBe(true);
    expect(
      reopened.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message body"]')?.disabled
    ).toBe(true);
    await act(async () => sendButton.click());
    expect(connector.sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => delivery.resolve());
    await eventually(() => expect(page.textContent).toContain("Message sent."));
    expect(
      readDrafts("google:reader@example.com").some(
        (draft) => draft.subject === "Waiting for delivery"
      )
    ).toBe(false);
  });

  it("cleans a confirmed sent draft after the entire workspace has unmounted", async () => {
    connectedSession();
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.enableSending.mockResolvedValue(undefined);
    const delivery = deferredSend();
    connector.sendMessage.mockReturnValue(delivery.promise);
    let page = await renderWorkspace();
    const composer = await prepareConnectedDraft(
      page,
      "Complete after navigation",
      "The provider is still working."
    );
    await act(async () => buttonNamed(composer, "Send mail").click());
    await eventually(() => expect(connector.sendMessage).toHaveBeenCalledTimes(1));
    expect(readDrafts("google:reader@example.com")).toHaveLength(1);
    await act(async () => root.unmount());
    await act(async () => delivery.resolve());
    await eventually(() => expect(readDrafts("google:reader@example.com")).toEqual([]));

    page = await renderWorkspace();
    await showLocalDrafts(page);
    expect(page.textContent).toContain("No local drafts");
    expect(page.textContent).not.toContain("Complete after navigation");
    expect(connector.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("finishes an All inboxes send after the account set changes without retaining or resurrecting the sent draft", async () => {
    connectedSession();
    const firstConnection = getMailSession().connection!;
    const otherConnection: MailConnection = {
      account: {
        id: "other-account",
        address: "other@example.com",
        displayName: "Other",
        provider: "google",
      },
      folders: [{ id: "other-inbox", name: "Inbox", kind: "inbox" }],
    };
    const otherConnector: MailConnector = {
      ...connector,
      listMessages: vi.fn(async () => ({ messages: [] })),
      getMessage: vi.fn(),
      enableSending: vi.fn(async () => undefined),
      sendMessage: vi.fn(async () => undefined),
    };
    registerMailAccount(otherConnector, otherConnection, { select: false });
    selectMailAccount("all");
    navigation.searchParams = new URLSearchParams("account=all");
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.enableSending.mockResolvedValue(undefined);
    const delivery = deferredSend();
    connector.sendMessage.mockReturnValueOnce(delivery.promise);
    const page = await renderWorkspace();
    const composer = await prepareConnectedDraft(
      page,
      "Finish once across account changes",
      "Keep the account captured by this send."
    );
    const sentId = readDrafts("google:reader@example.com")[0].id;
    await act(async () => buttonNamed(composer, "Send mail").click());
    await eventually(() => expect(connector.sendMessage).toHaveBeenCalledTimes(1));
    expect(buttonNamed(composer, "Sending…").disabled).toBe(true);
    const addedConnection: MailConnection = {
      ...otherConnection,
      account: {
        ...otherConnection.account,
        id: "third-account",
        address: "third@example.com",
        displayName: "Third",
      },
    };
    const addedConnector: MailConnector = {
      ...otherConnector,
      listMessages: vi.fn(async () => ({ messages: [] })),
      sendMessage: vi.fn(async () => undefined),
    };
    await act(async () => {
      registerMailAccount(addedConnector, addedConnection, { select: false });
    });
    expect(getMailSession().activeAccountId).toBe("all");
    expect(page.querySelector("form[aria-label='Message draft']")).toBe(composer);
    expect(buttonNamed(composer, "Sending…").disabled).toBe(true);
    await act(async () => delivery.resolve());
    await eventually(() =>
      expect(page.querySelector("form[aria-label='Message draft']")).toBeNull()
    );
    expect(page.textContent).toContain("Message sent.");
    expect(readDrafts("google:reader@example.com").some((draft) => draft.id === sentId)).toBe(
      false
    );
    expect(connector.sendMessage).toHaveBeenCalledTimes(1);
    expect(otherConnector.sendMessage).not.toHaveBeenCalled();
    expect(addedConnector.sendMessage).not.toHaveBeenCalled();
    await act(async () => buttonNamed(page, "Compose").click());
    const next = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    await changeField(next, "Subject", "A fresh draft after completion");
    expect(readDrafts("google:reader@example.com")).toMatchObject([
      { subject: "A fresh draft after completion" },
    ]);
    expect(readDrafts("google:reader@example.com").some((draft) => draft.id === sentId)).toBe(
      false
    );
    expect(getMailSession().accounts[0].connection).toBe(firstConnection);
  });

  it("pins a legacy URL's mailbox while an added account selects itself before navigation commits", async () => {
    connectedSession();
    navigation.searchParams = new URLSearchParams("folder=inbox&message=shared-provider-id");
    connector.listMessages.mockResolvedValue({ messages: [] });
    connector.getMessage.mockResolvedValue({
      id: "shared-provider-id",
      subject: "Personal message",
      from: "Personal sender",
      to: ["reader@example.com"],
      receivedAt: "2026-10-01T08:00:00Z",
      preview: "Personal preview",
      bodyText: "Personal body",
      isRead: true,
      hasAttachments: false,
    });
    const page = await renderWorkspace();
    expect(connector.getMessage).toHaveBeenCalledExactlyOnceWith("shared-provider-id");
    expect(page.textContent).toContain("Personal body");
    const workConnection: MailConnection = {
      account: {
        id: "work-account",
        address: "work@example.com",
        displayName: "Work",
        provider: "google",
      },
      folders: [{ id: "inbox", name: "Inbox", kind: "inbox" }],
    };
    const workConnector: MailConnector = {
      ...connector,
      listMessages: vi.fn(async () => ({ messages: [] })),
      getMessage: vi.fn(async (id) => ({
        id,
        subject: "Work message",
        from: "Work sender",
        to: ["work@example.com"],
        receivedAt: "2026-10-01T08:00:00Z",
        preview: "Work preview",
        bodyText: "Work body",
        isRead: true,
        hasAttachments: false,
      })),
    };
    await act(async () => {
      registerMailAccount(workConnector, workConnection);
    });
    expect(getMailSession().activeAccountId).toBe("google:work-account");
    // The mocked router has not committed the account URL yet. Never interpret the old raw ID in Work.
    expect(navigation.searchParams.has("account")).toBe(false);
    expect(workConnector.getMessage).not.toHaveBeenCalled();
    expect(page.textContent).toContain("Personal body");
    expect(page.textContent).not.toContain("Work body");
    navigation.searchParams = new URLSearchParams("account=google%3Awork-account");
    await act(async () => root.render(createElement(MailWorkspace)));
    await eventually(() =>
      expect(workConnector.listMessages).toHaveBeenCalledWith("inbox", undefined)
    );
    await act(async () => {
      await getMailSession()
        .accounts.find((entry) => entry.id === "google:work-account")!
        .connector.local?.synchronize("inbox");
    });
    expect(workConnector.getMessage).not.toHaveBeenCalled();
    expect(page.textContent).not.toContain("Personal body");
    navigation.searchParams = new URLSearchParams(
      "account=google%3Awork-account&folder=inbox&message=work-only-id"
    );
    await act(async () => root.render(createElement(MailWorkspace)));
    await eventually(() => expect(page.textContent).toContain("Work body"));
    expect(workConnector.getMessage).toHaveBeenCalledWith("work-only-id");
    expect(
      vi.mocked(workConnector.getMessage).mock.calls.every(([id]) => id === "work-only-id")
    ).toBe(true);
    expect(page.textContent).toContain("Work body");
    expect(connector.getMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps the current label reader when an archive started in Inbox finishes after navigation", async () => {
    connectedSession();
    setMailSession({
      status: "connected",
      connection: {
        ...getMailSession().connection!,
        folders: [
          { id: "inbox", name: "Inbox", kind: "inbox" },
          { id: "project-label", name: "Project", kind: "custom" },
        ],
      },
    });
    const message: MailMessage = {
      id: "shared-provider-id",
      subject: "Message in both folders",
      from: "Ada",
      to: ["reader@example.com"],
      receivedAt: "2026-10-01T08:00:00Z",
      preview: "Project preview",
      bodyText: "Keep this labeled message open.",
      isRead: true,
      hasAttachments: false,
    };
    connector.listMessages.mockResolvedValue({ messages: [message] });
    connector.getMessage.mockResolvedValue(message);
    connector.enableUpdating.mockResolvedValue(undefined);
    let resolveMutation!: (result: MailMutationResult) => void;
    const mutation = new Promise<MailMutationResult>((resolve) => {
      resolveMutation = resolve;
    });
    connector.mutateMessage.mockReturnValue(mutation);
    navigation.searchParams = new URLSearchParams("folder=inbox&message=shared-provider-id");
    window.history.replaceState(null, "", `/mail?${navigation.searchParams}`);
    const page = await renderWorkspace();

    await act(async () => buttonNamed(page, "Archive message").click());
    expect(connector.mutateMessage).toHaveBeenCalledExactlyOnceWith("shared-provider-id", {
      type: "archive",
    });
    expect(page.querySelector("[aria-label='Message actions']")?.getAttribute("aria-busy")).toBe(
      "true"
    );

    navigation.searchParams = new URLSearchParams(
      "folder=project-label&message=shared-provider-id"
    );
    window.history.replaceState(null, "", `/mail?${navigation.searchParams}`);
    await act(async () => root.render(createElement(MailWorkspace)));
    expect(page.querySelector("[aria-label='Message preview']")?.textContent).toContain(
      message.bodyText
    );
    const currentUrl = window.location.href;
    expect(new URL(currentUrl).searchParams.get("folder")).toBe("project-label");
    await act(async () => {
      resolveMutation({ message, folderIds: ["project-label", "ARCHIVE"] });
      await mutation;
    });

    expect(window.location.href).toBe(currentUrl);
    expect(new URL(window.location.href).searchParams.get("message")).toBe("shared-provider-id");
    expect(page.querySelector("[aria-label='Message preview']")?.textContent).toContain(
      message.bodyText
    );
    expect(page.querySelector("[aria-label='Message preview']")?.textContent).not.toContain(
      "Select a message to read it."
    );
    expect(
      page.querySelector("[aria-label='Mail folders'] a[aria-current='page']")?.textContent
    ).toBe("Project");
  });
});
