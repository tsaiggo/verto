// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EnvironmentPanelProvider } from "@/components/state/EnvironmentPanelState";
import HomeEnvironmentCard from "./HomeEnvironmentCard";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

describe("HomeEnvironmentCard", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows real library context without inventing Git state", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        createElement(
          EnvironmentPanelProvider,
          null,
          createElement(HomeEnvironmentCard, {
            documents: [
              {
                href: "/read/getting-started",
                title: "Getting started",
                section: "Overview",
                iso: null,
                relative: "",
              },
            ],
            source: {
              mode: "local-ready",
              sourceLabel: "Folder · Notes",
              sourceTitle: "C:\\Notes",
              documentCount: 12,
              sectionCount: 3,
              documentLabel: "12 documents",
              sectionLabel: "3 sections",
            },
          })
        )
      );
    });

    const panel = host.querySelector<HTMLElement>('[aria-label="Task environment"]');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("Environment");
    expect(panel?.textContent).toContain("12 documents");
    expect(panel?.textContent).toContain("Folder · Notes");
    expect(panel?.textContent).toContain("Getting started");
    expect(panel?.textContent).not.toMatch(/commit|push|branch|synced/i);
    expect(
      Array.from(panel?.querySelectorAll("a") ?? []).map((link) => link.getAttribute("href"))
    ).toEqual(expect.arrayContaining(["/library", "/integrations", "/read/getting-started"]));

    act(() => root.unmount());
  });
});
