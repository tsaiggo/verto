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

vi.mock("@/lib/mail/connectors", () => ({ getMailConnectors: () => [connector] }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
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
});
