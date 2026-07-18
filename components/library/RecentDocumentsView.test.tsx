// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentFileNode } from "@/lib/content-source";

const runtime = vi.hoisted(() => ({
  current: { status: "idle", folder: null, index: null, error: null } as unknown,
}));

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => runtime.current,
}));

import RecentDocumentsView from "./RecentDocumentsView";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function file(title: string, href: string): ContentFileNode {
  return {
    type: "file",
    slug: [title.toLowerCase().replaceAll(" ", "-")],
    href,
    title,
    description: title + " description",
    mtime: Date.parse("2026-07-17T00:00:00.000Z"),
    id: href,
    ext: ".md",
  };
}

async function renderRecent({
  initialLoadFailed = false,
}: {
  initialLoadFailed?: boolean;
} = {}): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(RecentDocumentsView, {
        initialRecent: [file("Configured document", "/read/configured")],
        initialLoadFailed,
      })
    );
  });
  return { host, root };
}

describe("RecentDocumentsView source states", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shows an actionable error when the configured source could not be read", async () => {
    runtime.current = { status: "idle", folder: null, index: null, error: null };
    const { host, root } = await renderRecent({ initialLoadFailed: true });

    expect(host.textContent).toContain("Could not load recent documents");
    expect(host.textContent).not.toContain("Configured document");
    expect(host.querySelector('a[href="/integrations"]')?.textContent).toContain("Manage sources");
    act(() => root.unmount());
  });

  it("uses a ready runtime library even after the configured source failed", async () => {
    runtime.current = {
      status: "ready",
      folder: "C:/notes",
      index: { documents: [{ node: file("Runtime document", "/read/runtime") }] },
      error: null,
    };
    const { host, root } = await renderRecent({ initialLoadFailed: true });

    expect(host.textContent).toContain("Runtime document");
    expect(host.textContent).not.toContain("Configured document");
    expect(host.textContent).not.toContain("Could not load recent documents");
    act(() => root.unmount());
  });
});
