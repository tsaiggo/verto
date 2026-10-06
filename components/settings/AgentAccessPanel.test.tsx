// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  available: true,
  create: vi.fn(),
  revoke: vi.fn(),
  list: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/lib/agent-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agent-access")>()),
  agentAccessAvailable: () => api.available,
  createAgentAccessGrant: api.create,
  revokeAgentAccessGrant: api.revoke,
  listAgentAccessGrants: api.list,
  getAgentAccessManifestInfo: api.info,
}));
vi.mock("@/lib/browser-articles", () => ({
  listBrowserArticles: async () => [
    { id: "a", filename: "alpha.md", title: "Alpha", status: "saved" },
    { id: "b", filename: "draft.md", title: "Private draft", status: "draft" },
  ],
}));
import AgentAccessPanel from "./AgentAccessPanel";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

let root: Root;
let host: HTMLDivElement;
const grant = {
  id: "client-a",
  name: "Codex",
  managedRoot: "C:/content",
  scopes: ["documents:read"],
  includeDrafts: false,
  createdAt: "2026-10-06T00:00:00Z",
};

async function render() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(createElement(AgentAccessPanel));
  });
}

function button(text: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
    item.textContent?.includes(text)
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

describe("Agent access settings", () => {
  beforeEach(() => {
    api.available = true;
    api.create.mockReset();
    api.revoke.mockReset();
    api.list.mockReset();
    api.info.mockReset();
    api.info.mockResolvedValue({
      manifestPath: "C:/agent-access.json",
      managedRoot: "C:/content",
      serverPath: "C:/Verto/mcp/verto-mcp.mjs",
      availableVaultRoot: "C:/notes",
    });
    api.list.mockResolvedValue([]);
    api.create.mockResolvedValue({
      grant,
      token: "shown-once",
      manifestPath: "C:/agent-access.json",
      serverPath: "C:/Verto/mcp/verto-mcp.mjs",
    });
    api.revoke.mockResolvedValue({ revoked: true });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    host?.remove();
  });

  it("explains desktop access in the browser without creating grants", async () => {
    api.available = false;
    await render();
    expect(host.textContent).toContain("available in the Verto desktop app");
    expect(api.info).not.toHaveBeenCalled();
    expect(host.querySelector("form")).toBeNull();
  });

  it("keeps drafts and annotations opt-in and rejects an empty selection", async () => {
    await render();
    await act(async () => button("Authorize a client").click());
    const inputs = [...host.querySelectorAll<HTMLInputElement>("input")];
    expect(inputs.filter((item) => item.type === "checkbox").every((item) => !item.checked)).toBe(
      true
    );
    await act(async () =>
      host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click()
    );
    expect(host.textContent).toContain("Alpha");
    expect(host.textContent).not.toContain("Private draft");
    expect(button("Authorize client").disabled).toBe(true);
  });

  it("revokes an authorized client and removes its UI entry", async () => {
    api.list.mockResolvedValue([grant]);
    await render();
    expect(host.textContent).toContain("Codex");
    await act(async () => button("Revoke").click());
    expect(api.revoke).toHaveBeenCalledWith("client-a");
    expect(host.textContent).toContain("No external clients have access");
  });

  it("authorizes selected documents with separate annotation consent and dismisses the once-visible token", async () => {
    await render();
    await act(async () => button("Authorize a client").click());
    const name = host.querySelector<HTMLInputElement>(
      'input[placeholder="For example, Codex on this computer"]'
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        name,
        "Codex"
      );
      name.dispatchEvent(new Event("input", { bubbles: true }));
      host.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
    });
    await act(async () => {
      host.querySelector<HTMLInputElement>("fieldset input[type='checkbox']")?.click();
      [...host.querySelectorAll("label")]
        .find((item) => item.textContent?.includes("Include annotations"))
        ?.querySelector<HTMLInputElement>("input")
        ?.click();
    });
    await act(async () =>
      host
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(api.create).toHaveBeenCalledWith({
      name: "Codex",
      documentIds: ["managed:a"],
      includeDrafts: false,
      scopes: ["documents:read", "annotations:read"],
    });
    expect(host.textContent).toContain("shown-once");
    expect(host.textContent).toContain("Node.js 20.19");
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('button[aria-label="Dismiss client credentials"]')
        ?.click()
    );
    expect(host.textContent).not.toContain("shown-once");
  });
});
