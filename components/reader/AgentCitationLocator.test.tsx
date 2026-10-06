// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { citationHref, documentBlocks } from "@/lib/agent-content/blocks";
import { contentVersion } from "@/lib/agent-content/identity";
import AgentCitationLocator from "./AgentCitationLocator";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
let root: Root;
let host: HTMLDivElement;

describe("Reader citation history changes", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/read/test");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    host?.remove();
  });

  it("moves the citation focus after same-document pushState and replaceState", async () => {
    const source = "First passage.\n\nSecond passage.";
    const version = await contentVersion(source);
    const blocks = documentBlocks(
      {
        id: "test",
        title: "Test",
        href: "/read/test",
        version,
        format: "md",
        draft: false,
        tags: [],
        sourceLabel: "Test",
      },
      source
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () =>
      root.render(
        createElement(
          "section",
          null,
          createElement(
            "article",
            { "data-article": true },
            createElement("p", null, "First passage."),
            createElement("p", null, "Second passage.")
          ),
          createElement(AgentCitationLocator, { source })
        )
      )
    );
    const passages = host.querySelectorAll("p");
    await act(async () =>
      window.history.pushState(null, "", citationHref("/read/test", blocks[0].citation))
    );
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(passages[0].getAttribute("data-agent-source-active")).toBe("true");
    });
    await act(async () =>
      window.history.replaceState(null, "", citationHref("/read/test", blocks[1].citation))
    );
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(passages[1].getAttribute("data-agent-source-active")).toBe("true");
    });
    expect(passages[0].hasAttribute("data-agent-source-active")).toBe(false);
  });
});
