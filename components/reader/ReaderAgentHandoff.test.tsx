// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchAskAI } from "@/lib/ai/ask-event";
import { APP_NAVIGATION_INTENT_EVENT } from "@/lib/app-navigation";

const mocks = vi.hoisted(() => ({ push: vi.fn(), handoff: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/agent-handoff", () => ({ setAgentHandoff: mocks.handoff }));

import ReaderAgentHandoff from "./ReaderAgentHandoff";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let root: Root | undefined;

async function renderHandoff() {
  const host = document.createElement("div");
  document.body.innerHTML = "<article data-article><p>Rendered document text.</p></article>";
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      createElement(ReaderAgentHandoff, {
        doc: { href: "/read/notes/demo", title: "Demo document", slug: ["notes", "demo"] },
      })
    );
  });
}

describe("ReaderAgentHandoff", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.handoff.mockReset();
  });

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    root = undefined;
    document.body.replaceChildren();
  });

  it("carries actual page context while putting only its identity and prompt in the URL", async () => {
    await renderHandoff();
    dispatchAskAI("  Selected passage  ");
    const prompt = 'About this passage: "Selected passage"\n\n';

    expect(mocks.handoff).toHaveBeenCalledWith({
      source: {
        href: "/read/notes/demo",
        title: "Demo document",
        subtitle: "notes",
        body: "Rendered document text.",
      },
      prompt,
    });
    const destination = new URL(mocks.push.mock.calls[0][0], "http://localhost");
    expect(destination.pathname).toBe("/agent");
    expect(destination.searchParams.get("document")).toBe("/read/notes/demo");
    expect(destination.searchParams.get("prompt")).toBe(prompt);
    expect(destination.searchParams.has("body")).toBe(false);
    expect(destination.href).not.toContain("Rendered");
  });

  it("keeps the existing passage clipping and ignores empty requests", async () => {
    await renderHandoff();
    dispatchAskAI(" ");
    expect(mocks.push).not.toHaveBeenCalled();

    dispatchAskAI("a".repeat(300));
    expect(mocks.handoff.mock.calls[0][0].prompt).toBe(
      `About this passage: "${"a".repeat(280)}…"\n\n`
    );
  });

  it("honors navigation vetoes and removes its listener on unmount", async () => {
    await renderHandoff();
    const veto = (event: Event) => event.preventDefault();
    window.addEventListener(APP_NAVIGATION_INTENT_EVENT, veto);
    try {
      dispatchAskAI("Blocked passage");
      expect(mocks.handoff).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(APP_NAVIGATION_INTENT_EVENT, veto);
    }

    await act(async () => root!.unmount());
    root = undefined;
    dispatchAskAI("Old document passage");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
