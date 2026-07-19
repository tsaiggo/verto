// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentDirNode, ContentFileNode } from "@/lib/content-source";
import type { RuntimeLocalIndex } from "@/lib/runtime-local-index";
import type { SourceInfo } from "@/lib/source-info";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";

const state = vi.hoisted(() => ({
  runtime: null as RuntimeLocalIndexState | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
}));

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => state.runtime,
}));

vi.mock("@/lib/bookmarks", () => ({
  loadBookmarks: () => [],
  subscribeBookmarks: () => () => {},
}));

vi.mock("@/lib/inbox", () => ({
  getInboxAttentionCount: () => 0,
  loadInbox: () => ({ items: [] }),
  subscribeInbox: () => () => {},
}));

vi.mock("@/lib/onboarding", () => ({
  parseSetupReadiness: () => ({
    source: false,
    assistant: false,
    assistantStatus: "none",
    library: false,
    reading: false,
    onboarding: {},
  }),
  setupReadinessSnapshot: () =>
    JSON.stringify({
      source: false,
      assistant: false,
      assistantStatus: "none",
      library: false,
      reading: false,
      onboarding: {},
    }),
  subscribeSetupReadiness: () => () => {},
  updateOnboardingState: vi.fn(),
}));

import VxRail from "./VxRail";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const staticRoot: ContentDirNode = {
  type: "dir",
  slug: [],
  href: "/read/",
  title: "Home",
  children: [
    {
      type: "file",
      slug: ["demo"],
      href: "/read/demo",
      title: "Static Demo",
      mtime: 0,
      id: "content/demo.mdx",
      ext: ".mdx",
    },
  ],
};

function runtimeNode(
  title: string,
  id: string,
  options: { draft?: boolean; hidden?: boolean } = {}
): ContentFileNode {
  const params = new URLSearchParams({ file: id, title, ext: ".md" });
  return {
    type: "file",
    slug: [title.toLowerCase().replaceAll(" ", "-")],
    href: `/runtime/local?${params.toString()}`,
    title,
    mtime: 1,
    id,
    ext: ".md",
    draft: options.draft,
    hidden: options.hidden,
  };
}

function readyState(nodes: ContentFileNode[]): RuntimeLocalIndexState {
  return {
    status: "ready",
    folder: "C:/Notes",
    index: {
      folder: "C:/Notes",
      documents: nodes.map((node) => ({
        entry: { id: node.id, path: [`${node.title}.md`] },
        node,
        raw: "",
        libraryDoc: {
          title: node.title,
          ext: node.ext,
          href: node.href,
          section: "Local Library",
          tags: [],
          updatedLabel: "just now",
          updatedISO: "2026-07-18T00:00:00.000Z",
          kind: "note",
        },
      })),
      libraryDocs: [],
      searchRecords: [],
      counts: { all: 0, page: 0, heading: 0, code: 0, folder: 0 },
      tags: [],
      tagCounts: [],
    } satisfies RuntimeLocalIndex,
    error: null,
  };
}

async function renderRail(
  overrides: { root?: ContentDirNode; source?: SourceInfo } = {}
): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(VxRail, {
        root: staticRoot,
        source: { kind: "local", name: "Local Library", label: "Local library" },
        ...overrides,
      })
    );
  });
  return { host, root };
}

function documentsNav(host: HTMLElement): HTMLElement {
  const nav = host.querySelector<HTMLElement>('nav[aria-label="Workspace documents"]');
  if (!nav) throw new Error("Workspace documents navigation was not rendered");
  return nav;
}

describe("VxRail runtime document source", () => {
  beforeEach(() => {
    state.runtime = { status: "idle", folder: null, index: null, error: null };
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses build-time documents only while no runtime folder is active", async () => {
    const { host, root } = await renderRail();
    const nav = documentsNav(host);

    expect(nav.textContent).toContain("Static Demo");
    expect(nav.querySelector('a[href="/read/demo"]')).not.toBeNull();

    act(() => root.unmount());
  });

  it("replaces bundled documents with readable runtime documents", async () => {
    const local = runtimeNode("Runtime Note", "C:/Notes/runtime-note.md");
    const draft = runtimeNode("Private Draft", "C:/Notes/private-draft.md", { draft: true });
    const hidden = runtimeNode("Hidden Note", "C:/Notes/hidden-note.md", { hidden: true });
    state.runtime = readyState([local, draft, hidden]);

    const { host, root } = await renderRail();
    const nav = documentsNav(host);

    expect(nav.textContent).toContain("Runtime Note");
    expect(nav.textContent).not.toContain("Static Demo");
    expect(nav.textContent).not.toContain("Private Draft");
    expect(nav.textContent).not.toContain("Hidden Note");
    expect(nav.querySelector('a[href^="/runtime/local?"]')).not.toBeNull();

    act(() => root.unmount());
  });

  it("does not leak bundled documents while the runtime folder is loading", async () => {
    state.runtime = {
      status: "loading",
      folder: "C:/Notes",
      index: null,
      error: null,
    };

    const { host, root } = await renderRail();
    const nav = documentsNav(host);

    expect(nav.textContent).toContain("Loading local documents");
    expect(nav.textContent).not.toContain("Static Demo");
    expect(nav.querySelector('[role="status"]')?.getAttribute("title")).toContain("C:/Notes");

    act(() => root.unmount());
  });

  it("shows an actionable runtime error without falling back to bundled documents", async () => {
    state.runtime = {
      status: "error",
      folder: "C:/Broken",
      index: null,
      error: "Access denied",
    };

    const { host, root } = await renderRail();
    const nav = documentsNav(host);
    const recovery = nav.querySelector<HTMLAnchorElement>('a[href="/integrations#local-files"]');

    expect(nav.textContent).toContain("Local library unavailable");
    expect(nav.textContent).not.toContain("Static Demo");
    expect(recovery?.title).toBe("Access denied");

    act(() => root.unmount());
  });

  it("keeps an empty connected folder distinct from having no source", async () => {
    state.runtime = readyState([]);

    const { host, root } = await renderRail();
    const nav = documentsNav(host);

    expect(nav.textContent).toContain("No readable documents in this folder");
    expect(nav.textContent).not.toContain("Connect your first source");
    expect(nav.textContent).not.toContain("Static Demo");

    act(() => root.unmount());
  });

  it("surfaces a configured build-source error without inventing documents", async () => {
    const source: SourceInfo = {
      kind: "onedrive",
      name: "OneDrive",
      label: "OneDrive · /Knowledge",
      readiness: { status: "error", error: "Repository access denied" },
    };

    const { host, root } = await renderRail({ root: undefined, source });
    const nav = documentsNav(host);
    const recovery = nav.querySelector<HTMLAnchorElement>('a[href="/integrations"]');

    expect(nav.textContent).toContain("Content source unavailable");
    expect(nav.textContent).not.toContain("Static Demo");
    expect(recovery?.title).toBe("Repository access denied");
    expect(host.textContent).toContain("Fix content source");

    act(() => root.unmount());
  });
});
