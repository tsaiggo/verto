export type AssistantKind = "none" | "mock" | "github";

export interface AgentCitation {
  index: number;
  label: string;
  href: string;
}

export interface AgentListItem {
  term: string;
  text: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  list?: AgentListItem[];
  citations?: AgentCitation[];
}

export interface AgentSource {
  title: string;
  subtitle: string;
  href: string;
  body: string;
  tags?: string[];
}

export type ThreadStore = typeof import("@/lib/agent-threads");
export type ThreadData = import("@/lib/agent-threads").AgentThreadData;
export type ThreadMessage = import("@/lib/agent-threads").AgentThreadMessage;

export interface AgentReplyRequest {
  kind: Exclude<AssistantKind, "none">;
  model: string;
  store: ThreadStore;
  messages: ThreadMessage[];
  sources: AgentSource[];
  /** All workspace documents known at build time, including unattached documents. */
  availableSourceCount?: number;
  /** Cancels provider work when the originating thread or vault is no longer active. */
  signal?: AbortSignal;
}

export type WorkspaceStatus = "ready" | "loading" | "error";
