// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SourceInfo } from "@/lib/source-info";

vi.mock("next/navigation", () => ({
  usePathname: () => "/help",
  useRouter: () => ({ push: vi.fn() }),
}));

import VxTopBar from "./VxTopBar";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderTopBar(source: SourceInfo): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(VxTopBar, { source }));
  });
  return { host, root };
}

describe("VxTopBar source status", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("links to recovery when the configured content source cannot be read", async () => {
    const { host, root } = await renderTopBar({
      kind: "onedrive",
      name: "OneDrive",
      label: "OneDrive · /Knowledge",
      readiness: { status: "error", error: "Repository access denied" },
    });
    const recovery = host.querySelector<HTMLAnchorElement>("a.codex-source-warning");

    expect(recovery?.href).toContain("/integrations");
    expect(recovery?.title).toBe("Repository access denied");
    expect(recovery?.getAttribute("aria-label")).toBe(
      "Content source needs attention: Repository access denied"
    );

    act(() => root.unmount());
  });
});
