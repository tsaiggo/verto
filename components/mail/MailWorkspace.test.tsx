// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailMessageSummary, MailPage } from "@/lib/mail/model";
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

async function renderWorkspace() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(MailWorkspace)));
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

describe("MailWorkspace status notices", () => {
  beforeEach(() => {
    navigation.searchParams = new URLSearchParams();
    connector.isConfigured.mockReturnValue(true);
    connector.restore.mockReset();
    connector.listMessages.mockReset();
    connector.getMessage.mockReset();
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
});
