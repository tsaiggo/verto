// @vitest-environment jsdom

import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailMessageSummary, MailPage } from "@/lib/mail/model";
import { readDrafts } from "@/lib/mail/drafts";
import { setMailSession } from "@/lib/mail/session";

const connector = vi.hoisted(() => ({
  id: "google" as const,
  label: "Gmail",
  isConfigured: vi.fn(() => true),
  connect: vi.fn(),
  restore: vi.fn(),
  disconnect: vi.fn(),
  listMessages: vi.fn(),
  getMessage: vi.fn(),
  enableSending: vi.fn(),
  sendMessage: vi.fn(),
  getAttachment: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock("@/lib/mail/connectors", () => ({ getMailConnectors: () => [connector] }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.searchParams }));
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
  return host;
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
    navigation.searchParams = new URLSearchParams();
    connector.isConfigured.mockReturnValue(true);
    connector.restore.mockReset();
    connector.connect.mockReset();
    connector.listMessages.mockReset();
    connector.getMessage.mockReset();
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
    setMailSession({ status: "disconnected", connection: null });
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

    expect(page.querySelector("form[aria-label='Message draft']")).toBeNull();
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
    expect(page.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "This is saved before the page closes."
    );
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
    expect(connector.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["reader@example.com"],
        cc: ["reviewer@example.com"],
        bcc: ["archive@example.com"],
        subject: "A real draft",
        bodyText: "Written locally first.",
      })
    );
    expect(page.querySelector("form[aria-label='Message draft']")).toBeNull();
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

    expect(composer.querySelector("[role='alert']")?.textContent).toContain(
      "Mailbox temporarily unavailable"
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
    expect(page.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "This must survive a send failure."
    );
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
    expect(connector.sendMessage).toHaveBeenCalledTimes(1);
    expect(buttonNamed(firstComposer, "Sending…").disabled).toBe(true);

    await act(async () => buttonNamed(page, "Compose").click());
    const nextComposer = page.querySelector<HTMLElement>("form[aria-label='Message draft']")!;
    await changeField(nextComposer, "Subject", "The next message");
    const nextBody = await changeField(nextComposer, "Message body", "Keep my newer words.");
    expect(readDrafts("google:reader@example.com")).toHaveLength(2);
    await act(async () => delivery.resolve());

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
    expect(reopened.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(true);
    await act(async () => sendButton.click());
    expect(connector.sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => delivery.resolve());
    expect(page.textContent).toContain("Message sent.");
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
    expect(readDrafts("google:reader@example.com")).toHaveLength(1);
    await act(async () => root.unmount());
    await act(async () => delivery.resolve());
    expect(readDrafts("google:reader@example.com")).toEqual([]);

    page = await renderWorkspace();
    await showLocalDrafts(page);
    expect(page.textContent).toContain("No local drafts");
    expect(page.textContent).not.toContain("Complete after navigation");
    expect(connector.sendMessage).toHaveBeenCalledTimes(1);
  });
});
