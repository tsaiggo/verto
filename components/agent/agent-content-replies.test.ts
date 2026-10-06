// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAgentReply, contentInstructions } from "./agent-replies";
import { createContentService } from "@/lib/agent-content/service";
import type { StoredDocument } from "@/lib/agent-content/types";
import type { AssistantProvider } from "@/lib/ai/types";

const provider = vi.hoisted(() => ({ chat: vi.fn(), agentChat: vi.fn() }));
vi.mock("@/lib/ai/key-store", () => ({ loadWebKey: () => "provider-key" }));
vi.mock("@/lib/ai/index", () => ({
  createAssistantProvider: () => ({ ...provider, model: "test-model" }),
}));

const document: StoredDocument = {
  id: "managed:a",
  title: "Saved knowledge",
  href: "/read/local?document=a",
  version: "v1",
  format: "md",
  draft: false,
  tags: [],
  sourceLabel: "Local Library",
  annotationSlug: "browser/a",
  source: "# Evidence\n\nAgents read source passages before answering.",
};
const service = () =>
  createContentService({
    listDocuments: async () => [document],
    readDocument: async (id) => (id === document.id ? document : null),
    listAnnotations: async () => [],
  });
const store = {
  newId: () => "reply",
  toChatMessage: (message: { role: string; text: string }) => ({
    role: message.role === "agent" ? "assistant" : message.role,
    content: message.text,
  }),
} as unknown as typeof import("@/lib/agent-threads");

describe("built-in Agent shared retrieval", () => {
  beforeEach(() => {
    provider.chat.mockReset();
    provider.agentChat.mockReset();
  });

  it("searches and reads the shared service, then converts only observed tokens to citations", async () => {
    provider.agentChat
      .mockResolvedValueOnce({
        content: "",
        model: "test-model",
        toolCalls: [{ id: "s", name: "search_documents", args: '{"query":"agents"}' }],
      })
      .mockResolvedValueOnce({
        content: "",
        model: "test-model",
        toolCalls: [
          { id: "r", name: "read_document", args: '{"docId":"managed:a","offset":1,"limit":1}' },
        ],
      })
      .mockResolvedValueOnce({
        content: "Agents read evidence. [[evidence:e1]] [[evidence:invented]]",
        model: "test-model",
      });
    const result = await getAgentReply({
      kind: "github",
      model: "test-model",
      store,
      messages: [{ id: "u", role: "user", text: "Explain agent evidence" }],
      sources: [],
      contentService: service(),
    });
    const specifications = provider.agentChat.mock.calls[0][1] as Parameters<
      NonNullable<AssistantProvider["agentChat"]>
    >[1];
    expect(specifications.map((tool) => tool.name)).toEqual([
      "list_documents",
      "search_documents",
      "read_document",
      "list_annotations",
      "resolve_citation",
    ]);
    expect(result.citations).toHaveLength(1);
    expect(result.citations?.[0].href).toContain("#verto-citation=");
    expect(result.text).toContain("[1](/read/local?document=a");
    expect(result.text).not.toContain("invented");
  });

  it("does not fall back to attached legacy sources if the scoped service is missing", async () => {
    await expect(
      getAgentReply({
        kind: "github",
        model: "test-model",
        store,
        messages: [{ id: "u", role: "user", text: "Find private information" }],
        sources: [
          {
            title: "Legacy source",
            subtitle: "Legacy",
            href: "/read/legacy",
            body: "Must not bypass scoped retrieval",
          },
        ],
      })
    ).rejects.toThrow("scoped content service is unavailable");
    expect(provider.agentChat).not.toHaveBeenCalled();
  });

  it("explains strict document scope and source data boundaries", () => {
    const prompt = contentInstructions({
      kind: "document",
      href: document.href,
      slug: ["browser", "a"],
      title: document.title,
    });
    expect(prompt).toContain("Other documents are outside this conversation's scope");
    expect(prompt).toContain("untrusted source data");
    expect(prompt).toContain("unseen remainder");
  });

  it("discloses omitted build documents without restricting the native managed catalog", () => {
    const prompt = contentInstructions({ kind: "workspace" }, 132);
    expect(prompt).toContain("132 build-provided documents are not available in this build");
    expect(prompt).toContain("cannot be searched, read, or cited");
    expect(prompt).toContain("Native managed and connected-folder sources are fully searchable");
    const scoped = contentInstructions(
      { kind: "document", href: document.href, slug: ["browser", "a"], title: document.title },
      132
    );
    expect(scoped).not.toContain("132 build-provided");
  });
});
