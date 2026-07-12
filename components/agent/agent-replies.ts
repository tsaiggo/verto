import type { AgentStep } from "@/lib/ai/agent";
import type {
  AgentCitation,
  AgentReplyRequest,
  AgentSource,
  ThreadData,
  ThreadMessage,
  ThreadStore,
} from "./agent-types";

function sourceCitationsForSteps(sources: AgentSource[], steps: AgentStep[]): AgentCitation[] {
  const readHrefs = new Set<string>();
  for (const step of steps) {
    if (step.name !== "read_workspace_source") continue;
    try {
      const value: unknown = JSON.parse(step.args);
      if (value && typeof value === "object" && "href" in value) {
        const href = (value as { href?: unknown }).href;
        if (typeof href === "string") readHrefs.add(href);
      }
    } catch {
      // A malformed tool call cannot justify a citation.
    }
  }

  return sources
    .filter((source) => readHrefs.has(source.href))
    .slice(0, 3)
    .map((source, index) => ({ index: index + 1, label: source.title, href: source.href }));
}

export function agentReply(
  store: ThreadStore,
  text: string,
  citations: AgentCitation[] = []
): ThreadMessage {
  const reply: ThreadMessage = { id: store.newId(), role: "agent", text };
  return citations.length > 0 ? { ...reply, citations } : reply;
}

function threadHistory(store: ThreadStore, activeThread: ThreadData | null) {
  return activeThread ? activeThread.messages.map((message) => store.toChatMessage(message)) : [];
}

async function mockReply(request: AgentReplyRequest): Promise<ThreadMessage> {
  const [mockMod, agentMod, libraryMod] = await Promise.all([
    import("@/lib/ai/mock"),
    import("@/lib/ai/agent"),
    import("@/lib/ai/tools/library"),
  ]);
  const result = await agentMod.runAgent(
    mockMod.createMockProvider(),
    libraryMod.READING_TOOLS,
    [
      ...threadHistory(request.store, request.activeThread),
      { role: "user" as const, content: request.prompt },
    ],
    libraryMod.readingToolCtx(null)
  );
  return agentReply(request.store, result.content || "Done.");
}

async function githubReply(request: AgentReplyRequest): Promise<ThreadMessage> {
  const [keyStore, agentMod, providerMod, workspaceMod] = await Promise.all([
    import("@/lib/ai/key-store"),
    import("@/lib/ai/agent"),
    import("@/lib/ai/index"),
    import("@/lib/ai/tools/workspace"),
  ]);
  const token = keyStore.loadWebKey();
  if (!token) {
    return agentReply(
      request.store,
      "Add an assistant access key in Settings before starting a conversation."
    );
  }

  const hasTauri =
    typeof window !== "undefined" &&
    typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined";
  const provider = providerMod.createAssistantProvider({
    kind: "github",
    token,
    fetchImpl: hasTauri
      ? async (url: RequestInfo | URL, init?: RequestInit) => {
          const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
          return tauriFetch(url.toString(), init as Record<string, unknown>);
        }
      : window.fetch.bind(window),
  });
  const result = await agentMod.runAgent(
    provider,
    workspaceMod.WORKSPACE_TOOLS,
    [
      { role: "system" as const, content: workspaceInstructions(request.sources) },
      ...threadHistory(request.store, request.activeThread),
      { role: "user" as const, content: request.prompt },
    ],
    workspaceMod.workspaceToolCtx(request.sources)
  );
  return agentReply(
    request.store,
    result.content || "Done.",
    sourceCitationsForSteps(request.sources, result.steps)
  );
}

function workspaceInstructions(sources: AgentSource[]): string {
  const catalog = sources
    .slice(0, 48)
    .map((source) => `- ${source.title}: ${source.href}`)
    .join("\n");

  return [
    "You are Verto's grounded workspace assistant.",
    "For questions about the workspace, use search_workspace first and read_workspace_source for each source you rely on before answering.",
    "Use only tool results as evidence for workspace claims. If the sources do not answer the question, say so plainly instead of guessing.",
    "Never claim that you read, searched, or cited a source unless you used its tool URL in this conversation.",
    `There are ${sources.length} attached readable source${sources.length === 1 ? "" : "s"}:`,
    catalog,
  ].join("\n\n");
}

export async function getAgentReply(request: AgentReplyRequest): Promise<ThreadMessage> {
  switch (request.kind) {
    case "mock":
      return mockReply(request);
    case "github":
      return githubReply(request);
  }
}
