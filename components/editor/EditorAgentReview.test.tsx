// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  proposalFromResponse,
  type EditorSuggestionClient,
  type EditorSuggestionInput,
} from "./editor-ai-suggestion";
import { EditorAgentReview } from "./EditorAgentReview";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const INITIAL_SOURCE = "# Draft\n\nA quiet opening.\n";
const RESPONSE =
  '{"summary":"Uses a direct opening","oldText":"A quiet opening.","newText":"Start with the core claim."}';

function readyClient(
  implementation: (
    input: EditorSuggestionInput,
    signal?: AbortSignal
  ) => ReturnType<EditorSuggestionClient["request"]> = async (input) =>
    proposalFromResponse(input, RESPONSE)
): EditorSuggestionClient {
  return {
    availability: () => ({ kind: "ready" }),
    request: implementation,
  };
}

function Harness({
  client,
  initialSource = INITIAL_SOURCE,
}: {
  client: EditorSuggestionClient;
  initialSource?: string;
}) {
  const [source, setSource] = useState(initialSource);
  const [revision, setRevision] = useState(0);
  function changeSource(next: string) {
    setSource(next);
    setRevision((current) => current + 1);
  }

  return (
    <>
      <EditorAgentReview
        source={source}
        format="mdx"
        filename="draft.mdx"
        revision={revision}
        onApply={changeSource}
        client={client}
      />
      <textarea
        aria-label="Harness draft"
        value={source}
        onChange={(event) => changeSource(event.currentTarget.value)}
      />
    </>
  );
}

async function renderHarness(client: EditorSuggestionClient) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<Harness client={client} />);
  });
  await vi.waitFor(() => expect(host.textContent).not.toContain("Checking provider settings"));
  return { host, root };
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function button(host: HTMLElement, name: string): HTMLButtonElement {
  const match = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.trim() === name
  );
  if (!match) throw new Error(`Button "${name}" not found`);
  return match;
}

async function requestSuggestion(host: HTMLElement) {
  const request = host.querySelector<HTMLTextAreaElement>("aside textarea");
  if (!request) throw new Error("Agent request textarea not found");
  act(() => setTextareaValue(request, "Make the opening direct."));
  await act(async () => button(host, "Review suggestion").click());
  await vi.waitFor(() => expect(host.textContent).toContain("Suggested edit"));
}

function draft(host: HTMLElement): HTMLTextAreaElement {
  const textarea = host.querySelector<HTMLTextAreaElement>("textarea[aria-label='Harness draft']");
  if (!textarea) throw new Error("Harness draft not found");
  return textarea;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("EditorAgentReview", () => {
  it("previews the exact diff without changing the draft and rejects cleanly", async () => {
    const client = readyClient();
    const { host, root } = await renderHarness(client);

    await requestSuggestion(host);

    expect(draft(host).value).toBe(INITIAL_SOURCE);
    expect(host.textContent).toContain("Uses a direct opening");
    expect(host.textContent).toContain("line 3 · +1 / −1");
    expect(host.querySelector("[aria-label='Proposed source diff']")?.textContent).toContain(
      "−A quiet opening."
    );
    await act(async () => button(host, "Reject").click());
    expect(draft(host).value).toBe(INITIAL_SOURCE);
    expect(host.textContent).toContain("Suggestion rejected. The draft was not changed.");
    act(() => root.unmount());
  });

  it("applies only after approval and safely undoes an untouched agent edit", async () => {
    const { host, root } = await renderHarness(readyClient());
    await requestSuggestion(host);

    await act(async () => button(host, "Approve and apply").click());

    expect(draft(host).value).toBe("# Draft\n\nStart with the core claim.\n");
    expect(host.textContent).toContain("Applied to current draft");
    expect(host.textContent).toContain("Agent approval did not save this edit to disk");
    await act(async () => button(host, "Undo agent edit").click());
    expect(draft(host).value).toBe(INITIAL_SOURCE);
    expect(host.textContent).toContain(
      "Agent edit undone in the current draft. Saving is still separate."
    );
    act(() => root.unmount());
  });

  it("preserves a later human edit and disables unsafe undo", async () => {
    const { host, root } = await renderHarness(readyClient());
    await requestSuggestion(host);
    await act(async () => button(host, "Approve and apply").click());

    act(() => setTextareaValue(draft(host), "# Draft\n\nMy newer human edit.\n"));

    expect(button(host, "Undo agent edit").disabled).toBe(true);
    expect(host.textContent).toContain(
      "Undo is unavailable because the draft changed afterward. Your newer edits are preserved."
    );
    expect(draft(host).value).toContain("My newer human edit.");
    act(() => root.unmount());
  });

  it("marks a stale suggestion as conflicting when the draft changes during the request", async () => {
    let resolve!: (proposal: ReturnType<typeof proposalFromResponse>) => void;
    const pending = new Promise<ReturnType<typeof proposalFromResponse>>((done) => {
      resolve = done;
    });
    let capturedInput: EditorSuggestionInput | null = null;
    const client = readyClient(async (input) => {
      capturedInput = input;
      return pending;
    });
    const { host, root } = await renderHarness(client);
    const request = host.querySelector<HTMLTextAreaElement>("aside textarea");
    if (!request) throw new Error("Agent request textarea not found");
    act(() => setTextareaValue(request, "Make the opening direct."));
    await act(async () => button(host, "Review suggestion").click());
    act(() => setTextareaValue(draft(host), "# Draft\n\nA newer human opening.\n"));
    if (!capturedInput) throw new Error("Suggestion input was not captured");
    await act(async () => resolve(proposalFromResponse(capturedInput!, RESPONSE)));

    await vi.waitFor(() => expect(host.textContent).toContain("This draft changed"));
    expect(button(host, "Approve and apply").disabled).toBe(true);
    expect(draft(host).value).toContain("A newer human opening.");
    act(() => root.unmount());
  });

  it("surfaces a recoverable provider failure without changing the draft", async () => {
    const client = readyClient(async () => {
      throw new Error("The provider is temporarily unavailable.");
    });
    const { host, root } = await renderHarness(client);
    const request = host.querySelector<HTMLTextAreaElement>("aside textarea");
    if (!request) throw new Error("Agent request textarea not found");
    act(() => setTextareaValue(request, "Tighten this."));
    await act(async () => button(host, "Review suggestion").click());

    await vi.waitFor(() => expect(host.textContent).toContain("Suggestion unavailable"));
    expect(host.textContent).toContain("The provider is temporarily unavailable.");
    expect(draft(host).value).toBe(INITIAL_SOURCE);
    act(() => root.unmount());
  });

  it("explains setup and keeps the request disabled when no provider is configured", async () => {
    const request = vi.fn();
    const client: EditorSuggestionClient = {
      availability: () => ({
        kind: "unconfigured",
        message: "Choose an AI provider in Settings before requesting an edit.",
      }),
      request,
    };
    const { host, root } = await renderHarness(client);
    const input = host.querySelector<HTMLTextAreaElement>("aside textarea");
    if (!input) throw new Error("Agent request textarea not found");
    act(() => setTextareaValue(input, "Tighten this."));

    expect(button(host, "Review suggestion").disabled).toBe(true);
    expect(host.textContent).toContain("Choose an AI provider");
    expect(host.querySelector<HTMLAnchorElement>("a[href='/settings/agent']")).not.toBeNull();
    expect(host.textContent).toContain("sent to your configured provider");
    expect(host.textContent).toContain("saving or downloading remains explicit.");
    expect(request).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
