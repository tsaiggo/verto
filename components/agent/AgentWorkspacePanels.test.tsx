// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AgentContext } from "./AgentWorkspacePanels";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const sources = Array.from({ length: 6 }, (_, index) => ({
  title: `Source ${index + 1}`,
  subtitle: "Library",
  href: `/read/source-${index + 1}`,
}));

describe("AgentContext source preview", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("distinguishes the six-item preview from the complete attached source set", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        createElement(AgentContext, {
          sources,
          sourceCount: 8,
          availableSourceCount: 8,
          isReady: true,
          isGrounded: true,
          status: "ready",
          detail: null,
        })
      );
    });

    expect(host.textContent).toContain("6 of 8 sources shown");
    expect(host.textContent).toContain(
      "Workspace answers can search all 8 attached sources; 6 are previewed above."
    );
    expect(host.querySelectorAll(".ag-source")).toHaveLength(6);

    act(() => root.unmount());
  });

  it("keeps attachment limits explicit when only part of the workspace is searchable", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        createElement(AgentContext, {
          sources,
          sourceCount: 8,
          availableSourceCount: 12,
          isReady: true,
          isGrounded: true,
          status: "ready",
          detail: null,
        })
      );
    });

    expect(host.textContent).toContain("6 shown · 8 of 12 attached");
    expect(host.textContent).toContain(
      "This build attaches 8 of 12 workspace documents. Answers cannot search the remaining documents"
    );

    act(() => root.unmount());
  });
});
