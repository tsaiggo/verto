// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

interface TestConnection {
  repo: string;
  branch: string;
  path: string;
}

interface TestAuth {
  loading: boolean;
  available: boolean;
  user: null;
  token: string | null;
  connection: TestConnection | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setConnection: () => Promise<void>;
}

// `vi.hoisted` so the (hoisted) `vi.mock` factories may close over this state.
const mocks = vi.hoisted(() => ({
  params: new Map<string, string>(),
  auth: { current: null as TestAuth | null },
  load: {
    current: (async () => "") as (read: () => Promise<string>) => Promise<string>,
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mocks.params.get(key) ?? null,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => mocks.auth.current,
}));

vi.mock("@/lib/tauri", () => ({
  // Throws because the cache loader is mocked: readFile must never be reached.
  tauriFetch: async () => async () => {
    throw new Error("runtime fetch must not run when the cache loader is mocked");
  },
}));

vi.mock("@/lib/runtime-github-cache", () => ({
  loadRuntimeGitHubFile: (_opts: unknown, read: () => Promise<string>) => mocks.load.current(read),
}));

vi.mock("@/components/runtime/RuntimeDocument", () => ({
  RuntimeDocument: ({ source, format }: { source: string; format: string }) =>
    createElement("div", { "data-testid": "runtime-doc", "data-format": format }, source),
}));

vi.mock("@/components/reader/ReadingProgress", () => ({
  default: () => null,
}));

import RuntimeGitHubReader from "@/components/runtime/RuntimeGitHubReader";

function render() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(RuntimeGitHubReader));
  });
  return { host, root };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => {
    root.unmount();
  });
  host.remove();
}

const connectedAuth: TestAuth = {
  loading: false,
  available: true,
  user: null,
  token: "tok",
  connection: { repo: "octo/repo", branch: "main", path: "docs" },
  signIn: async () => {},
  signOut: async () => {},
  setConnection: async () => {},
};

beforeEach(() => {
  mocks.params.clear();
  mocks.auth.current = {
    loading: false,
    available: true,
    user: null,
    token: null,
    connection: null,
    signIn: async () => {},
    signOut: async () => {},
    setConnection: async () => {},
  };
  mocks.load.current = async () => "# unused";
});

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe("RuntimeGitHubReader", () => {
  it("shows a placeholder when no file is selected", () => {
    const { host, root } = render();

    expect(host.textContent).toContain("No runtime file was selected.");
    expect(host.querySelector('[data-testid="runtime-doc"]')).toBeNull();

    cleanup(root, host);
  });

  it("shows a loading state while auth is still hydrating", () => {
    mocks.params.set("file", "guide/setup.md");
    mocks.params.set("title", "Setup");
    mocks.params.set("ext", ".md");
    mocks.auth.current = { ...connectedAuth, loading: true, token: null, connection: null };

    const { host, root } = render();

    expect(host.textContent).toContain("Loading");
    expect(host.textContent).toContain("Setup");

    cleanup(root, host);
  });

  it("prompts to sign in when no token or connection is available", () => {
    mocks.params.set("file", "guide/setup.md");
    mocks.auth.current = { ...connectedAuth, token: null, connection: null };

    const { host, root } = render();

    expect(host.textContent).toContain("Sign in and connect a GitHub repository");

    cleanup(root, host);
  });

  it("reads the file through the runtime source and renders the document", async () => {
    mocks.params.set("file", "guide/setup.md");
    mocks.params.set("title", "Setup Guide");
    mocks.params.set("ext", ".md");
    mocks.auth.current = connectedAuth;
    mocks.load.current = async () => "# Hello from runtime";

    const { host, root } = render();
    await flush();

    const doc = host.querySelector('[data-testid="runtime-doc"]');
    expect(doc).not.toBeNull();
    expect(doc?.textContent).toContain("# Hello from runtime");
    expect(doc?.getAttribute("data-format")).toBe("md");
    expect(host.textContent).toContain("Setup Guide");

    cleanup(root, host);
  });

  it("surfaces an error when the runtime read fails", async () => {
    mocks.params.set("file", "guide/setup.md");
    mocks.params.set("title", "Setup Guide");
    mocks.params.set("ext", ".md");
    mocks.auth.current = connectedAuth;
    mocks.load.current = async () => {
      throw new Error("boom: blob 404");
    };

    const { host, root } = render();
    await flush();

    expect(host.textContent).toContain("Could not open this GitHub file.");
    expect(host.textContent).toContain("boom: blob 404");
    expect(host.querySelector('[data-testid="runtime-doc"]')).toBeNull();

    cleanup(root, host);
  });
});
